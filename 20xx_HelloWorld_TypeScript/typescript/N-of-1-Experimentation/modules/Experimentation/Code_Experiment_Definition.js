import { Experiment_Definition } from "./Experiment_Definition.js";
import { Book_Forwarder } from "../Automata_Forwarders/Book_Forwarder.js";
import { Sequential_Forwarder_Forwarder } from "../Books/Sequential_Forwarder_Forwarder.js";
import { Training_Execution_Forwarder } from "../Automata_Forwarders/Training_Execution_Forwarder.js";
import { Experiment_Forwarder } from "../Automata_Forwarders/Experiment_Forwarder.js";
import { Questionnaire_Forwarder } from "../Automata_Forwarders/Questionnaire_Forwarder.js";
export function init() { }
// TODO: Both classes should be one!!!
// ASAP!!!!
export class Code_Experiment_Definition extends Experiment_Definition {
    create_code_all_experiment_automatas(cfg) {
        let output_writer = cfg.measurement.output_writer();
        let introduction_book = new Book_Forwarder("Introduction", cfg.introduction_texts, cfg.measurement);
        let ending_book = new Book_Forwarder("Finish", cfg.finish_texts, cfg.measurement);
        ending_book.automata.add_finish_action(() => cfg.finish_function(experiment_execution_forwarder.experiment_definition));
        let experiment_execution_forwarder = new Experiment_Forwarder(cfg.pre_run_experiment_output, this, cfg.measurement);
        experiment_execution_forwarder.init_experiment();
        let cloned_experiment_definition = this.clone();
        let training_forwarder = new Training_Execution_Forwarder(cfg.pre_run_training_output, cfg.training_configuration, cloned_experiment_definition, cfg.measurement);
        training_forwarder.init_experiment();
        let post_questionnaire = null;
        if (cfg.post_questionnaire != undefined) {
            post_questionnaire = new Questionnaire_Forwarder(cfg.post_questionnaire, cfg.measurement);
        }
        let forwarders = [];
        if (introduction_book != null) {
            forwarders.push(introduction_book);
        }
        if (training_forwarder.experiment_definition.tasks.length != 0)
            forwarders.push(training_forwarder);
        forwarders.push(experiment_execution_forwarder);
        if (post_questionnaire != null) {
            forwarders.push(post_questionnaire);
            experiment_execution_forwarder.experiment_definition.questionnaires.push(post_questionnaire);
        }
        forwarders.push(ending_book);
        let forwarder = new Sequential_Forwarder_Forwarder(forwarders);
        return forwarder;
    }
    // WHATEVER HAPPENS ON EARTH - THIS SHOULD ONLY BE USED FOR TRAINING!
    clone() {
        let clone = new Code_Experiment_Definition(this.template.experiment_name, this.is_training, this.treatments_combinator.clone(), this.template.variables, this.template.repetitions, this.measurement, this.template.task_creator);
        return clone;
    }
}
