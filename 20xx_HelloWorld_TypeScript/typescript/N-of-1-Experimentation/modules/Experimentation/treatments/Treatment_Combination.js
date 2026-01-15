export class Treatment_Combination {
    constructor(treatment_combination) {
        this.treatment_combination = [];
        this.treatment_combination = treatment_combination;
    }
    clone() {
        let ret = new Treatment_Combination([]);
        for (let treatment of this.treatment_combination) {
            ret.treatment_combination.push(treatment.clone());
        }
        return ret;
    }
}
