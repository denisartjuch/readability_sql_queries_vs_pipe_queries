var _a, _b, _c, _d, _e, _f;
import { integer_partitions_of_fix_length, integer_partitions_of_fix_length_with_constraint } from "../N-of-1-Experimentation/modules/numeric/integer_partition.js";
import { Nouns } from "../N-of-1-Experimentation/modules/Words/Nouns.js";
import * as fs from "node:fs";
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
    total_costs_pipe() {
        let total_costs = 0;
        if (this.from != null) {
            total_costs = this.from.total_costs_pipe();
        }
        if (this.aggregates.length > 0) {
            total_costs += this.aggregates.length + this.group_by.length;
        }
        else {
            total_costs += this.attributes.length;
        }
        return total_costs;
    }
}
const AGG_FUNCTIONS = ["SUM", "COUNT", "AVG", "MIN", "MAX"];
const base_columns = 8;
const ALLOWED_NOUN_LENGTHS = new Set([5, 6]);
function isAllowedNoun(w) {
    return ALLOWED_NOUN_LENGTHS.has(w.length) && /^[A-Za-z_]+$/.test(w);
}
function pullFilteredNouns(n, forbidden = new Set()) {
    const nouns = new Nouns();
    const out = [];
    while (out.length < n) {
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
function lineHasExactIdentifier(line, ident) {
    const escaped = ident.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(^|[^A-Za-z0-9_])${escaped}([^A-Za-z0-9_]|$)`);
    return pattern.test(line);
}
function is_valid_triplet(att, agg, group) {
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
function is_aggregate_column_name(col) {
    return AGG_FUNCTIONS.some(f => col.startsWith(f.toLowerCase() + "_"));
}
function generate_innermost_queries(number_of_attributes) {
    let ret_query = new Query();
    ret_query.attributes = pullFilteredNouns(number_of_attributes);
    return ret_query;
}
function generate_Queries(number_queries, total_costs) {
    let total_cost_partitions = integer_partitions_of_fix_length_with_constraint(total_costs, number_queries, (n) => n > 1);
    let result_queries = [];
    for (let p of total_cost_partitions) {
        let query_with_all_partitions = [];
        for (let costs_of_this_query of p) {
            let valid_partitions = [];
            let att_agg_groupBy_partitions = integer_partitions_of_fix_length(costs_of_this_query, 3);
            for (let att_agg_groupBy_partition of att_agg_groupBy_partitions) {
                const [att, agg, group] = att_agg_groupBy_partition;
                if (is_valid_triplet(att, agg, group)) {
                    valid_partitions.push(att_agg_groupBy_partition);
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
function generate_random_query_cte_combination_as_array(number_queries, total_costs) {
    const remaining_costs = total_costs - base_columns;
    if (remaining_costs <= 0) {
        return null;
    }
    const all_generated_queries = generate_Queries(number_queries, remaining_costs);
    let counter = [];
    all_generated_queries.forEach((query_with_all_partitions) => {
        for (let i = 0; i < query_with_all_partitions[0].length; i++) {
            for (let j = 0; j < query_with_all_partitions[1].length; j++) {
                for (let k = 0; k < query_with_all_partitions[2].length; k++) {
                    for (let l = 0; l < query_with_all_partitions[3].length; l++) {
                        let query = [
                            query_with_all_partitions[0][i],
                            query_with_all_partitions[1][j],
                            query_with_all_partitions[2][k],
                            query_with_all_partitions[3][l]
                        ];
                        counter.push(query);
                    }
                }
            }
        }
    });
    const random_query_cte_combination = [];
    for (let query of counter) {
        const chosen_query_combination = query;
        let is_valid_flag = true;
        let aggregation_only_query_happened = false;
        let available_cols = null;
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
    return random_query_cte_combination;
}
function returnColumnsOfQuery(q) {
    const cols = [];
    cols.push(...q.attributes);
    cols.push(...q.aggregates.map(a => a.rename));
    return cols;
}
function generateNewNounNotInBase(baseNames, forbidden) {
    const combined = new Set([...baseNames, ...forbidden]);
    return pullFilteredNouns(1, combined)[0];
}
function compute_error_cost_pipe(root) {
    const chain = [];
    let current = root;
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
            }
            else {
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
function getQueryChain(root) {
    const chain = [];
    let current = root;
    while (current) {
        chain.push(current);
        current = current.from;
    }
    chain.reverse();
    return chain;
}
function findErrorInChain(root) {
    const chain = getQueryChain(root);
    for (const q of chain) {
        if (q.errorMarker) {
            return { q, marker: q.errorMarker };
        }
    }
    return null;
}
function getUnknownNameFromError(root) {
    var _a, _b, _c, _d;
    const info = findErrorInChain(root);
    if (!info)
        return null;
    const { q, marker } = info;
    switch (marker.role) {
        case "ATTR":
            return (_a = q.attributes[marker.index]) !== null && _a !== void 0 ? _a : null;
        case "GROUP":
            return (_b = q.group_by[marker.index]) !== null && _b !== void 0 ? _b : null;
        case "AGG":
            return (_d = (_c = q.aggregates[marker.index]) === null || _c === void 0 ? void 0 : _c.attribute) !== null && _d !== void 0 ? _d : null;
        default:
            return null;
    }
}
function queryChainToPipeSql(root) {
    const chain = getQueryChain(root);
    const lines = [];
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
function random_query_cte_combination_array_to_queryCTE(number_queries, total_costs) {
    const innermost_query = generate_innermost_queries(base_columns);
    const generated_triplets = generate_random_query_cte_combination_as_array(number_queries, total_costs);
    if (!generated_triplets || generated_triplets.length === 0) {
        return null;
    }
    const resultQueries = [];
    for (const queryTriplets of generated_triplets) {
        let currentQuery = innermost_query;
        let currentColumns = returnColumnsOfQuery(currentQuery);
        let invalidCombination = false;
        const globalUsedAggCombos = new Set();
        for (const triplet of queryTriplets) {
            const [attCount, aggCount, groupCount] = triplet;
            const q = new Query();
            q.from = currentQuery;
            const inputNonAggCols = currentColumns.filter(c => !is_aggregate_column_name(c));
            q.attributes = inputNonAggCols.slice(0, attCount);
            q.group_by = inputNonAggCols.slice(0, groupCount);
            const groupSet = new Set(q.group_by);
            const aggregates = [];
            const aggregatableColumns = inputNonAggCols.filter(c => !groupSet.has(c));
            if (aggCount > 0 && aggregatableColumns.length === 0) {
                invalidCombination = true;
                break;
            }
            for (let i = 0; i < aggCount; i++) {
                const candidates = [];
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
function inject_error_in_query_chain(root, errorType, errorCost) {
    if (errorCost <= 0) {
        return null;
    }
    const chain = [];
    let current = root;
    while (current) {
        chain.push(current);
        current = current.from;
    }
    chain.reverse();
    if (chain.length === 0) {
        return null;
    }
    const innermost = chain[0];
    const baseNouns = new Set(innermost.attributes);
    let costCounter = 0;
    for (const q of chain) {
        const fromColumns = q.from ? returnColumnsOfQuery(q.from) : [];
        const thisQueryColumns = returnColumnsOfQuery(q);
        const usedNames = new Set([...fromColumns, ...thisQueryColumns]);
        const newErrorColumn = () => generateNewNounNotInBase(baseNouns, usedNames);
        switch (errorType) {
            case "SELECT_UNKNOWN": {
                const onlySelect = (q.aggregates.length === 0 && q.group_by.length === 0);
                for (let i = 0; i < q.attributes.length; i++) {
                    if (costCounter + 1 === errorCost) {
                        if (!onlySelect)
                            return null;
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
                    if (costCounter + 1 === errorCost)
                        return null;
                    costCounter++;
                }
                for (let i = 0; i < q.group_by.length; i++) {
                    if (costCounter + 1 === errorCost)
                        return null;
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
                    if (costCounter + 1 === errorCost)
                        return null;
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
function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
function CTEquery_to_sqlCTE_query(number_queries, total_costs, errorType, errorCost, desiredDiff) {
    var _a, _b;
    const roots = random_query_cte_combination_array_to_queryCTE(number_queries, total_costs);
    if (!roots || roots.length === 0) {
        return null;
    }
    const shuffledRoots = shuffle(roots);
    for (const originalRoot of shuffledRoots) {
        let root = originalRoot;
        const totalInformationSQL_beforeError = root.total_costs_CTE();
        if (totalInformationSQL_beforeError !== total_costs) {
            continue;
        }
        let pipeErrorCost = null;
        let effectiveErrorType = errorType;
        if (errorType && errorType !== "NoError" && typeof errorCost === "number") {
            const modified = inject_error_in_query_chain(root, errorType, errorCost);
            if (!modified) {
                continue;
            }
            root = modified;
            pipeErrorCost = compute_error_cost_pipe(root);
        }
        else if (errorType === "NoError") {
            errorCost = undefined;
        }
        const totalInformationSQL_afterError = root.total_costs_CTE();
        const isErrorCase = !!(effectiveErrorType && effectiveErrorType !== "NoError");
        if (isErrorCase) {
            if (totalInformationSQL_afterError !== total_costs + 1) {
                continue;
            }
        }
        else {
            if (totalInformationSQL_afterError !== total_costs) {
                continue;
            }
        }
        const totalInformationSQL = isErrorCase ? (total_costs + 1) : total_costs;
        const totalInformationPipe = root.total_costs_pipe();
        let diff = null;
        if (isErrorCase) {
            if (typeof errorCost === "number" && pipeErrorCost != null) {
                diff = Math.abs(errorCost - pipeErrorCost);
            }
        }
        else {
            diff = totalInformationSQL - totalInformationPipe;
        }
        if (typeof desiredDiff === "number") {
            if (diff === null || diff !== desiredDiff) {
                continue;
            }
        }
        const chain = [];
        let current = root;
        while (current) {
            chain.push(current);
            current = current.from;
        }
        chain.reverse();
        const ctes = [];
        let lastSourceName = "base";
        for (let i = 0; i < chain.length; i++) {
            const q = chain[i];
            const selectParts = [];
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
        const columnsBaseQuery = (_b = (_a = chain[0]) === null || _a === void 0 ? void 0 : _a.attributes.length) !== null && _b !== void 0 ? _b : base_columns;
        let cteErrorLine = null;
        let pipeErrorLine = null;
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
export const result_array = [];
const desiredDiffs = [0, 4, 8];
const errorTypes = ["SELECT_UNKNOWN", "AGG_UNKNOWN", "GROUP_UNKNOWN"];
const totalCosts = 32;
const errorCost = 28;
const number_queries = 4;
const repetitionsPerCombo = 20;
const triesLimitPerCombo = 100000;
for (const et of errorTypes) {
    for (const diffTarget of desiredDiffs) {
        let localTries = 0;
        let produced = 0;
        while (produced < repetitionsPerCombo && localTries < triesLimitPerCombo) {
            localTries++;
            const gen = CTEquery_to_sqlCTE_query(number_queries, totalCosts, et, et === "NoError" ? undefined : errorCost, diffTarget);
            if (gen != null) {
                result_array.push({
                    sqlQuery: gen.sql,
                    pipeQuery: gen.pipeSql,
                    totalInformationSQL: gen.totalInformationSQL,
                    totalInformationPipe: gen.totalInformationPipe,
                    totalInformationUntilErrorSQL: (_a = gen.cteErrorCost) !== null && _a !== void 0 ? _a : null,
                    totalInformationUntilErrorPipe: ((_b = gen.pipeErrorCost) !== null && _b !== void 0 ? _b : null),
                    errorType: (_c = gen.errorType) !== null && _c !== void 0 ? _c : null,
                    totalInformationDifference: (_d = gen.diff) !== null && _d !== void 0 ? _d : null,
                    unknownName: gen.unknownName,
                    numberQueries_excludingBase: gen.numberQueries_excludingBase,
                    columnsBaseQuery: gen.columnsBaseQuery,
                    errorLineSQL: (_e = gen.cteErrorLine) !== null && _e !== void 0 ? _e : null,
                    errorLinePipe: (_f = gen.pipeErrorLine) !== null && _f !== void 0 ? _f : null
                });
                produced++;
            }
        }
    }
}
function toRow(r) {
    var _a, _b, _c, _d, _e, _f, _g;
    return {
        sqlQuery: r.sqlQuery,
        pipeQuery: r.pipeQuery,
        totalInformationSQL: r.totalInformationSQL,
        totalInformationPipe: r.totalInformationPipe,
        totalInformationUntilErrorSQL: (_a = r.totalInformationUntilErrorSQL) !== null && _a !== void 0 ? _a : null,
        totalInformationUntilErrorPipe: (_b = r.totalInformationUntilErrorPipe) !== null && _b !== void 0 ? _b : null,
        errorType: ((_c = r.errorType) !== null && _c !== void 0 ? _c : "null"),
        totalInformationDifference: ((_d = r.totalInformationDifference) !== null && _d !== void 0 ? _d : 0),
        unknownName: ((_e = r.unknownName) !== null && _e !== void 0 ? _e : "null"),
        numberQueries_excludingBase: r.numberQueries_excludingBase,
        columnsBaseQuery: r.columnsBaseQuery,
        errorLineSQL: ((_f = r.errorLineSQL) !== null && _f !== void 0 ? _f : "null"),
        errorLinePipe: ((_g = r.errorLinePipe) !== null && _g !== void 0 ? _g : "null"),
    };
}
function writeResultsTs(rows, outPath = "resultArray20Reps.ts") {
    const mapped = rows.map(toRow);
    const fileContent = `export type Row = {\n` +
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
        `}));\n\n`;
    fs.writeFileSync(outPath, fileContent, "utf8");
}
writeResultsTs(result_array, "queries20RepsMainExp.ts");
//# sourceMappingURL=sqlGeneratorMainExp.js.map