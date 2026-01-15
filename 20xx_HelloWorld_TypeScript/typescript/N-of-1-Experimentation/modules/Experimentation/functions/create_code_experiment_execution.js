import { Treatments_Combinator } from "../treatments/Treatments_Combinator.js";
import { Code_Experiment_Definition } from "../Code_Experiment_Definition.js";
import { Training_Configuration } from "../Training_Configuration.js";
import { Independent_Variables } from "../treatments/Independent_Variables.js";
export function create_code_experiment_execution(cfg) {
    let variables = Independent_Variables.from_layout(cfg.layout);
    let all_treatment_combinations = new Treatments_Combinator(variables, cfg.repetitions);
    let experiment_definition = new Code_Experiment_Definition(cfg.experiment_name, false, all_treatment_combinations, variables, cfg.repetitions, cfg.measurement, cfg.task_configuration);
    let training_configuration = new Training_Configuration(cfg.training_configuration);
    let experiment_execution = experiment_definition.create_code_all_experiment_automatas({
        seed: cfg.seed,
        introduction_texts: cfg.introduction_pages,
        post_questionnaire: cfg.post_questionnaire,
        pre_run_training_output: cfg.pre_run_training_output,
        training_configuration: training_configuration,
        // post_run_training_output: cfg.post_run_training_output,
        pre_run_experiment_output: cfg.pre_run_experiment_output,
        // post_run_experiment_output: cfg.post_run_experiment_output,
        finish_texts: cfg.finish_pages,
        measurement: cfg.measurement,
        finish_function: cfg.finish_function
    });
    return experiment_execution;
}
