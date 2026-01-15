import { Treatment } from "./Treatment.js";
export class Independent_Variable {
    constructor(name, treatments) {
        this.treatments = [];
        this.name = name;
        for (let aString of treatments) {
            this.treatments.push(new Treatment(this, aString));
        }
    }
}
