import { contains } from "../utils/Utils.js";
export function init() { }
export class Automata {
    constructor(config) {
        this.current_state = -1;
        this.transitions = [];
        this.states = [];
        this.start_state = config.start;
        this.states = config.states;
        for (let i = 0; i < this.states.length; i++) {
            this.transitions.push([]);
        }
        for (let t of config.transitions) {
            if (this.transitions == null) {
                console.log("Something is wrong here");
            }
            if (this.transitions == undefined || t.from == undefined) {
                console.log("Something is wrong here");
            }
            if (this.transitions[t.from] == undefined) {
                console.log("Something is wrong here");
            }
            try {
                this.transitions[t.from].push(t);
            }
            catch (e) {
                console.log("weird");
            }
        }
        this.init_function = config.init_function;
        this.end_states = config.end_states;
    }
    // on_finish_function: (number) => void;
    input(input) {
        let matching_transition = this.first_match(input);
        let state_before = this.current_state;
        if (matching_transition != null) {
            this.current_state = matching_transition.next_state; // go to next state
            matching_transition.action(state_before, input, this.current_state); // go to next state
        }
    }
    start() {
        this.current_state = this.start_state;
    }
    first_match(input) {
        for (let i = 0; i < this.transitions[this.current_state].length; i++) {
            if (this.transitions[this.current_state][i].accepts(input))
                return this.transitions[this.current_state][i];
        }
        return null;
    }
    initialize() {
        this.current_state = this.start_state;
        this.init_function();
    }
    add_finish_action(action) {
        for (let transitions of this.transitions) {
            for (let transition of transitions) {
                if (this.is_transition_to_end(transition)) {
                    let former_action = transition.action;
                    transition.action = (from, input, next) => {
                        former_action(from, input, next);
                        action();
                    };
                }
            }
        }
    }
    is_transition_to_end(transition) {
        return contains(this.end_states, transition.next_state);
    }
    add_action_to_transitions(is_target_transition, action) {
        for (let transitions of this.transitions) {
            for (let transition of transitions) {
                if (is_target_transition(transition)) {
                    let former_action = transition.action;
                    transition.action = (from, input, next) => {
                        former_action(from, input, next);
                        action();
                    };
                }
            }
        }
    }
}
