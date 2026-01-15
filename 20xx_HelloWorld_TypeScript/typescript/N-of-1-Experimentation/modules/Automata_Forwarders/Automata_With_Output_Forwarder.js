import { Automata_Forwarder } from "../Automata/Automata_Forwarder.js";
import { Automata } from "../Automata/Automata.js";
export function init() { }
/*
    I don't do anything - I am just a superclass
 */
export class Automata_With_Output_Forwarder extends Automata_Forwarder {
    constructor(forwarder_name, measurement, pre_run_instructions, post_run_instructions) {
        super(forwarder_name);
        this.pre_run_instructions = pre_run_instructions;
        this.post_run_instructions = post_run_instructions;
        this.measurement = measurement;
        this.automata = this.create_automata(); //new Automata(this.automata_configurator());
        this.automata.initialize();
    }
    set_active() {
        this.show_intro();
    }
    create_automata() {
        return new Automata(this.automata_configurator());
    }
    output_writer() {
        return this.measurement.output_writer();
    }
    show_intro() {
        this.output_writer().clear_all();
        this.output_writer().print_string_to_state(this.forwarder_name);
        this.pre_run_instructions();
    }
    empty_screen_and_show_instructions(command) {
        this.output_writer().clear_state();
        this.output_writer().clear_stage();
        if (command == null || command == undefined)
            console.log("something is strange");
        else
            command();
    }
}
