type ErrorType = "SELECT_UNKNOWN" | "AGG_UNKNOWN" | "GROUP_UNKNOWN" | "NoError";
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
export declare const result_array: ResultRow[];
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
export {};
