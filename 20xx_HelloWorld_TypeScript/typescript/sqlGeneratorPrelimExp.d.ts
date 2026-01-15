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
export declare function generate_sql_cte_queries(number_queries: number, total_costs: number, repetitions: number, triesLimit?: number, options?: GeneratorOptions): ResultRow[];
export declare const result_array: ResultRow[];
