export class Task {
    constructor(tc, experiment_definition, text) {
        this.expected_answer = "";
        this.given_answer = "";
        this.task_id = "";
        this.required_milliseconds = null;
        this.task_number_in_execution = -1;
        this.invalid_answers = [];
        this.is_training = false;
        this.has_pre_task_description = false;
        this.do_print_task = () => {
            throw new Error("Method not implemented.");
        };
        this.do_print_pre_task = () => {
            throw new Error("Method not implemented.");
        };
        this.do_print_error_message = () => {
            throw new Error("Method not implemented.");
        };
        this.accepts_answer_function = (answer) => true;
        this.do_print_after_task_information = () => {
            throw new Error("Method not implemented.");
        };
        this.treatment_combination = tc;
        this.experiment_definition = experiment_definition;
        // this.code_string(text);
    }
    accepts_answer(input) {
        let answer = this.experiment_definition.measurement.get_given_answer(input);
        return this.accepts_answer_function(answer);
    }
    next_task() {
        if (this.task_number_in_execution < this.experiment_definition.tasks.length)
            return this.experiment_definition.tasks[this.task_number_in_execution];
        else
            return null;
    }
    html_string_with_cmd(html_string, cmd) {
        // this.write_action = (writer: Automata_IO) => {
        //     writer.write(AUTOMATA_OUTPUT_WRITER_ACTION.OVERWRITE, AUTOMATA_OUTPUT_WRITER_TAGS.STAGE, html_line(html_string));
        //     cmd();
        // }
    }
    html_node_with_cmd(element, cmd) {
        // this.write_action = (writer: Automata_IO) => {
        //     writer.write(AUTOMATA_OUTPUT_WRITER_ACTION.OVERWRITE, AUTOMATA_OUTPUT_WRITER_TAGS.STAGE, html_node(element));
        //     cmd();
        // }
    }
    after_task_string_constructor(a_string_constructor) {
        // this.after_task_write_action = () => (writer: Automata_IO) =>writer.write(AUTOMATA_OUTPUT_WRITER_ACTION.APPEND, AUTOMATA_OUTPUT_WRITER_TAGS.STAGE, text_line(a_string_constructor()));
    }
    print_task() {
        this.do_print_task();
        this.print_input_request();
    }
    print_pre_task_info() {
        this.do_print_pre_task();
    }
    print_input_request() {
        this.experiment_definition.measurement.input_type.print_input_request();
    }
    treatment_value(treatment_name) {
        for (let treatment of this.treatment_combination.treatment_combination)
            if (treatment.variable.name === treatment_name)
                return treatment.value;
        throw "Unknown treatment: " + treatment_name;
    }
    set_computed_variable_value(variable_name, value) {
        for (let treatment of this.treatment_combination.treatment_combination)
            if (treatment.variable.name === variable_name) {
                treatment.value = value;
                return;
            }
        throw "Unknown treatment: " + variable_name;
    }
}
