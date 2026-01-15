import { contains } from "../utils/Utils.js";
export function init() { }
class Transition_Acceptor {
}
class Transition_Strings_Acceptor extends Transition_Acceptor {
    constructor(strings) {
        super();
        this.accepted_strings = strings;
    }
    accepts(input) {
        return contains(this.accepted_strings, input);
    }
}
export class Transition_Acceptor_Function extends Transition_Acceptor {
    constructor(acceptor_function) {
        super();
        this.acceptor_function = acceptor_function;
    }
    accepts(input) {
        return this.acceptor_function(input);
    }
}
class Transition_Strings_Accepts_ALL extends Transition_Acceptor {
    accepts(input) {
        return true;
    }
}
export function keys(strings) {
    return new Transition_Strings_Acceptor(strings);
}
export function if_func(f) {
    return new Transition_Acceptor_Function(f);
}
export function each_char(charlist) {
    var chars = [];
    for (let a of charlist) {
        chars.push(a);
    }
    return new Transition_Strings_Acceptor(chars);
}
export class Transition {
    constructor(from, acceptor, next_state, action) {
        this.from = from;
        this.acceptor = acceptor;
        this.next_state = next_state;
        this.action = action;
    }
    ;
    is_valid_input(input) {
        return this.acceptor.accepts(input);
    }
    accepts(input) {
        return this.acceptor.accepts(input);
    }
}
export function Simple_Transition(from, accept_input_function, next_state, action) {
    return new Transition(from, new Transition_Acceptor_Function(accept_input_function), next_state, (s, i, n) => action(i));
}
export function accept_all() {
    return new Transition_Strings_Accepts_ALL();
}
export function do_nothing(at, input, next) { }
export function pass(f) {
    return (at, input, next) => f();
}
export function from(from) {
    return {
        to: (to) => {
            return {
                on: (key) => {
                    return {
                        if: (check) => {
                            return {
                                do: (action) => {
                                    return Simple_Transition(from, (input) => { return input == key && check(input); }, to, action);
                                }
                            };
                        },
                        do: (action) => {
                            return Simple_Transition(from, (input) => { return input == key; }, to, action);
                        }
                    };
                },
                on_any: (keys) => {
                    return {
                        if: (check) => {
                            return {
                                do: (action) => {
                                    return Simple_Transition(from, (input) => {
                                        return contains(keys, input) && check(input);
                                    }, to, action);
                                }
                            };
                        },
                        do: (action) => {
                            return Simple_Transition(from, (input) => { return contains(keys, input); }, to, action);
                        }
                    };
                }
            };
        },
    };
}
