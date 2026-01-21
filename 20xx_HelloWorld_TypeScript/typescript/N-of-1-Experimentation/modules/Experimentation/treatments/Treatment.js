export class Treatment {
    constructor(variable, value) {
        this.variable = variable;
        this.value = "" + value;
    }
    clone() {
        let ret = new Treatment(this.variable, this.value);
        return ret;
    }
}
