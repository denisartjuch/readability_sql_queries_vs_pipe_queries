export class Automata_Forwarder {
    constructor(forwarder_name) {
        this.set_active_function = () => { };
        this.forwarder_name = forwarder_name;
    }
    input(s) {
        this.automata.input(s);
    }
    add_activation_function(to_add) {
        // let old_activation_function = this.set_active_function;
        // this.set_active_function = () => {
        //     old_activation_function();
        //     to_add();
        // }
    }
    set_active() { }
}
