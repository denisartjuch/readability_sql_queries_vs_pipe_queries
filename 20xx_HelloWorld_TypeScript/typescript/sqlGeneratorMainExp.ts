import {
    integer_partitions_of_fix_length,
    integer_partitions_of_fix_length_with_constraint
} from "../N-of-1-Experimentation/modules/numeric/integer_partition.js";
import { Nouns } from "../N-of-1-Experimentation/modules/Words/Nouns.js";
import * as fs from "node:fs";

type Triplet = [number, number, number]; // [att, agg, group]
type ErrorType = "SELECT_UNKNOWN" | "AGG_UNKNOWN" | "GROUP_UNKNOWN" | "NoError";
type ErrorMarkerRole = "ATTR" | "AGG" | "GROUP";

class Aggregate {
    function: string;
    attribute: string;
    rename: string;
}

interface SqlGenerationResult {
    sql: string;
    pipeSql: string;
    cteErrorCost?: number;
    pipeErrorCost?: number | null;
    diff?: number | null; 
    totalInformationSQL: number;
    totalInformationPipe: number;
    unknownName: string | null;
    errorType?: ErrorType;
    numberQueries_excludingBase: number;
    columnsBaseQuery: number;

    cteErrorLine?: number | null;
    pipeErrorLine?: number | null;
}

export interface ResultRow {
    sqlQuery: string;
    pipeQuery: string;
    totalInformationSQL: number;
    totalInformationPipe: number;
    totalInformationUntilErrorSQL: number | null;   
    totalInformationUntilErrorPipe: number | null;  
    errorType: ErrorType | null;
    totalInformationDifference: number | null;     
    unknownName: string | null;
    numberQueries_excludingBase: number;
    columnsBaseQuery: number;

    errorLineSQL: number | null;
    errorLinePipe: number | null;
}

class Query {
    attributes: string[] = [];
    group_by: string[] = [];
    aggregates: Aggregate[] = [];

    from: Query | null = null;

    errorMarker?: {
        type: ErrorType;
        role: ErrorMarkerRole; 
        index: number;        
    };

    total_costs_CTE(): number {
        let total_costs = 0;

        if (this.from != null)
            total_costs = this.from.total_costs_CTE();

        total_costs += this.attributes.length + this.aggregates.length + this.group_by.length;

        return total_costs;
    }

    total_costs_pipe(): number {
        let total_costs = 0;

        if (this.from != null) {
            total_costs = this.from.total_costs_pipe();
        }

        if (this.aggregates.length > 0) {
            total_costs += this.aggregates.length + this.group_by.length;
        } else {
            total_costs += this.attributes.length;
        }

        return total_costs;
    }
}

const AGG_FUNCTIONS = ["SUM", "COUNT", "AVG", "MIN", "MAX"] as const;
const base_columns = 8 as number;

const ALLOWED_NOUN_LENGTHS = new Set([5, 6]);

function isAllowedNoun(w: string): boolean {
    return ALLOWED_NOUN_LENGTHS.has(w.length) && /^[A-Za-z_]+$/.test(w);
}

function pullFilteredNouns(n: number, forbidden: Set<string> = new Set()): string[] {
    const nouns = new Nouns();
    const out: string[] = [];

    while (out.length < n) {
        const [candidate] = nouns.pull_n_random_words(1);
        if (!candidate) continue;

        if (isAllowedNoun(candidate) && !forbidden.has(candidate)) {
            out.push(candidate);
            forbidden.add(candidate);
        }
    }

    return out;
}

