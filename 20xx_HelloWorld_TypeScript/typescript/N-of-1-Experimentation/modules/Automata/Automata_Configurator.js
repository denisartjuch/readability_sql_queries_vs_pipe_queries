import { Automata } from "./Automata.js";
export function init() { }
export class Automata_Configurator {
    constructor(states, start, init_function, transitions, end_states) {
        this.states = states;
        this.start = start;
        this.init_function = init_function;
        this.transitions = transitions;
        this.end_states = end_states;
    }
}
export function create_automata(states, start, init_function, transitions, end_states) {
    return new Automata(new Automata_Configurator(states, start, init_function, transitions, end_states));
}
