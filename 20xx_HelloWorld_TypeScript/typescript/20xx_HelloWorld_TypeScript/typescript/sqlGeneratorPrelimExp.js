import { integer_partitions_of_fix_length, integer_partitions_of_fix_length_with_constraint, } from "../../N-of-1-Experimentation/modules/numeric/integer_partition.js";
import { Nouns } from "../../N-of-1-Experimentation/modules/Words/Nouns.js";
class Aggregate {
}
class Query {
    constructor() {
        this.attributes = [];
        this.group_by = [];
        this.aggregates = [];
        this.from = null;
    }
    total_costs_CTE() {
        let total_costs = 0;
        if (this.from != null)
            total_costs = this.from.total_costs_CTE();
        total_costs += this.attributes.length + this.aggregates.length + this.group_by.length;
        return total_costs;
    }
}
// ------------------------------------------------------------
// Configuration
// ------------------------------------------------------------
const AGG_FUNCTIONS = ["SUM", "COUNT", "AVG", "MIN", "MAX"];
const base_columns = 5;
// Only nouns with 5 or 6 letters
const ALLOWED_NOUN_LENGTHS = new Set([5, 6]);
function isAllowedNoun(w) {
    return ALLOWED_NOUN_LENGTHS.has(w.length) && /^[A-Za-z_]+$/.test(w);
}
function pullFilteredNouns(n, forbidden = new Set()) {
    const nouns = new Nouns();
    const out = [];
    const MAX_TRIES = 200000;
    let tries = 0;
    while (out.length < n) {
        if (++tries > MAX_TRIES) {
            throw new Error(`Could not find enough nouns of length 5 or 6. Needed=${n}, got=${out.length}`);
        }
        const [candidate] = nouns.pull_n_random_words(1);
        if (!candidate)
            continue;
        if (isAllowedNoun(candidate) && !forbidden.has(candidate)) {
            out.push(candidate);
            forbidden.add(candidate);
        }
    }
    return out;
}
function is_valid_triplet(att, agg, group) {
    if (att + agg === 0)
        return false; // something must be selected
    if (agg > 0 && group === 0 && att > 0)
        return false; // agg + attrs without group by
    if (agg > 0 && att > 0 && group < att)
        return false; // selecting more attrs than grouping
    if (group > 0 && agg === 0)
        return false; // group-by without aggregates
    return true;
}
function is_aggregate_column_name(col) {
    return AGG_FUNCTIONS.some((f) => col.startsWith(f.toLowerCase() + "_"));
}
function returnColumnsOfQuery(q) {
    return [...q.attributes, ...q.aggregates.map((a) => a.rename)];
}
function generate_innermost_query(number_of_attributes) {
    const q = new Query();
    q.attributes = pullFilteredNouns(number_of_attributes);
    return q;
}
function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
function extractCteNumber(cteName) {
    if (!cteName)
        return null;
    const m = /^cte_(\d+)$/.exec(cteName);
    if (!m)
        return null;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : null;
}
// ------------------------------------------------------------
// Query shape generation
// ------------------------------------------------------------
function generate_Queries(number_queries, total_costs_excluding_base) {
    const total_cost_partitions = integer_partitions_of_fix_length_with_constraint(total_costs_excluding_base, number_queries, (n) => n > 1);
    const result = [];
    for (const partition of total_cost_partitions) {
        const perLevelTriplets = [];
        for (const costsOfThisLevel of partition) {
            const valid = [];
            const triplets = integer_partitions_of_fix_length(costsOfThisLevel, 3);
            for (const t of triplets) {
                const [att, agg, group] = t;
                if (is_valid_triplet(att, agg, group))
                    valid.push([att, agg, group]);
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
function cartesianProduct(lists) {
    let acc = [[]];
    for (const list of lists) {
        const next = [];
        for (const prefix of acc) {
            for (const item of list) {
                next.push([...prefix, item]);
            }
        }
        acc = next;
    }
    return acc;
}
/**
 * Generate ALL valid triplet-chains (length = number_queries) for the given total_costs.
 * Supports constraining the TOTAL number of aggregates across the whole chain.
 */
function generate_query_triplet_chains(number_queries, total_costs, totalAggregates) {
    const remaining_costs = total_costs - base_columns;
    if (remaining_costs <= 0)
        return [];
    const perPartition = generate_Queries(number_queries, remaining_costs);
    const allChains = [];
    for (const perLevelTriplets of perPartition) {
        const chains = cartesianProduct(perLevelTriplets);
        for (const chainAny of chains) {
            const chain = chainAny;
            // aggregate total constraint
            if (typeof totalAggregates === "number") {
                const aggSum = chain.reduce((s, [, agg]) => s + agg, 0);
                if (aggSum !== totalAggregates)
                    continue;
            }
            let ok = true;
            let aggregationOnlyHappened = false;
            let availableCols = base_columns;
            for (const [att, agg, group] of chain) {
                // after a pure aggregation, forbid further aggregation
                if (att === 0 && group === 0 && agg > 0)
                    aggregationOnlyHappened = true;
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
            if (ok)
                allChains.push(chain);
        }
    }
    return allChains;
}
/**
 * Turn a triplet-chain into a Query-root (outermost Query).
 */
function tripletChainToQueryRoot(triplets) {
    let currentQuery = generate_innermost_query(base_columns);
    let currentColumns = returnColumnsOfQuery(currentQuery);
    const globalUsedAggCombos = new Set(); // prevent duplicates across whole chain
    for (const [attCount, aggCount, groupCount] of triplets) {
        const q = new Query();
        q.from = currentQuery;
        q.attributes = currentColumns.slice(0, attCount);
        q.group_by = currentColumns.slice(0, groupCount);
        const aggregatableColumns = currentColumns.filter((c) => !is_aggregate_column_name(c));
        if (aggCount > 0 && aggregatableColumns.length === 0)
            return null;
        const aggregates = [];
        const usedAggCombos = new Set();
        for (let i = 0; i < aggCount; i++) {
            const candidates = [];
            for (const col of aggregatableColumns) {
                for (const func of AGG_FUNCTIONS) {
                    const key = `${func}|${col}`;
                    if (!usedAggCombos.has(key) && !globalUsedAggCombos.has(key))
                        candidates.push({ func, col });
                }
            }
            if (candidates.length === 0)
                return null;
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
function buildSelectItems(q) {
    const attrs = q.attributes.map((a) => ({ kind: "ATTR", sql: a }));
    const aggs = q.aggregates.map((agg) => ({
        kind: "AGG",
        sql: `${agg.function}(${agg.attribute}) AS ${agg.rename}`,
        function: agg.function,
        attribute: agg.attribute,
        alias: agg.rename,
    }));
    return [...attrs, ...aggs];
}
function formatSelectClause(items, inlineSelect) {
    const sqlItems = items.map((x) => x.sql);
    if (inlineSelect) {
        return `SELECT ${sqlItems.join(", ")}`;
    }
    const lines = sqlItems.map((p) => `  ${p}`);
    return `SELECT\n${lines.join(",\n")}`;
}
function findSelectedAggregateWithFixedItems(fixedItemsPerCte, desiredAggIndex) {
    const state = {
        nextAggIndex: 1,
        projectedCountBeforeDesiredAgg: 0,
        desiredAggIndex,
        desiredFound: false,
    };
    let selected = null;
    for (let i = 0; i < fixedItemsPerCte.length; i++) {
        const items = fixedItemsPerCte[i];
        const cteName = `cte_${i}`;
        const cteNumber = extractCteNumber(cteName) ?? i;
        for (const it of items) {
            // Count ANY projected item that appears before the desired aggregate.
            // Do NOT count the desired aggregate itself.
            if (it.kind === "ATTR") {
                if (!state.desiredFound)
                    state.projectedCountBeforeDesiredAgg += 1;
                continue;
            }
            // it.kind === "AGG"
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
                    attributesBefore: state.projectedCountBeforeDesiredAgg,
                };
            }
            else {
                // This aggregate is projected before the desired one -> it counts
                if (!state.desiredFound)
                    state.projectedCountBeforeDesiredAgg += 1;
            }
        }
    }
    return selected;
}
function queryRootToSqlCTE_pair(root, shuffleSelect, aggregateAtIndex) {
    const desiredAggIndex = typeof aggregateAtIndex === "number" ? aggregateAtIndex : null;
    const chain = [];
    let current = root;
    while (current) {
        chain.push(current);
        current = current.from;
    }
    chain.reverse(); // inner -> outer
    const fixedItemsPerCte = chain.map((q) => {
        const items = buildSelectItems(q);
        return shuffleSelect ? shuffle(items) : items;
    });
    const selectedAggregate = desiredAggIndex !== null
        ? findSelectedAggregateWithFixedItems(fixedItemsPerCte, desiredAggIndex)
        : null;
    // If requested index must exist
    if (desiredAggIndex !== null && !selectedAggregate) {
        return {
            sql_inline: "",
            sql_multiline: "",
            chainLen: chain.length,
            baseCols: chain[0]?.attributes.length ?? base_columns,
            selectedAggregate: null,
        };
    }
    const ctesInline = [];
    const ctesMultiline = [];
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
    const withClauseMultiline = ctesMultiline.length > 0 ? `WITH\n${ctesMultiline.join(",\n")}\n` : "";
    return {
        sql_inline: `${withClauseInline}SELECT *\nFROM ${lastSourceInline};`,
        sql_multiline: `${withClauseMultiline}SELECT *\nFROM ${lastSourceMultiline};`,
        chainLen: chain.length,
        baseCols: chain[0]?.attributes.length ?? base_columns,
        selectedAggregate,
    };
}
// ------------------------------------------------------------
// Public generator
// ------------------------------------------------------------
export function generate_sql_cte_queries(number_queries, total_costs, 
/**
 * IMPORTANT (changed semantics):
 * repetitions now means number of *PAIRS* (i.e., underlying query-roots).
 * The function returns 2 * repetitions rows (two treatments per pair).
 */
repetitions, triesLimit = 100000, options) {
    const shuffleSelect = options?.shuffleSelect ?? false;
    const totalAggregates = typeof options?.totalAggregates === "number" ? options.totalAggregates : null;
    const aggregateAtIndex = typeof options?.aggregateAtIndex === "number" ? options.aggregateAtIndex : null;
    const attributesBeforeAggregateAtIndex = typeof options?.attributesBeforeAggregateAtIndex === "number"
        ? options.attributesBeforeAggregateAtIndex
        : null;
    const tripletChains = generate_query_triplet_chains(number_queries, total_costs, options?.totalAggregates);
    const shuffledChains = shuffle(tripletChains);
    const results = [];
    let tries = 0;
    let pairId = 0;
    for (const chain of shuffledChains) {
        if (pairId >= repetitions)
            break;
        if (++tries > triesLimit)
            break;
        const root = tripletChainToQueryRoot(chain);
        if (!root)
            continue;
        if (root.total_costs_CTE() !== total_costs)
            continue;
        const rendered = queryRootToSqlCTE_pair(root, shuffleSelect, aggregateAtIndex ?? undefined);
        // If a specific aggregate index was requested, skip pairs where it doesn't exist.
        if (aggregateAtIndex !== null && !rendered.selectedAggregate)
            continue;
        // enforce "projected items before selected aggregate" constraint (exact match)
        if (aggregateAtIndex !== null &&
            attributesBeforeAggregateAtIndex !== null &&
            rendered.selectedAggregate) {
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
        // Treatment A: inlineSelect = true
        results.push({
            ...common,
            inlineSelect: true,
            sqlQuery: rendered.sql_inline,
        });
        // Treatment B: inlineSelect = false
        results.push({
            ...common,
            inlineSelect: false,
            sqlQuery: rendered.sql_multiline,
        });
    }
    return results;
}
// ------------------------------------------------------------
// Example run
// ------------------------------------------------------------
export const result_array = [];
const totalCosts = 28;
const number_queries = 4;
// repetitions now means NUMBER OF PAIRS -> returned rows will be 2*repetitions
const repetitions = 80;
const triesLimit = 100000;
const options = {
    shuffleSelect: false,
    totalAggregates: 4,
    // 1-based global aggregate index
    aggregateAtIndex: 2,
    // require exactly N projected SELECT-items globally before that aggregate
    // (counted across all CTEs, in SELECT-list order after shuffling)
    attributesBeforeAggregateAtIndex: 9,
};
const generated = generate_sql_cte_queries(number_queries, totalCosts, repetitions, triesLimit, options);
result_array.push(...generated);
console.log(`Generated ${generated.length} rows = ${generated.length / 2} pairs (tries limit=${triesLimit}, shuffleSelect=${options.shuffleSelect}, totalAggregates=${options.totalAggregates}, aggregateAtIndex=${options.aggregateAtIndex}, attributesBeforeAggregateAtIndex=${options.attributesBeforeAggregateAtIndex}).`);
result_array.forEach((row, idx) => {
    console.log("======================================");
    console.log(`Row #${idx + 1}`);
    console.log("pairId:", row.pairId);
    console.log("inlineSelect (treatment):", row.inlineSelect);
    console.log("totalInformationSQL:", row.totalInformationSQL);
    console.log("numberQueries_excludingBase:", row.numberQueries_excludingBase);
    console.log("columnsBaseQuery:", row.columnsBaseQuery);
    console.log("shuffleSelect:", row.shuffleSelect);
    console.log("totalAggregates:", row.totalAggregates);
    console.log("aggregateAtIndex:", row.aggregateAtIndex);
    console.log("attributesBeforeAggregateAtIndex:", row.attributesBeforeAggregateAtIndex);
    console.log("---- SELECTED AGGREGATE (1-based) ----");
    console.log("selectedAggregateIndex:", row.selectedAggregateIndex);
    console.log("selectedAggregateCte:", row.selectedAggregateCte);
    console.log("selectedAggregateCteNumber:", row.selectedAggregateCteNumber);
    console.log("selectedAggregateSql:", row.selectedAggregateSql);
    console.log("selectedAggregateAlias:", row.selectedAggregateAlias);
    console.log("selectedAggregateFunction:", row.selectedAggregateFunction);
    console.log("selectedAggregateAttribute:", row.selectedAggregateAttribute);
    // UPDATED meaning: projected items (ATTR + earlier AGG) before selected aggregate
    console.log("selectedAggregateAttributesBefore:", row.selectedAggregateAttributesBefore);
    console.log("---- CTE SQL ----");
    console.log(row.sqlQuery);
});
