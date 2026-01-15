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
const AGG_FUNCTIONS = ["SUM", "COUNT", "AVG", "MIN", "MAX"];
const base_columns = 5;
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
        return false;
    if (agg > 0 && group === 0 && att > 0)
        return false;
    if (agg > 0 && att > 0 && group < att)
        return false;
    if (group > 0 && agg === 0)
        return false;
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
            if (typeof totalAggregates === "number") {
                const aggSum = chain.reduce((s, [, agg]) => s + agg, 0);
                if (aggSum !== totalAggregates)
                    continue;
            }
            let ok = true;
            let aggregationOnlyHappened = false;
            let availableCols = base_columns;
            for (const [att, agg, group] of chain) {
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
function tripletChainToQueryRoot(triplets) {
    let currentQuery = generate_innermost_query(base_columns);
    let currentColumns = returnColumnsOfQuery(currentQuery);
    const globalUsedAggCombos = new Set();
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
    var _a;
    const state = {
        nextAggIndex: 1,
        attrCountBeforeDesiredAgg: 0,
        desiredAggIndex,
        desiredFound: false,
    };
    let selected = null;
    for (let i = 0; i < fixedItemsPerCte.length; i++) {
        const items = fixedItemsPerCte[i];
        const cteName = `cte_${i}`;
        const cteNumber = (_a = extractCteNumber(cteName)) !== null && _a !== void 0 ? _a : i;
        for (const it of items) {
            if (!state.desiredFound && it.kind === "ATTR") {
                state.attrCountBeforeDesiredAgg += 1;
                continue;
            }
            if (it.kind !== "AGG")
                continue;
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
function queryRootToSqlCTE_pair(root, shuffleSelect, aggregateAtIndex) {
    var _a, _b, _c, _d;
    const desiredAggIndex = typeof aggregateAtIndex === "number" ? aggregateAtIndex : null;
    const chain = [];
    let current = root;
    while (current) {
        chain.push(current);
        current = current.from;
    }
    chain.reverse();
    const fixedItemsPerCte = chain.map((q) => {
        const items = buildSelectItems(q);
        return shuffleSelect ? shuffle(items) : items;
    });
    const selectedAggregate = desiredAggIndex !== null
        ? findSelectedAggregateWithFixedItems(fixedItemsPerCte, desiredAggIndex)
        : null;
    if (desiredAggIndex !== null && !selectedAggregate) {
        return {
            sql_inline: "",
            sql_multiline: "",
            chainLen: chain.length,
            baseCols: (_b = (_a = chain[0]) === null || _a === void 0 ? void 0 : _a.attributes.length) !== null && _b !== void 0 ? _b : base_columns,
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
        baseCols: (_d = (_c = chain[0]) === null || _c === void 0 ? void 0 : _c.attributes.length) !== null && _d !== void 0 ? _d : base_columns,
        selectedAggregate,
    };
}
export function generate_sql_cte_queries(number_queries, total_costs, repetitions, triesLimit = 100000, options) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s;
    const shuffleSelect = (_a = options === null || options === void 0 ? void 0 : options.shuffleSelect) !== null && _a !== void 0 ? _a : false;
    const totalAggregates = typeof (options === null || options === void 0 ? void 0 : options.totalAggregates) === "number" ? options.totalAggregates : null;
    const aggregateAtIndex = typeof (options === null || options === void 0 ? void 0 : options.aggregateAtIndex) === "number" ? options.aggregateAtIndex : null;
    const attributesBeforeAggregateAtIndex = typeof (options === null || options === void 0 ? void 0 : options.attributesBeforeAggregateAtIndex) === "number"
        ? options.attributesBeforeAggregateAtIndex
        : null;
    const tripletChains = generate_query_triplet_chains(number_queries, total_costs, options === null || options === void 0 ? void 0 : options.totalAggregates);
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
        const rendered = queryRootToSqlCTE_pair(root, shuffleSelect, aggregateAtIndex !== null && aggregateAtIndex !== void 0 ? aggregateAtIndex : undefined);
        if (aggregateAtIndex !== null && !rendered.selectedAggregate)
            continue;
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
            selectedAggregateIndex: (_c = (_b = rendered.selectedAggregate) === null || _b === void 0 ? void 0 : _b.index) !== null && _c !== void 0 ? _c : null,
            selectedAggregateSql: (_e = (_d = rendered.selectedAggregate) === null || _d === void 0 ? void 0 : _d.sql) !== null && _e !== void 0 ? _e : null,
            selectedAggregateCte: (_g = (_f = rendered.selectedAggregate) === null || _f === void 0 ? void 0 : _f.cteName) !== null && _g !== void 0 ? _g : null,
            selectedAggregateCteNumber: (_j = (_h = rendered.selectedAggregate) === null || _h === void 0 ? void 0 : _h.cteNumber) !== null && _j !== void 0 ? _j : null,
            selectedAggregateAlias: (_l = (_k = rendered.selectedAggregate) === null || _k === void 0 ? void 0 : _k.alias) !== null && _l !== void 0 ? _l : null,
            selectedAggregateFunction: (_o = (_m = rendered.selectedAggregate) === null || _m === void 0 ? void 0 : _m.function) !== null && _o !== void 0 ? _o : null,
            selectedAggregateAttribute: (_q = (_p = rendered.selectedAggregate) === null || _p === void 0 ? void 0 : _p.attribute) !== null && _q !== void 0 ? _q : null,
            selectedAggregateAttributesBefore: (_s = (_r = rendered.selectedAggregate) === null || _r === void 0 ? void 0 : _r.attributesBefore) !== null && _s !== void 0 ? _s : null,
        };
        results.push(Object.assign(Object.assign({}, common), { inlineSelect: true, sqlQuery: rendered.sql_inline }));
        results.push(Object.assign(Object.assign({}, common), { inlineSelect: false, sqlQuery: rendered.sql_multiline }));
    }
    return results;
}
export const result_array = [];
const totalCosts = 28;
const number_queries = 3;
const repetitions = 80;
const triesLimit = 100000;
const options = {
    shuffleSelect: false,
    totalAggregates: 10,
    aggregateAtIndex: 5,
    attributesBeforeAggregateAtIndex: 9,
};
const generated = generate_sql_cte_queries(number_queries, totalCosts, repetitions, triesLimit, options);
result_array.push(...generated);
//# sourceMappingURL=sqlGeneratorPrelimExp.js.map