function lineHasExactIdentifier(line: string, ident: string): boolean {
    const escaped = ident.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(^|[^A-Za-z0-9_])${escaped}([^A-Za-z0-9_]|$)`);
    return pattern.test(line);
}

function is_valid_triplet(att: number, agg: number, group: number): boolean {
    if (att + agg === 0) {
        return false;
    }
    if (agg > 0 && group === 0 && att > 0) {
        return false;
    }
    if (agg > 0 && att > 0 && group < att) {
        return false;
    }
    if (group > 0 && agg === 0) {
        return false;
    }
    return true;
}

function is_aggregate_column_name(col: string): boolean {
    return AGG_FUNCTIONS.some(f => col.startsWith(f.toLowerCase() + "_"));
}

function generate_innermost_queries(number_of_attributes: number) {
    let ret_query = new Query();
    ret_query.attributes = pullFilteredNouns(number_of_attributes);
    return ret_query;
}

function generate_Queries(number_queries: number, total_costs: number) {
    let total_cost_partitions = integer_partitions_of_fix_length_with_constraint(
        total_costs,
        number_queries,
        (n) => n > 1
    );
    let result_queries: Triplet[][][] = [];
    for (let p of total_cost_partitions) {
        let query_with_all_partitions: Triplet[][] = [];

        for (let costs_of_this_query of p) {
            let valid_partitions: Triplet[] = [];
            let att_agg_groupBy_partitions = integer_partitions_of_fix_length(costs_of_this_query, 3);

            for (let att_agg_groupBy_partition of att_agg_groupBy_partitions) {
                const [att, agg, group] = att_agg_groupBy_partition as Triplet;

                if (is_valid_triplet(att, agg, group)) {
                    valid_partitions.push(att_agg_groupBy_partition as Triplet);
                }
            }
            if (valid_partitions.length > 0) {
                query_with_all_partitions.push(valid_partitions);
            }
        }
        result_queries.push(query_with_all_partitions);
    }
    return result_queries;
}

function generate_random_query_cte_combination_as_array(
    number_queries: number,
    total_costs: number
): Triplet[][] | null {
    const remaining_costs = total_costs - base_columns;

    if (remaining_costs <= 0) {
        return null;
    }
    const all_generated_queries = generate_Queries(number_queries, remaining_costs);
    let counter: Triplet[][] = [];

    all_generated_queries.forEach((query_with_all_partitions) => {
        for (let i = 0; i < query_with_all_partitions[0].length; i++) {
            for (let j = 0; j < query_with_all_partitions[1].length; j++) {
                for (let k = 0; k < query_with_all_partitions[2].length; k++) {
                    for (let l = 0; l < query_with_all_partitions[3].length; l++) {
                        let query = [
                            query_with_all_partitions[0][i],
                            query_with_all_partitions[1][j],
                            query_with_all_partitions[2][k],
                            query_with_all_partitions[3][l]]
                        counter.push(query)
                    }
                }
            }
        }
    });

    const random_query_cte_combination: Triplet[][] = [];

    for (let query of counter) {
        const chosen_query_combination: Triplet[] = query
        let is_valid_flag = true
        let aggregation_only_query_happened = false;

        let available_cols: number | null = null;

        for (let cte_level = 0; cte_level < chosen_query_combination.length; cte_level++) {
            let possible_triplet = chosen_query_combination[cte_level];

            if (possible_triplet[0] === 0 && possible_triplet[2] === 0 && possible_triplet[1] > 0) {
                aggregation_only_query_happened = true;
            }

            if (aggregation_only_query_happened) {
                if (possible_triplet[1] > 0) {
                    is_valid_flag = false;
                    break;
                }
            }
            if (available_cols !== null) {
                if (possible_triplet[0] > available_cols) {
                    is_valid_flag = false;
                    break;
                }

                if (possible_triplet[1] > available_cols * AGG_FUNCTIONS.length) {
                    is_valid_flag = false;
                    break;
                }
            }
            available_cols = possible_triplet[0] + possible_triplet[2];
        }
        if (is_valid_flag) {
            random_query_cte_combination.push(query);
        }
    }
    return random_query_cte_combination
}

function returnColumnsOfQuery(q: Query): string[] {
    const cols: string[] = [];
    cols.push(...q.attributes);
    cols.push(...q.aggregates.map(a => a.rename));
    return cols;
}
function generateNewNounNotInBase(baseNames: Set<string>, forbidden: Set<string>): string {
    const combined = new Set<string>([...baseNames, ...forbidden]);
    return pullFilteredNouns(1, combined)[0];
}

function compute_error_cost_pipe(root: Query): number | null {
    const chain: Query[] = [];
    let current: Query | null = root;
    while (current) {
        chain.push(current);
        current = current.from;
    }
    chain.reverse(); 

    let costCounter = 0;

    for (const q of chain) {
        const hasAgg = q.aggregates.length > 0;
        const marker = q.errorMarker;

        if (!hasAgg) {
            if (marker && marker.role === "ATTR") {
                costCounter += (marker.index + 1);
                return costCounter;
            } else {
                costCounter += q.attributes.length;
                continue;
            }
        }

        if (marker) {
            switch (marker.role) {
                case "AGG":
                    costCounter += (marker.index + 1);
                    return costCounter;

                case "GROUP":
                    costCounter += q.aggregates.length + (marker.index + 1);
                    return costCounter;

                case "ATTR":
                    return null;
            }
        }

        costCounter += q.aggregates.length + q.group_by.length;
    }

    return null;
}
function getQueryChain(root: Query): Query[] {
    const chain: Query[] = [];
    let current: Query | null = root;
    while (current) {
        chain.push(current);
        current = current.from;
    }
    chain.reverse();
    return chain;
}
function findErrorInChain(root: Query): { q: Query; marker: NonNullable<Query["errorMarker"]> } | null {
    const chain = getQueryChain(root);
    for (const q of chain) {
        if (q.errorMarker) {
            return { q, marker: q.errorMarker };
        }
    }
    return null;
}
function getUnknownNameFromError(root: Query): string | null {
    const info = findErrorInChain(root);
    if (!info) return null;

    const { q, marker } = info;
    switch (marker.role) {
        case "ATTR":
            return q.attributes[marker.index] ?? null;
        case "GROUP":
            return q.group_by[marker.index] ?? null;
        case "AGG":
            return q.aggregates[marker.index]?.attribute ?? null;
        default:
            return null;
    }
}
function queryChainToPipeSql(root: Query): string {
    const chain = getQueryChain(root);

    const lines: string[] = [];

    lines.push("FROM base");

    for (const q of chain) {
        const hasAgg = q.aggregates.length > 0;
        const hasGroup = q.group_by.length > 0;
        const hasAttr = q.attributes.length > 0;

        if (!hasAgg && !hasGroup) {
            if (hasAttr) {
                const selectLines = q.attributes.map(a => `     ${a}`);
                lines.push("|> SELECT");
                lines.push(selectLines.join(",\n"));
            }
            continue;
        }

        if (hasAgg && !hasGroup && !hasAttr) {
            const aggLines = q.aggregates
                .map(a => `      ${a.function}(${a.attribute}) AS ${a.rename}`);
            lines.push("|> AGGREGATE");
            if (aggLines.length > 0) {
                lines.push(aggLines.join(",\n"));
            }
            continue;
        }

        const aggLines = q.aggregates
            .map(a => `     ${a.function}(${a.attribute}) AS ${a.rename}`);
        const groupLines = q.group_by.map(col => `     ${col}`);

        lines.push("|> AGGREGATE");
        if (aggLines.length > 0) {
            lines.push(aggLines.join(",\n"));
        }
        if (hasGroup) {
            lines.push("   GROUP BY");
            if (groupLines.length > 0) {
                lines.push(groupLines.join(",\n"));
            }
        }
    }

    lines.push("|> SELECT *");

    return lines.join("\n");
}

function random_query_cte_combination_array_to_queryCTE(
    number_queries: number,
    total_costs: number
): Query[] | null {
    const innermost_query = generate_innermost_queries(base_columns);
    const generated_triplets = generate_random_query_cte_combination_as_array(number_queries, total_costs);

    if (!generated_triplets || generated_triplets.length === 0) {
        return null;
    }

    const resultQueries: Query[] = [];

    for (const queryTriplets of generated_triplets) {
        let currentQuery: Query = innermost_query;
        let currentColumns: string[] = returnColumnsOfQuery(currentQuery);

        let invalidCombination = false;

        const globalUsedAggCombos = new Set<string>();

        for (const triplet of queryTriplets) {
            const [attCount, aggCount, groupCount] = triplet;

            const q = new Query();
            q.from = currentQuery;

            const inputNonAggCols = currentColumns.filter(c => !is_aggregate_column_name(c));

            q.attributes = inputNonAggCols.slice(0, attCount);
            q.group_by = inputNonAggCols.slice(0, groupCount);

            const groupSet = new Set(q.group_by);

            const aggregates: Aggregate[] = [];

            const aggregatableColumns = inputNonAggCols.filter(c => !groupSet.has(c));

            if (aggCount > 0 && aggregatableColumns.length === 0) {
                invalidCombination = true;
                break;
            }

            for (let i = 0; i < aggCount; i++) {
                const candidates: { func: (typeof AGG_FUNCTIONS)[number]; col: string }[] = [];

                for (const col of aggregatableColumns) {
                    for (const func of AGG_FUNCTIONS) {
                        const key = `${func}|${col}`;

                        if (!globalUsedAggCombos.has(key)) {
                            candidates.push({ func, col });
                        }
                    }
                }

                if (candidates.length === 0) {
                    invalidCombination = true;
                    break;
                }

                const choice = candidates[Math.floor(Math.random() * candidates.length)];
                const aggregate = new Aggregate();

                globalUsedAggCombos.add(`${choice.func}|${choice.col}`);

                aggregate.function = choice.func;
                aggregate.attribute = choice.col;
                aggregate.rename = `${choice.func.toLowerCase()}_${choice.col}`;
                aggregates.push(aggregate);
            }

            if (invalidCombination) {
                break;
            }

            q.aggregates = aggregates;
            currentQuery = q;
            currentColumns = returnColumnsOfQuery(q);
        }

        if (!invalidCombination) {
            resultQueries.push(currentQuery);
        }
    }

    return resultQueries;
}
function inject_error_in_query_chain(root: Query, errorType: ErrorType, errorCost: number): Query | null {
    if (errorCost <= 0) {
        return null;
    }

    const chain: Query[] = [];
    let current: Query | null = root;
    while (current) {
        chain.push(current);
        current = current.from;
    }
    chain.reverse(); 

    if (chain.length === 0) {
        return null;
    }

    const innermost = chain[0];
    const baseNouns = new Set<string>(innermost.attributes);

    let costCounter = 0;

    for (const q of chain) {
        const fromColumns = q.from ? returnColumnsOfQuery(q.from) : [];
        const thisQueryColumns = returnColumnsOfQuery(q);

        const usedNames = new Set<string>([...fromColumns, ...thisQueryColumns]);

        const newErrorColumn = () => generateNewNounNotInBase(baseNouns, usedNames);

        switch (errorType) {
            case "SELECT_UNKNOWN": {
                const onlySelect = (q.aggregates.length === 0 && q.group_by.length === 0);

                for (let i = 0; i < q.attributes.length; i++) {
                    if (costCounter + 1 === errorCost) {
                        if (!onlySelect) return null;

                        const name = newErrorColumn();
                        q.attributes.splice(i, 0, name);

                        q.errorMarker = {
                            type: "SELECT_UNKNOWN",
                            role: "ATTR",
                            index: i
                        };
                        return root;
                    }
                    costCounter++;
                }

                if (onlySelect && costCounter + 1 === errorCost) {
                    const i = q.attributes.length;
                    const name = newErrorColumn();
                    q.attributes.splice(i, 0, name);

                    q.errorMarker = {
                        type: "SELECT_UNKNOWN",
                        role: "ATTR",
                        index: i
                    };
                    return root;
                }

                for (let i = 0; i < q.aggregates.length; i++) {
                    if (costCounter + 1 === errorCost) return null;
                    costCounter++;
                }

                for (let i = 0; i < q.group_by.length; i++) {
                    if (costCounter + 1 === errorCost) return null;
                    costCounter++;
                }

                break;
            }

            case "AGG_UNKNOWN": {
                for (let i = 0; i < q.attributes.length; i++) {
                    if (costCounter + 1 === errorCost) {
                        return null;
                    }
                    costCounter++;
                }

                for (let i = 0; i < q.aggregates.length; i++) {
                    if (costCounter + 1 === errorCost) {
                        const newName = newErrorColumn();

                        const agg = new Aggregate();
                        agg.function = AGG_FUNCTIONS[Math.floor(Math.random() * AGG_FUNCTIONS.length)];
                        agg.attribute = newName;
                        agg.rename = `${agg.function.toLowerCase()}_${newName}`;

                        q.aggregates.splice(i, 0, agg);

                        q.errorMarker = {
                            type: "AGG_UNKNOWN",
                            role: "AGG",
                            index: i
                        };
                        return root;
                    }
                    costCounter++;
                }

                if (costCounter + 1 === errorCost) {
                    const i = q.aggregates.length;
                    const newName = newErrorColumn();

                    const agg = new Aggregate();
                    agg.function = AGG_FUNCTIONS[Math.floor(Math.random() * AGG_FUNCTIONS.length)];
                    agg.attribute = newName;
                    agg.rename = `${agg.function.toLowerCase()}_${newName}`;

                    q.aggregates.splice(i, 0, agg);

                    q.errorMarker = {
                        type: "AGG_UNKNOWN",
                        role: "AGG",
                        index: i
                    };
                    return root;
                }

                for (let i = 0; i < q.group_by.length; i++) {
                    if (costCounter + 1 === errorCost) return null;
                    costCounter++;
                }

                break;
            }

            case "GROUP_UNKNOWN": {
                for (let i = 0; i < q.attributes.length; i++) {
                    if (costCounter + 1 === errorCost) {
                        return null;
                    }
                    costCounter++;
                }

                for (let i = 0; i < q.aggregates.length; i++) {
                    if (costCounter + 1 === errorCost) {
                        return null;
                    }
                    costCounter++;
                }

                for (let i = 0; i < q.group_by.length; i++) {
                    if (costCounter + 1 === errorCost) {
                        const name = newErrorColumn();
                        q.group_by.splice(i, 0, name);

                        q.errorMarker = {
                            type: "GROUP_UNKNOWN",
                            role: "GROUP",
                            index: i
                        };
                        return root;
                    }
                    costCounter++;
                }

                if (costCounter + 1 === errorCost) {
                    const i = q.group_by.length;
                    const name = newErrorColumn();
                    q.group_by.splice(i, 0, name);

                    q.errorMarker = {
                        type: "GROUP_UNKNOWN",
                        role: "GROUP",
                        index: i
                    };
                    return root;
                }

                break;
            }

            case "NoError": {
                return root;
            }
        }
    }

    return null;
}

function shuffle<T>(arr: T[]): T[] {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
function CTEquery_to_sqlCTE_query(
    number_queries: number,
    total_costs: number,
    errorType?: ErrorType,
    errorCost?: number,
    desiredDiff?: number
): SqlGenerationResult | null {
    const roots: Query[] | null = random_query_cte_combination_array_to_queryCTE(number_queries, total_costs);

    if (!roots || roots.length === 0) {
        return null;
    }

    const shuffledRoots = shuffle(roots);

    for (const originalRoot of shuffledRoots) {
        let root: Query = originalRoot;

        const totalInformationSQL_beforeError = root.total_costs_CTE();
        if (totalInformationSQL_beforeError !== total_costs) {
            continue;
        }

        let pipeErrorCost: number | null = null;
        let effectiveErrorType: ErrorType | undefined = errorType;

        if (errorType && errorType !== "NoError" && typeof errorCost === "number") {
            const modified = inject_error_in_query_chain(root, errorType, errorCost);
            if (!modified) {
                continue;
            }
            root = modified;
            pipeErrorCost = compute_error_cost_pipe(root);
        } else if (errorType === "NoError") {
            errorCost = undefined;
        }

        const totalInformationSQL_afterError = root.total_costs_CTE();

        const isErrorCase = !!(effectiveErrorType && effectiveErrorType !== "NoError");
        if (isErrorCase) {
            if (totalInformationSQL_afterError !== total_costs + 1) {
                continue;
            }
        } else {
            if (totalInformationSQL_afterError !== total_costs) {
                continue;
            }
        }

        const totalInformationSQL = isErrorCase ? (total_costs + 1) : total_costs;
        const totalInformationPipe = root.total_costs_pipe();

        let diff: number | null = null;
        if (isErrorCase) {
            if (typeof errorCost === "number" && pipeErrorCost != null) {
                diff = Math.abs(errorCost - pipeErrorCost);
            }
        } else {
            diff = totalInformationSQL - totalInformationPipe;
        }

        if (typeof desiredDiff === "number") {
            if (diff === null || diff !== desiredDiff) {
                continue;
            }
        }

        const chain: Query[] = [];
        let current: Query | null = root;
        while (current) {
            chain.push(current);
            current = current.from;
        }
        chain.reverse();

        const ctes: string[] = [];
        let lastSourceName = "base";

        for (let i = 0; i < chain.length; i++) {
            const q = chain[i];

            const selectParts: string[] = [];
            selectParts.push(...q.attributes);

            for (const agg of q.aggregates) {
                selectParts.push(`${agg.function}(${agg.attribute}) AS ${agg.rename}`);
            }

            const selectLines = selectParts.map(p => `  ${p}`);
            const selectClause = `SELECT\n${selectLines.join(",\n")}`;

            let groupByClause = "";
            if (q.group_by.length > 0) {
                const groupLines = q.group_by.map(col => `  ${col}`);
                groupByClause = `\nGROUP BY\n${groupLines.join(",\n")}`;
            }

            const selectSql = `${selectClause}\nFROM ${lastSourceName}${groupByClause}`;
            const cteName = `cte_${i}`;

            const indentedSelectSql = selectSql
                .split("\n")
                .map(line => "  " + line)
                .join("\n");

            const cteSql = `${cteName} AS (\n${indentedSelectSql}\n)`;
            ctes.push(cteSql);

            lastSourceName = cteName;
        }

        const withClause = ctes.length > 0
            ? `WITH\n${ctes.join(",\n")}\n`
            : "";

        const finalSql = `${withClause} SELECT * \n FROM ${lastSourceName};`;

        const pipeSql = queryChainToPipeSql(root);

        const unknownName = getUnknownNameFromError(root);
        const numberQueries_excludingBase = chain.length - 1;
        const columnsBaseQuery = chain[0]?.attributes.length ?? base_columns;

        let cteErrorLine: number | null = null;
        let pipeErrorLine: number | null = null;

        if (unknownName) {
            const cteLines = finalSql.split("\n");
            for (let i = 0; i < cteLines.length; i++) {
                if (lineHasExactIdentifier(cteLines[i], unknownName)) {
                    cteErrorLine = i + 1;
                    break;
                }
            }

            const pipeLines = pipeSql.split("\n");
            for (let i = 0; i < pipeLines.length; i++) {
                if (lineHasExactIdentifier(pipeLines[i], unknownName)) {
                    pipeErrorLine = i + 1;
                    break;
                }
            }
        }

        return {
            sql: finalSql,
            pipeSql,
            cteErrorCost: errorCost,
            pipeErrorCost,
            diff,
            totalInformationSQL,
            totalInformationPipe,
            unknownName,
            errorType: effectiveErrorType,
            numberQueries_excludingBase,
            columnsBaseQuery,
            cteErrorLine,
            pipeErrorLine
        };
    }

    return null;
}

export const result_array: ResultRow[] = [];

const desiredDiffs: number[] = [0,4,8]

const errorTypes: ErrorType[] = ["SELECT_UNKNOWN", "AGG_UNKNOWN", "GROUP_UNKNOWN"];

const totalCosts: number = 32;
const errorCost: number = 28;
const number_queries: number = 4;
const repetitionsPerCombo = 20
const triesLimitPerCombo = 100000;

for (const et of errorTypes) {
    for (const diffTarget of desiredDiffs) {
        let localTries = 0;

        let produced = 0;

        while (produced < repetitionsPerCombo && localTries < triesLimitPerCombo) {
            localTries++;

            const gen = CTEquery_to_sqlCTE_query(
                number_queries,
                totalCosts,
                et,
                et === "NoError" ? undefined : errorCost,
                diffTarget
            );

            if (gen != null) {
                result_array.push({
                    sqlQuery: gen.sql,
                    pipeQuery: gen.pipeSql,
                    totalInformationSQL: gen.totalInformationSQL,
                    totalInformationPipe: gen.totalInformationPipe,
                    totalInformationUntilErrorSQL: gen.cteErrorCost ?? null,
                    totalInformationUntilErrorPipe: (gen.pipeErrorCost ?? null),
                    errorType: gen.errorType ?? null,
                    totalInformationDifference: gen.diff ?? null,
                    unknownName: gen.unknownName,
                    numberQueries_excludingBase: gen.numberQueries_excludingBase,
                    columnsBaseQuery: gen.columnsBaseQuery,
                    errorLineSQL: gen.cteErrorLine ?? null,
                    errorLinePipe: gen.pipeErrorLine ?? null
                });

                produced++;
            }
        }

    }
}


export type Row = {
    sqlQuery: string;
    pipeQuery: string;
    totalInformationSQL: number;
    totalInformationPipe: number;
    totalInformationUntilErrorSQL: number | string | null;
    totalInformationUntilErrorPipe: number | string | null;
    errorType: string;
    totalInformationDifference: number;
    unknownName: string;
    numberQueries_excludingBase: number;
    columnsBaseQuery: number;
    errorLineSQL: number | string;
    errorLinePipe: number | string;
};

function toRow(r: ResultRow): Row {
    return {
        sqlQuery: r.sqlQuery,
        pipeQuery: r.pipeQuery,
        totalInformationSQL: r.totalInformationSQL,
        totalInformationPipe: r.totalInformationPipe,
        totalInformationUntilErrorSQL: r.totalInformationUntilErrorSQL ?? null,
        totalInformationUntilErrorPipe: r.totalInformationUntilErrorPipe ?? null,
        errorType: (r.errorType ?? "null") as string,
        totalInformationDifference: (r.totalInformationDifference ?? 0) as number,
        unknownName: (r.unknownName ?? "null") as string,
        numberQueries_excludingBase: r.numberQueries_excludingBase,
        columnsBaseQuery: r.columnsBaseQuery,
        errorLineSQL: (r.errorLineSQL ?? "null") as number | string,
        errorLinePipe: (r.errorLinePipe ?? "null") as number | string,
    };
}

function writeResultsTs(rows: ResultRow[], outPath = "resultArray20Reps.ts") {
    const mapped = rows.map(toRow);

    const fileContent =
        `export type Row = {\n` +
        `    sqlQuery: string;\n` +
        `    pipeQuery: string;\n` +
        `    totalInformationSQL: number;\n` +
        `    totalInformationPipe: number;\n` +
        `    totalInformationUntilErrorSQL: number | string | null;\n` +
        `    totalInformationUntilErrorPipe: number | string | null;\n` +
        `    errorType: string;\n` +
        `    totalInformationDifference: number;\n` +
        `    unknownName: string;\n` +
        `    numberQueries_excludingBase: number;\n` +
        `    columnsBaseQuery: number;\n` +
        `    errorLineSQL: number | string;\n` +
        `    errorLinePipe: number | string;\n` +
        `};\n\n` +
        `export type QueryKind = "sql" | "pipe";\n\n` +
        `export type Entry = Row & { queryKind: QueryKind };\n\n` +
        `export const resultArray20Reps: Row[] =\n` +
        `${JSON.stringify(mapped, null, 4)};\n\n` +
        `const unescape = (s: string) =>\n` +
        `    s\n` +
        `        .replace(/\\\\r\\\\n/g, "\\n")\n` +
        `        .replace(/\\\\n/g, "\\n")\n` +
        `        .replace(/\\\\r/g, "\\n")\n` +
        `        .replace(/\\\\t/g, "\\t");\n\n` +
        `export const formatted: Row[] = resultArray20Reps.map((r) => ({\n` +
        `    ...r,\n` +
        `    sqlQuery: unescape(r.sqlQuery),\n` +
        `    pipeQuery: unescape(r.pipeQuery),\n` +
        `}));\n\n` 
        

    fs.writeFileSync(outPath, fileContent, "utf8");
}

writeResultsTs(result_array, "queries20RepsMainExp.ts");
