export function iterate_with_counter(array, f) {
    let counter = 0;
    for (let e of array) {
        f(e, counter++);
    }
}
export function iterate_both(a1, a2, f) {
    if (a1.length > a2.length)
        throw "Cannot loop both: first array has length: " + a1.length + ", but second has length " + a2.length;
    let counter = 0;
    for (let e of a1) {
        f(e, a2[counter++]);
    }
}
export function iterate_matrix(matrix, f) {
    iterate(matrix).do_with_counter((row, row_no) => {
        iterate(matrix[row_no]).do_with_counter((element, column_no) => {
            f(element, row_no, column_no);
        });
    });
}
export function iterate(array) {
    return new Iterator(array);
}
export class Iterator {
    constructor(array) {
        this.array = array;
    }
    do(f) {
        for (let element of this.array)
            f(element);
    }
    do_with_counter(f) {
        for (let c = 0; c < this.array.length; c++) {
            f(this.array[c], c);
        }
    }
}
export function repeat(n, f) {
    for (let c = 0; c < n; c++) {
        f(c);
    }
    // return new Repeat(0)
}
export function repeat_n_times(n) {
    return new Repeat(n);
}
export function repeat_(n) {
    return new Repeat(n);
}
export class Repeat {
    constructor(counter) {
        this.counter = counter;
    }
    and_collect(f) {
        let arr = [];
        for (let c = 1; c <= this.counter; c++) {
            arr.push(f(c));
        }
        return arr;
    }
    _times(f) {
        for (let c = 1; c <= this.counter; c++) {
            f();
        }
    }
    times(f) {
        for (let c = 1; c <= this.counter; c++) {
            f(c);
        }
    }
    _do(f) {
        for (let c = 1; c <= this.counter; c++) {
            f(c);
        }
    }
}
