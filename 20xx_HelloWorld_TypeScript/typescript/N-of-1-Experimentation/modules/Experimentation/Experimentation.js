import dummy from "../../modules_hard_import/seedrandom/seedrandom.js";
import { convert_string_to_html_string } from "../utils/Utils.js";
import { Alternatives, Freetext, Information } from "../Automata_Forwarders/Questionnaire_Forwarder.js";
export function init() { }
export var VARIABLE_TYPE;
(function (VARIABLE_TYPE) {
    VARIABLE_TYPE[VARIABLE_TYPE["STRING"] = 1] = "STRING";
    VARIABLE_TYPE[VARIABLE_TYPE["NUMBER"] = 2] = "NUMBER";
})(VARIABLE_TYPE || (VARIABLE_TYPE = {}));
export function Reaction_Time(input) {
    return (writer) => new Reaction_Time_Measurement(input(writer));
}
;
export function Reaction_Time_With_Penalty(input, penalty_seconds) {
    return (writer) => new Reaction_Time_Penalty_Measurement(input(writer), penalty_seconds);
}
;
export function Time_to_finish(input) {
    return (writer) => new Time_To_Finish_Measurement(input(writer));
}
export function Time_to_finish_with_Penalty(input, penalty_seconds) {
    return (writer) => new Time_To_Finish_With_Time_Penalty_Measurement(input(writer), penalty_seconds);
}
export function keys(key_list) {
    return (writer) => new Key_Pressing(key_list, writer);
}
export function keys_0_to_9() {
    return (writer) => new Key_Pressing(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"], writer);
}
export function text_input_experiment(output_writer) {
    return new Free_Text_User_Input_Experiment(output_writer);
}
export function text_input_experiment_with_pre_post_label(pre, post) {
    return (output_writer) => new Free_Text_User_Input_Experiment_With_PrePost(output_writer, pre, post);
}
export function information(question) {
    return new Information(question);
}
export function free_text(var_name, question) {
    return new Freetext(var_name, question);
}
export function alternatives(var_name, question, alternatives) {
    return new Alternatives(var_name, question, alternatives);
}
export class Experiment_Output_Writer {
    convert_string_to_html_string(s) {
        return convert_string_to_html_string(s);
    }
    string_page_command(s) {
        return () => this.print_string_on_stage(s);
    }
    stage_string_pages_commands(pages) {
        let ret = [];
        for (let a of pages) {
            ret.push(this.string_page_command(a));
        }
        return ret;
    }
    get_given_answer(input) {
        return input;
    }
    print_on_input_response(given_answer) { }
    set_focus_on_input() { }
    clear_all() {
        this.clear_state();
        this.clear_stage();
    }
}
export class Measurement_Type {
    constructor(input_type) {
        this.input_type = input_type;
    }
    accepted_responses() {
        return this.input_type.accepted_responses();
    }
    given_answer(i) {
        return this.input_type.given_answer(i);
    }
    start_measurement(task) {
        this.start_time = new Date().getTime().valueOf();
        task.print_task();
    }
    stop_measurement(input, task) {
        let end_time = new Date().getTime().valueOf();
        task.given_answer = this.input_type.get_given_answer(input);
        task.required_milliseconds = end_time - this.start_time;
        task.do_print_after_task_information();
    }
    incorrect_response(i, task) {
        let end_time = new Date().getTime().valueOf();
        let given_answer = task.experiment_definition.measurement.get_given_answer(i);
        task.invalid_answers.push([given_answer, end_time - this.start_time]);
        task.do_print_error_message(this.input_type.get_given_answer(i));
    }
    output_writer() {
        return this.input_type.output_writer;
    }
    get_given_answer(input) {
        return this.input_type.get_given_answer(input);
    }
    demands_penalty() {
        return false;
    }
    penalty_is_over() {
        return true;
    }
}
export class Reaction_Time_Measurement extends Measurement_Type {
    constructor(input_type) {
        super(input_type);
    }
}
export class Reaction_Time_Penalty_Measurement extends Measurement_Type {
    constructor(input_type, penalty_seconds) {
        super(input_type);
        this.penalty_started = false;
        this.penalty_start_point = null;
        this.penalty_miliseconds = penalty_seconds * 1000;
    }
    demands_penalty() {
        return true;
    }
    incorrect_response(i, task) {
        super.incorrect_response(i, task);
        this.penalty_started = true;
        this.penalty_start_point = new Date().getTime().valueOf();
        task.do_print_error_message(this.input_type.get_given_answer(i));
    }
    delete_penalty() {
        this.penalty_started = false;
        this.penalty_start_point = null;
    }
    penalty_is_over() {
        let diff = (new Date().getTime().valueOf()) - this.start_time;
        return !this.penalty_started || diff >= this.penalty_miliseconds;
    }
    start_measurement(task) {
        super.start_measurement(task);
        this.delete_penalty();
    }
}
export class Time_To_Finish_Measurement extends Measurement_Type {
    constructor(input_type) {
        super(input_type);
    }
}
export class Time_To_Finish_With_Time_Penalty_Measurement extends Time_To_Finish_Measurement {
    constructor(input_type, penalty_seconds) {
        super(input_type);
        this.penalty_started = false;
        this.penalty_start_point = null;
        this.penalty_miliseconds = penalty_seconds * 1000;
    }
    demands_penalty() {
        return true;
    }
    incorrect_response(i, task) {
        super.incorrect_response(i, task);
        this.penalty_started = true;
        this.penalty_start_point = new Date().getTime().valueOf();
        task.do_print_error_message(this.input_type.get_given_answer(i));
    }
    delete_penalty() {
        this.penalty_started = false;
        this.penalty_start_point = null;
    }
    penalty_is_over() {
        let diff = (new Date().getTime().valueOf()) - this.start_time;
        return !this.penalty_started || diff >= this.penalty_miliseconds;
    }
    start_measurement(task) {
        super.start_measurement(task);
        this.delete_penalty();
    }
}
export class Experiment_Input_Type {
    constructor(output_writer) {
        this.output_writer = output_writer;
    }
    print_input_request() {
        this.output_writer.ask_for_input();
    }
    get_given_answer(input_string) {
        let value = this.output_writer.get_given_answer(input_string);
        return value;
    }
}
export class Key_Pressing extends Experiment_Input_Type {
    constructor(accepted_keys, output_writer) {
        super(output_writer);
        this.accepted_keys = accepted_keys;
    }
    accepted_responses() {
        return this.accepted_keys;
    }
    given_answer(key_pressed) {
        return key_pressed;
    }
    print_input_request() {
        // I am a key....no need for input fields
    }
    get_given_answer(input_string) {
        return input_string;
    }
}
export class Free_Text_User_Input_Experiment extends Experiment_Input_Type {
    constructor(output_writer) {
        super(output_writer);
    }
    accepted_responses() {
        return ["Enter"];
    }
    given_answer(key_pressed) { }
    print_input_request() {
        this.output_writer.ask_for_input();
    }
}
export class Free_Text_User_Input_Experiment_With_PrePost extends Experiment_Input_Type {
    constructor(output_writer, pre, post) {
        super(output_writer);
    }
    accepted_responses() {
        return ["Enter"];
    }
    given_answer(key_pressed) { }
    print_input_request() {
        this.output_writer.ask_for_input();
    }
}
class _Random {
    constructor() {
        // @ts-ignore
        Math.seedrandom('1234567890');
    }
    // @ts-ignore
    new_random_integer(upper_limit) {
        return Math.trunc(upper_limit * Math.random());
    }
    set_seed(seed) {
        // @ts-ignore
        Math.seedrandom(seed);
    }
}
export const Random = new _Random();
export function SET_SEED(seed) {
    Random.set_seed(seed);
}
export function random_integer_up_to_excluding(upper_limit) {
    return Random.new_random_integer(upper_limit);
}
export function do_random_array_sort(array) {
    let copy = [...array];
    let result = [];
    while (copy.length > 0) {
        result.push(copy.splice(random_integer_up_to_excluding(copy.length), 1)[0]);
    }
    return result;
}
export function random_array_element_and_remove(array) {
    let position = random_integer_up_to_excluding(array.length);
    let ret = array[position];
    array.splice(position, 1);
    return ret;
}
export function random_array_element(array) {
    return array[random_integer_up_to_excluding(array.length)];
}
export function random_array_element_without(array, exceptions) {
    let copy = array.filter(e => !exceptions.includes(e));
    return random_array_element(copy);
}
export function random_array_elements_without_repetitions(array, number_of_elements_to_chose) {
    let randomly_sorted_array = do_random_array_sort(array);
    return randomly_sorted_array.slice(0, number_of_elements_to_chose);
}
export function random_lower_case_letter() {
    return String.fromCharCode(97 + random_integer_up_to_excluding(26));
}
export function random_lower_case_letter_except(letters) {
    while (true) {
        let ret = String.fromCharCode(97 + random_integer_up_to_excluding(26));
        if (!letters.includes(ret))
            return ret;
    }
}
export function random_upper_case_letter_except(letters) {
    while (true) {
        let ret = String.fromCharCode(97 + random_integer_up_to_excluding(26)).toUpperCase();
        if (!letters.includes(ret))
            return ret;
    }
}
// This invocation just makes sure that RANDOM is loaded
dummy();
