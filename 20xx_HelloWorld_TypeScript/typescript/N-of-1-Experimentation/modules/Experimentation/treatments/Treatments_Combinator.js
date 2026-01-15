import { Task } from "../Task.js";
import { do_random_array_sort } from "../Experimentation.js";
/**
 * All experiment definitions contain the treatment combinations (including repetitions)
 */
export class Treatments_Combinator {
    constructor(variables, repetitions) {
        this.variables = variables;
        this.repetitions = repetitions;
    }
    clone() {
        return new Treatments_Combinator(this.variables, this.repetitions);
    }
    create_treatment_combinations() {
        let treatment_combinations = [];
        for (let r = 0; r < this.repetitions; r++) {
            treatment_combinations = treatment_combinations.concat(this.variables.create_treatment_combinations());
        }
        return treatment_combinations;
    }
    create_tasks(experiment_definition) {
        let tasks = [];
        for (let treatment_combination of this.create_treatment_combinations()) {
            let task = new Task(treatment_combination.clone(), experiment_definition, "");
            try {
                experiment_definition.experiment_definition_task_creator(task);
            }
            catch (ex) {
                console.log("halt");
                experiment_definition.experiment_definition_task_creator(task);
            }
            task.is_training = experiment_definition.is_training;
            tasks.push(task);
        }
        return do_random_array_sort(tasks);
    }
    get_variable_named(var_name) {
        return this.variables.get_variable_named(var_name);
    }
}
