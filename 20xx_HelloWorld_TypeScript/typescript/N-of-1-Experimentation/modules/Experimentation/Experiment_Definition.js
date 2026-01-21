export function init() { }
export class Experiment_Definition {
    constructor(experiment_name, is_training, treatments_combinator, variables, repetitions, measurement, task_creator) {
        this.questionnaires = [];
        this.tasks = [];
        this.experiment_name = experiment_name;
        this.is_training = is_training;
        this.template = { experiment_name: experiment_name, variables: variables, repetitions: repetitions, task_creator: task_creator };
        this.treatments_combinator = treatments_combinator;
        this.variables = variables;
        this.measurement = measurement;
        this.experiment_definition_task_creator = task_creator;
    }
    init_experiment(is_training) {
        this.tasks = this.treatments_combinator.create_tasks(this);
    }
    all_independent_variables() {
        return this.variables.independent_variables;
    }
    generate_csv_data() {
        let result = [];
        // let questionnaire_variables = this.questionnaire_responses = cfg.questionnaire.filter((e: Input_Object)=> !(e instanceof Information)).map((e: Input_Object)=>e.variable);
        for (let questionnaire of this.questionnaires) {
            for (let question of questionnaire.questions) {
                result.push("\"" + question.variable_name + "\"" + ";");
            }
        }
        this.variables.print_to_array(result);
        result.push("number_of_given_answers;expected_answer;given_answer;is_correct;time_in_milliseconds;task_id;\n");
        for (let task of this.tasks) {
            for (let questionnaire of this.questionnaires) {
                for (let question of questionnaire.questions) {
                    result.push("\"" + question.answer + "\"" + ";");
                }
            }
            for (let treatment_combination of task.treatment_combination.treatment_combination) {
                result.push(treatment_combination.value + ";");
            }
            result.push((task.invalid_answers.length + 1) + ";");
            result.push(task.expected_answer + ";");
            result.push(task.given_answer + ";");
            result.push("" + (task.given_answer == task.expected_answer) + ";");
            result.push(task.required_milliseconds + ";");
            result.push(task.task_id + ";");
            task.invalid_answers.forEach((a) => result.push(a[0] + ";" + a[1] + ";"));
            result.push("\n");
        }
        return result; /*this comment just needed for a commit.....*/
    }
}
