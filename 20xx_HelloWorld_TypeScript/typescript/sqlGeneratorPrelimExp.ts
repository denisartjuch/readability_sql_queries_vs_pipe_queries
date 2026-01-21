import {
    integer_partitions_of_fix_length,
    integer_partitions_of_fix_length_with_constraint,
} from "../../N-of-1-Experimentation/modules/numeric/integer_partition.js";
import { Nouns } from "../../N-of-1-Experimentation/modules/Words/Nouns.js";

type Triplet = [number, number, number]; 

class Aggregate {
    function!: string;
    attribute!: string;
    rename!: string;
}

class Query {
    attributes: string[] = [];
    group_by: string[] = [];
    aggregates: Aggregate[] = [];

    from: Query | null = null;

    total_costs_CTE(): number {
        let total_costs = 0;
        if (this.from != null) total_costs = this.from.total_costs_CTE();
        total_costs += this.attributes.length + this.aggregates.length + this.group_by.length;
        return total_costs;
    }
}
export interface SqlRenderOptions {

    shuffleSelect?: boolean;
    inlineSelect?: boolean;
}
export interface GeneratorOptions extends SqlRenderOptions {
    totalAggregates?: number;
    aggregateAtIndex?: number;
    attributesBeforeAggregateAtIndex?: number;
}

export interface ResultRow {
    pairId: number;
    inlineSelect: boolean;
    sqlQuery: string;
    totalInformationSQL: number;
    numberQueries_excludingBase: number;
    columnsBaseQuery: number;
    shuffleSelect: boolean;
    totalAggregates: number | null; 
    aggregateAtIndex: number | null;
    attributesBeforeAggregateAtIndex: number | null;
    selectedAggregateIndex: number | null;
    selectedAggregateSql: string | null;
    selectedAggregateCte: string | null;
    selectedAggregateCteNumber: number | null;
    selectedAggregateAlias: string | null;
    selectedAggregateFunction: string | null;
    selectedAggregateAttribute: string | null;
    selectedAggregateAttributesBefore: number | null;
}

const AGG_FUNCTIONS = ["SUM", "COUNT", "AVG", "MIN", "MAX"] as const;
const base_columns = 5;

const ALLOWED_NOUN_LENGTHS = new Set([5, 6]);

function isAllowedNoun(w: string): boolean {
    return ALLOWED_NOUN_LENGTHS.has(w.length) && /^[A-Za-z_]+$/.test(w);
}
function pullFilteredNouns(n: number, forbidden: Set<string> = new Set()): string[] {
    const nouns = new Nouns();
    const out: string[] = [];

    const MAX_TRIES = 200000;
    let tries = 0;

    while (out.length < n) {
        if (++tries > MAX_TRIES) {
            throw new Error(
                `Could not find enough nouns of length 5 or 6. Needed=${n}, got=${out.length}`
            );
        }
        const [candidate] = nouns.pull_n_random_words(1);
        if (!candidate) continue;

        if (isAllowedNoun(candidate) && !forbidden.has(candidate)) {
            out.push(candidate);
            forbidden.add(candidate);
        }
    }

    return out;
}

function is_valid_triplet(att: number, agg: number, group: number): boolean {
    if (att + agg === 0) return false; 
    if (agg > 0 && group === 0 && att > 0) return false; 
    if (agg > 0 && att > 0 && group < att) return false;
    if (group > 0 && agg === 0) return false;
    return true;
}

function is_aggregate_column_name(col: string): boolean {
    return AGG_FUNCTIONS.some((f) => col.startsWith(f.toLowerCase() + "_"));
}

function returnColumnsOfQuery(q: Query): string[] {
    return [...q.attributes, ...q.aggregates.map((a) => a.rename)];
}

function generate_innermost_query(number_of_attributes: number): Query {
    const q = new Query();
    q.attributes = pullFilteredNouns(number_of_attributes);
    return q;
}

