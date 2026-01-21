import { Experiment_Output_Writer, SET_SEED } from "./Experimentation.js";
import { key_event_string, save_file_in_html } from "../utils/Utils.js";
import { create_code_experiment_execution } from "./functions/create_code_experiment_execution.js";
export class Browser_Output_Writer extends Experiment_Output_Writer {
    print_experiment_name(s) {
        this.get_html_element_by_id("STATE").innerHTML = s;
    }
    clear_error() {
        let element_id = [
            "STAGE_ERROR"
        ];
        for (let e of element_id) {
            let parent = document.getElementById(e);
            while (parent.firstChild) {
                parent.removeChild(parent.firstChild);
            }
        }
    }
    clear_stage() {
        let element_id = [
            "STAGE",
            "STAGE_MSG",
            "STAGE_ERROR"
        ];
        for (let e of element_id) {
            let parent = document.getElementById(e);
            while (parent.firstChild) {
                parent.removeChild(parent.firstChild);
            }
        }
    }
    clear_state() {
        let element_id = [
            "STATE",
            "TASK"
        ];
        for (let e of element_id) {
            let parent = document.getElementById(e);
            while (parent.firstChild) {
                parent.removeChild(parent.firstChild);
            }
        }
    }
    print_error_string_on_stage(s) {
        let e = this.get_html_element_by_id("STAGE_ERROR");
        e.innerHTML = s;
    }
    get_html_element_by_id(s) {
        // @ts-ignore
        return document.getElementById(s);
    }
    print_string_to_state(s) {
        this.get_html_element_by_id("STATE").innerHTML = s;
    }
    print_string_on_stage(s) {
        this.print_html_on_stage("<p>" + s + "</p>");
    }
    ask_for_input() {
        let p = document.createElement("p");
        let l = document.createElement("label");
        l.setAttribute("type", "text");
        p.textContent = "Answer: ";
        p.appendChild(l);

        let i = document.createElement("input");
        i.setAttribute("type", "text");
        i.setAttribute("class", "input");
        p.appendChild(i);
        i.id = "INPUT";

        this.get_html_element_by_id("STAGE").appendChild(p);

        i.addEventListener("keydown", (e) => {
            if (e.key !== "Enter") return;

            if (i.value.trim().length === 0) {
                e.preventDefault();     
                e.stopPropagation();     
                this.clear_error?.();
                this.print_html_on_error("<p>Please enter an answer.</p>");
                i.focus();
            }
        });

        i.focus();
    }

    set_focus_on_input() {
        let i = this.get_html_element_by_id("INPUT");
        i.focus();
    }
    print_string_to_page_number(s) {
        this.get_html_element_by_id("TASK").innerHTML = s;
    }
    get_given_answer() {
        return this.get_html_element_by_id("INPUT").value;
    }
    print_on_input_response(given_answer) {
        this.get_html_element_by_id("INPUT").value = given_answer;
    }
    create_html_element_from_string(s) {
        let parser = new DOMParser();
        let elements = parser.parseFromString(s, "text/html").body;
        return elements;
    }
    print_html_on_stage(s) {
        // for(let e of this.create_html_element_from_string(s)) {
        this.get_html_element_by_id("STAGE")
            .appendChild(this.create_html_element_from_string(s));
        // }
    }
    print_html_on_error(s) {
        // for(let e of this.create_html_element_from_string(s)) {
        //     this.get_html_element_by_id("STAGE_ERROR")
        //         .appendChild(e);
        // }
        this.get_html_element_by_id("STAGE_ERROR")
            .appendChild(this.create_html_element_from_string(s));
    }
}
export function BROWSER_EXPERIMENT(creator) {
    let browser_output = new Browser_Output_Writer();
    let cfg = creator(browser_output);
    SET_SEED(cfg.seed);
    let this_measurement = cfg.measurement(browser_output);
    let experiment_automata = create_code_experiment_execution({
        experiment_name: cfg.experiment_name,
        seed: cfg.seed,
        introduction_pages: cfg.introduction_pages,
        post_questionnaire: cfg.post_questionnaire,
        pre_run_training_output: cfg.pre_run_training_instructions,
        training_configuration: cfg.training_configuration,
        pre_run_experiment_output: cfg.pre_run_experiment_instructions,
        finish_pages: cfg.finish_pages,
        layout: cfg.layout,
        repetitions: cfg.repetitions,
        task_configuration: cfg.task_configuration,
        measurement: this_measurement,
        finish_function: (exp) => {
            // @ts-ignore
            document.removeEventListener("keydown", key_forwarder);
            save_file_in_html(cfg.experiment_name + ".csv", exp.generate_csv_data());
        }
    });
    let key_forwarder = (e) => {
        let key_string = key_event_string(e);
        experiment_automata.input(key_string);
    };
    // @ts-ignore
    document.addEventListener("keydown", key_forwarder, false);
    if (cfg.pre_activation_function != undefined) {
        cfg.pre_activation_function(experiment_automata);
    }
    experiment_automata.set_active();
}
