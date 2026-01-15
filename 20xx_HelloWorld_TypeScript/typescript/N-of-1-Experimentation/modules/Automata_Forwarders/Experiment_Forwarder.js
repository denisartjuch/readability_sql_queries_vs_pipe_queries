import { Experimentation_Forwarder } from "./Experimentation_Forwarder.js";
export class Experiment_Forwarder extends Experimentation_Forwarder {
    constructor(pre_run_instructions, experiment_definition, measurement) {
        super("Main Experiment", () => {
            pre_run_instructions();
            measurement.output_writer().print_html_on_stage("<hr>" +
                "Press [Enter] to start the experiment.");
        }, () => {
            measurement.output_writer().print_html_on_stage("You finished the experiment phase.<hr>" +
                "Please, press [Enter] to go to the next phase.<br>");
        }, experiment_definition, measurement);
    }
}