function shuffle<T>(arr: T[]): T[] {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function extractCteNumber(cteName: string | null | undefined): number | null {
    if (!cteName) return null;
    const m = /^cte_(\d+)$/.exec(cteName);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : null;
}

function generate_Queries(number_queries: number, total_costs_excluding_base: number): Triplet[][][] {
    const total_cost_partitions = integer_partitions_of_fix_length_with_constraint(
        total_costs_excluding_base,
        number_queries,
        (n) => n > 1
    );

    const result: Triplet[][][] = [];

    for (const partition of total_cost_partitions) {
        const perLevelTriplets: Triplet[][] = [];

        for (const costsOfThisLevel of partition) {
            const valid: Triplet[] = [];
            const triplets = integer_partitions_of_fix_length(costsOfThisLevel, 3);

            for (const t of triplets) {
                const [att, agg, group] = t as Triplet;
                if (is_valid_triplet(att, agg, group)) valid.push([att, agg, group]);
            }

            if (valid.length === 0) {
                perLevelTriplets.length = 0;
                break;
            }

            perLevelTriplets.push(valid);
        }

        if (perLevelTriplets.length === number_queries) {
            result.push(perLevelTriplets);
        }
    }

    return result;
}

function cartesianProduct<T>(lists: T[][]): T[][] {
    let acc: T[][] = [[]];
    for (const list of lists) {
        const next: T[][] = [];
        for (const prefix of acc) {
            for (const item of list) {
                next.push([...prefix, item]);
            }
        }
        acc = next;
    }
    return acc;
}

function generate_query_triplet_chains(
    number_queries: number,
    total_costs: number,
    totalAggregates?: number
): Triplet[][] {
    const remaining_costs = total_costs - base_columns;
    if (remaining_costs <= 0) return [];

    const perPartition = generate_Queries(number_queries, remaining_costs);
    const allChains: Triplet[][] = [];

    for (const perLevelTriplets of perPartition) {
        const chains = cartesianProduct(perLevelTriplets);

        for (const chainAny of chains) {
            const chain = chainAny as Triplet[];

            if (typeof totalAggregates === "number") {
                const aggSum = chain.reduce((s, [, agg]) => s + agg, 0);
                if (aggSum !== totalAggregates) continue;
            }

            let ok = true;
            let aggregationOnlyHappened = false;

            let availableCols = base_columns;

            for (const [att, agg, group] of chain) {
                if (att === 0 && group === 0 && agg > 0) aggregationOnlyHappened = true;
                if (aggregationOnlyHappened && agg > 0) {
                    ok = false;
                    break;
                }

                if (att > availableCols) {
                    ok = false;
                    break;
                }
                if (group > availableCols) {
                    ok = false;
                    break;
                }

                if (agg > availableCols * AGG_FUNCTIONS.length) {
                    ok = false;
                    break;
                }

                availableCols = att + agg;
                if (availableCols <= 0) {
                    ok = false;
                    break;
                }
            }

            if (ok) allChains.push(chain);
        }
    }

    return allChains;
}

function tripletChainToQueryRoot(triplets: Triplet[]): Query | null {
    let currentQuery: Query = generate_innermost_query(base_columns);
    let currentColumns: string[] = returnColumnsOfQuery(currentQuery);

    const globalUsedAggCombos = new Set<string>(); 

    for (const [attCount, aggCount, groupCount] of triplets) {
        const q = new Query();
        q.from = currentQuery;

        q.attributes = currentColumns.slice(0, attCount);
        q.group_by = currentColumns.slice(0, groupCount);

        const aggregatableColumns = currentColumns.filter((c) => !is_aggregate_column_name(c));
        if (aggCount > 0 && aggregatableColumns.length === 0) return null;

        const aggregates: Aggregate[] = [];
        const usedAggCombos = new Set<string>();

        for (let i = 0; i < aggCount; i++) {
            const candidates: { func: (typeof AGG_FUNCTIONS)[number]; col: string }[] = [];

            for (const col of aggregatableColumns) {
                for (const func of AGG_FUNCTIONS) {
                    const key = `${func}|${col}`;
                    if (!usedAggCombos.has(key) && !globalUsedAggCombos.has(key))
                        candidates.push({ func, col });
                }
            }

            if (candidates.length === 0) return null;

            const choice = candidates[Math.floor(Math.random() * candidates.length)];
            const chosenKey = `${choice.func}|${choice.col}`;
            usedAggCombos.add(chosenKey);
            globalUsedAggCombos.add(chosenKey);

            const aggObj = new Aggregate();
            aggObj.function = choice.func;
            aggObj.attribute = choice.col;
            aggObj.rename = `${choice.func.toLowerCase()}_${choice.col}`;
            aggregates.push(aggObj);
        }

        q.aggregates = aggregates;

        currentQuery = q;
        currentColumns = returnColumnsOfQuery(q);
    }

    return currentQuery;
}

type SelectItem =
    | { kind: "ATTR"; sql: string }
    | {
        kind: "AGG";
        sql: string;
        function: string;
        attribute: string;
        alias: string;
    };

type SelectedAggregate = {
    index: number; 
    sql: string;
    cteName: string;
    cteNumber: number;
    alias: string;
    function: string;
    attribute: string;
    attributesBefore: number; 
};

function buildSelectItems(q: Query): SelectItem[] {
    const attrs: SelectItem[] = q.attributes.map((a) => ({ kind: "ATTR", sql: a }));

    const aggs: SelectItem[] = q.aggregates.map((agg) => ({
        kind: "AGG",
        sql: `${agg.function}(${agg.attribute}) AS ${agg.rename}`,
        function: agg.function,
        attribute: agg.attribute,
        alias: agg.rename,
    }));

    return [...attrs, ...aggs];
}

type GlobalIndexState = {
    nextAggIndex: number;
    attrCountBeforeDesiredAgg: number;
    desiredAggIndex: number | null;
    desiredFound: boolean;
};

function formatSelectClause(items: SelectItem[], inlineSelect: boolean): string {
    const sqlItems = items.map((x) => x.sql);

    if (inlineSelect) {
        return `SELECT ${sqlItems.join(", ")}`;
    }

    const lines = sqlItems.map((p) => `  ${p}`);
    return `SELECT\n${lines.join(",\n")}`;
}

function findSelectedAggregateWithFixedItems(
    fixedItemsPerCte: SelectItem[][],
    desiredAggIndex: number | null
): SelectedAggregate | null {
    const state: GlobalIndexState = {
        nextAggIndex: 1,
        attrCountBeforeDesiredAgg: 0,
        desiredAggIndex,
        desiredFound: false,
    };

    let selected: SelectedAggregate | null = null;

    for (let i = 0; i < fixedItemsPerCte.length; i++) {
        const items = fixedItemsPerCte[i];
        const cteName = `cte_${i}`;
        const cteNumber = extractCteNumber(cteName) ?? i;

        for (const it of items) {
            if (!state.desiredFound && it.kind === "ATTR") {
                state.attrCountBeforeDesiredAgg += 1;
                continue;
            }

            if (it.kind !== "AGG") continue;

            const idx = state.nextAggIndex++;

            if (state.desiredAggIndex !== null && idx === state.desiredAggIndex) {
                state.desiredFound = true;
                selected = {
                    index: idx,
                    sql: it.sql,
                    cteName,
                    cteNumber,
                    alias: it.alias,
                    function: it.function,
                    attribute: it.attribute,
                    attributesBefore: state.attrCountBeforeDesiredAgg,
                };
            }
        }
    }

    return selected;
}

function queryRootToSqlCTE_pair(
    root: Query,
    shuffleSelect: boolean,
    aggregateAtIndex?: number
): {
    sql_inline: string;
    sql_multiline: string;
    chainLen: number;
    baseCols: number;
    selectedAggregate: SelectedAggregate | null;
} {
    const desiredAggIndex = typeof aggregateAtIndex === "number" ? aggregateAtIndex : null;

    const chain: Query[] = [];
    let current: Query | null = root;
    while (current) {
        chain.push(current);
        current = current.from;
    }
    chain.reverse();

    const fixedItemsPerCte: SelectItem[][] = chain.map((q) => {
        const items = buildSelectItems(q);
        return shuffleSelect ? shuffle(items) : items;
    });

    const selectedAggregate =
        desiredAggIndex !== null
            ? findSelectedAggregateWithFixedItems(fixedItemsPerCte, desiredAggIndex)
            : null;

    if (desiredAggIndex !== null && !selectedAggregate) {
        return {
            sql_inline: "",
            sql_multiline: "",
            chainLen: chain.length,
            baseCols: chain[0]?.attributes.length ?? base_columns,
            selectedAggregate: null,
        };
    }

    const ctesInline: string[] = [];
    const ctesMultiline: string[] = [];
    let lastSourceInline = "base";
    let lastSourceMultiline = "base";

    for (let i = 0; i < chain.length; i++) {
        const q = chain[i];
        const cteName = `cte_${i}`;
        const items = fixedItemsPerCte[i];

        const selectClauseInline = formatSelectClause(items, true);
        const selectClauseMultiline = formatSelectClause(items, false);

        let groupByClause = "";
        if (q.group_by.length > 0) {
            const groupLines = q.group_by.map((col) => `  ${col}`);
            groupByClause = `\nGROUP BY\n${groupLines.join(",\n")}`;
        }

        const selectSqlInline = `${selectClauseInline}\nFROM ${lastSourceInline}${groupByClause}`;
        const selectSqlMultiline = `${selectClauseMultiline}\nFROM ${lastSourceMultiline}${groupByClause}`;

        const indentedInline = selectSqlInline
            .split("\n")
            .map((line) => "  " + line)
            .join("\n");

        const indentedMultiline = selectSqlMultiline
            .split("\n")
            .map((line) => "  " + line)
            .join("\n");

        ctesInline.push(`${cteName} AS (\n${indentedInline}\n)`);
        ctesMultiline.push(`${cteName} AS (\n${indentedMultiline}\n)`);

        lastSourceInline = cteName;
        lastSourceMultiline = cteName;
    }

    const withClauseInline = ctesInline.length > 0 ? `WITH\n${ctesInline.join(",\n")}\n` : "";
    const withClauseMultiline =
        ctesMultiline.length > 0 ? `WITH\n${ctesMultiline.join(",\n")}\n` : "";

    return {
        sql_inline: `${withClauseInline}SELECT *\nFROM ${lastSourceInline};`,
        sql_multiline: `${withClauseMultiline}SELECT *\nFROM ${lastSourceMultiline};`,
        chainLen: chain.length,
        baseCols: chain[0]?.attributes.length ?? base_columns,
        selectedAggregate,
    };
}

export function generate_sql_cte_queries(
    number_queries: number,
    total_costs: number,
    repetitions: number,
    triesLimit: number = 100000,
    options?: GeneratorOptions
): ResultRow[] {
    const shuffleSelect = options?.shuffleSelect ?? false;

    const totalAggregates =
        typeof options?.totalAggregates === "number" ? options!.totalAggregates : null;

    const aggregateAtIndex =
        typeof options?.aggregateAtIndex === "number" ? options!.aggregateAtIndex : null;

    const attributesBeforeAggregateAtIndex =
        typeof options?.attributesBeforeAggregateAtIndex === "number"
            ? options!.attributesBeforeAggregateAtIndex
            : null;

    const tripletChains = generate_query_triplet_chains(
        number_queries,
        total_costs,
        options?.totalAggregates
    );
    const shuffledChains = shuffle(tripletChains);

    const results: ResultRow[] = [];
    let tries = 0;
    let pairId = 0;

    for (const chain of shuffledChains) {
        if (pairId >= repetitions) break;
        if (++tries > triesLimit) break;

        const root = tripletChainToQueryRoot(chain);
        if (!root) continue;

        if (root.total_costs_CTE() !== total_costs) continue;

        const rendered = queryRootToSqlCTE_pair(
            root,
            shuffleSelect,
            aggregateAtIndex ?? undefined
        );

        if (aggregateAtIndex !== null && !rendered.selectedAggregate) continue;

        if (
            aggregateAtIndex !== null &&
            attributesBeforeAggregateAtIndex !== null &&
            rendered.selectedAggregate
        ) {
            if (rendered.selectedAggregate.attributesBefore !== attributesBeforeAggregateAtIndex) {
                continue;
            }
        }

        pairId += 1;

        const common = {
            pairId,
            totalInformationSQL: total_costs,
            numberQueries_excludingBase: rendered.chainLen - 1,
            columnsBaseQuery: rendered.baseCols,

            shuffleSelect,
            totalAggregates,
            aggregateAtIndex,
            attributesBeforeAggregateAtIndex,

            selectedAggregateIndex: rendered.selectedAggregate?.index ?? null,
            selectedAggregateSql: rendered.selectedAggregate?.sql ?? null,
            selectedAggregateCte: rendered.selectedAggregate?.cteName ?? null,
            selectedAggregateCteNumber: rendered.selectedAggregate?.cteNumber ?? null,
            selectedAggregateAlias: rendered.selectedAggregate?.alias ?? null,
            selectedAggregateFunction: rendered.selectedAggregate?.function ?? null,
            selectedAggregateAttribute: rendered.selectedAggregate?.attribute ?? null,
            selectedAggregateAttributesBefore: rendered.selectedAggregate?.attributesBefore ?? null,
        };

        results.push({
            ...common,
            inlineSelect: true,
            sqlQuery: rendered.sql_inline,
        });

        results.push({
            ...common,
            inlineSelect: false,
            sqlQuery: rendered.sql_multiline,
        });
    }

    return results;
}


export const result_array: ResultRow[] = [];

const totalCosts: number = 28;
const number_queries: number = 3;

const repetitions: number = 80;

const triesLimit: number = 100000;

const options: GeneratorOptions = {
    shuffleSelect: false,
    totalAggregates: 10,

    aggregateAtIndex: 5,

    attributesBeforeAggregateAtIndex: 9,
}

const generated = generate_sql_cte_queries(
    number_queries,
    totalCosts,
    repetitions,
    triesLimit,
    options
);
result_array.push(...generated);

