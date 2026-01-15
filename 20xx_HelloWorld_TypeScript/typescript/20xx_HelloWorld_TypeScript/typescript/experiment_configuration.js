/*

// experiment_configuration MAIN EXPERIMnENT

import { BROWSER_EXPERIMENT } from "../../N-of-1-Experimentation/modules/Experimentation/Browser_Output_Writer.js";
import {
    Experiment_Output_Writer,
    keys,
    random_array_element,
    Reaction_Time,
    SET_SEED,
} from "../../N-of-1-Experimentation/modules/Experimentation/Experimentation.js";
import { Task } from "../../N-of-1-Experimentation/modules/Experimentation/Task.js";

// ⬇️ Import the generator’s precomputed data (built at module import time)
import { formatted, Row } from "./generated_array.js";

let SEED = "42";
SET_SEED(SEED);

const results: Row[] = formatted;

function focusAnswerInput(clearValue: boolean = true) {
    const input = document.getElementById("ANSWER_INPUT") as HTMLInputElement | null;
    if (!input) return;

    if (clearValue) input.value = "";

    // Focus after the DOM updates / stage redraw
    requestAnimationFrame(() => {
        input.focus();
        input.select();
    });
}

let experiment_configuration_function = (writer: Experiment_Output_Writer) => {
    return {
        experiment_name: "CTE vs. Subqueries vs. Pipe",
        seed: SEED,

        introduction_pages: [
            () => {
                writer.print_string_on_stage("Hello world.");
                focusAnswerInput(true);
            }
        ],

        pre_run_training_instructions: writer.string_page_command(
            "You entered the training phase ABC."
        ),

        pre_run_experiment_instructions: writer.string_page_command(
            writer.convert_string_to_html_string("You entered the experiment phase ABC.")
        ),

        finish_pages: [
            writer.string_page_command(
                "<p>Almost done. Next, the experiment data will be downloaded (after pressing [Enter]).<br><br>" +
                "Please, send the downloaded file to the experimenter who will do the analysis</p>"
            ),
        ],

        layout: [
            { variable: "queryKind", treatments: ["sql", "pipe"] },

            {
                variable: "errorType",
                treatments: [
                    "AGG_UNKNOWN",
                    "GROUP_UNKNOWN",
                    "SELECT_UNKNOWN",
                    "DECOY"
                    // "NoError  & decoy dummy fuer noError
                ],
            },
            {
                variable: "totalInformationDifference",
                treatments: ["0", "4", "8"],
            },
        ],

        repetitions: 5,

        measurement: Reaction_Time(
            keys(["Enter"])),

        task_configuration: (t: Task) => {
            const current_queryKind = t.treatment_value("queryKind"); // "sql" | "pipe"
            const current_InformationDifference = Number(
                t.treatment_value("totalInformationDifference")
            );
            const current_errorType = t.treatment_value("errorType");

            const task: Row = random_array_element(
                results.filter(
                    (entry) =>
                        entry.totalInformationDifference === current_InformationDifference &&
                        entry.errorType === current_errorType
                )
            );

            t.do_print_task = () => {
                writer.clear_stage();

                // ✅ Choose which query to show based on the layout variable
                const queryText =
                    current_queryKind === "pipe" ? (task as any).pipeQuery : task.sqlQuery;

                const queryWithLineNumbers = queryText
                    .split("\n")
                    .map((line: string, index: number) => {
                        const lineNumber = index + 1;
                        const lineNumberStr = lineNumber.toString().padStart(3, " ");
                        return `${lineNumberStr} | ${line}`;
                    })
                    .join("\n");

                writer.print_html_on_stage(
                    "<pre><code>" +
                    writer.convert_string_to_html_string(queryWithLineNumbers) +
                    "</code></pre>"
                );

                // ✅ NEW: ensure the input is focused for every new task
                focusAnswerInput(true);
            };

            t.expected_answer = JSON.stringify(
                current_queryKind === "pipe" ? task.errorLinePipe : task.errorLineSQL
            );

            t.do_print_after_task_information = () => {
                writer.print_html_on_stage(
                    "<h3>" +
                    writer.convert_string_to_html_string(
                        JSON.stringify(task.totalInformationUntilErrorPipe)
                    ) +
                    "</h3>" +
                    "<h3>" +
                    writer.convert_string_to_html_string(
                        JSON.stringify(task.totalInformationUntilErrorSQL)
                    ) +
                    "</h3>" +
                    "<h3>" +
                    writer.convert_string_to_html_string(
                        JSON.stringify(task.totalInformationDifference)
                    ) +
                    "</h3>" +
                    "<h3>" +
                    writer.convert_string_to_html_string(JSON.stringify(task.unknownName)) +
                    "</h3>" +
                    "<h3>" +
                    writer.convert_string_to_html_string(
                        JSON.stringify(task.errorLinePipe)
                    ) +
                    "</h3>" +
                    "<h3>" +
                    writer.convert_string_to_html_string(
                        JSON.stringify(task.errorLineSQL)
                    ) +
                    "</h3>"
                );

                // optional: keep focus after the after-task info too
                focusAnswerInput(false);
            };
        },
    };
};

BROWSER_EXPERIMENT(experiment_configuration_function);
*/
// experiment_configuration PRELIMINARY
import { BROWSER_EXPERIMENT } from "../../N-of-1-Experimentation/modules/Experimentation/Browser_Output_Writer.js";
import { keys, random_array_element, Reaction_Time, SET_SEED, } from "../../N-of-1-Experimentation/modules/Experimentation/Experimentation.js";
import { result_array } from "./sqlGeneratorPrelimExp.js";
let SEED = "42";
SET_SEED(SEED);
const results = result_array;
let experiment_configuration_function = (writer) => {
    return {
        experiment_name: "CTE Formatting",
        seed: SEED,
        introduction_pages: [
            () => {
                writer.print_string_on_stage("Hello world.");
            }
        ],
        pre_run_training_instructions: writer.string_page_command("You entered the training phase ABC."),
        pre_run_experiment_instructions: writer.string_page_command(writer.convert_string_to_html_string("You entered the experiment phase ABC.")),
        finish_pages: [
            writer.string_page_command("<p>Almost done. Next, the experiment data will be downloaded (after pressing [Enter]).<br><br>" +
                "Please, send the downloaded file to the experimenter who will do the analysis</p>"),
        ],
        layout: [
            { variable: "inlineSelect", treatments: ["true", "false"] },
        ],
        repetitions: 50,
        measurement: Reaction_Time(keys(["2", "3", "4"])),
        task_configuration: (t) => {
            const current_selectInlineNewline = t.treatment_value("inlineSelect"); // "sql" | "pipe"
            const task = random_array_element(results.filter((entry) => JSON.stringify(entry.inlineSelect) === current_selectInlineNewline));
            t.do_print_task = () => {
                writer.clear_stage();
                writer.print_html_on_stage("<h3>" +
                    writer.convert_string_to_html_string(task.selectedAggregateSql) +
                    "</h3>" +
                    "<pre><code>" +
                    writer.convert_string_to_html_string(task.sqlQuery) +
                    "</code></pre>");
            };
            t.expected_answer = task.selectedAggregateCteNumber.toString();
            t.do_print_after_task_information = () => {
                writer.print_html_on_stage("<h3>" +
                    writer.convert_string_to_html_string(JSON.stringify(task.selectedAggregateCteNumber)) +
                    "</h3>");
            };
        },
    };
};
BROWSER_EXPERIMENT(experiment_configuration_function);
