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
export type QueryKind = "sql" | "pipe";
export type Entry = Row & {
    queryKind: QueryKind;
};
export declare const resultArray20Reps: Row[];
export declare const formatted: Row[];
