function all_array_combinations_internal(arr, combination, f) {
    if (arr.length == 0) {
        f(combination);
    }
    else {
        let last = arr.shift();
        for (let e of last) {
            combination.push(e);
            all_array_combinations_internal(arr, combination, f);
            combination.pop();
        }
        arr.unshift(last);
    }
}
/**
 *  @param arr: An array of arrays
 *  executes for all combinations of arrays the function f
 */
export function all_array_combinations(arr, f) {
    all_array_combinations_internal(arr, [], f);
}
/**
 * Examples:
 *   all_x_tupel(1, [1, 2, 3]) = [1, 2, 3]
 *   all_x_tupel(2, [1, 2, 3]) = [[1, 1], [1,2]], [1,3], [2,1]....[3,3]]

 */
export function all_x_tupel(tupel_length, arr) {
    let result = [];
    if (tupel_length == 1) {
        for (let e of arr) {
            result.push([e]);
        }
        return result;
    }
    let x_minus_one_tupel = all_x_tupel(tupel_length - 1, arr);
    for (let e of arr) {
        for (let a_x_minux_one_tupel of x_minus_one_tupel) {
            result.push([e, ...a_x_minux_one_tupel]);
        }
    }
    return result;
}
/**
 * Examples:
 *   all_different_x_tupel(3, [1, 2, 3]) = [[1, 2, 3], [1,3,2], [2,1,3], [2,3,1]. [3,1,2], [3,2,1]]
 *
*/
export function all_different_x_tupel(tupel_length, arr) {
    let result = [];
    if (tupel_length == 1) {
        for (let e of arr) {
            result.push([e]);
        }
        return result;
    }
    for (let e = 0; e < arr.length; e++) {
        let arr_without_current_element = arr.slice();
        arr_without_current_element.splice(e, 1);
        let x_minus_one_tupel = all_different_x_tupel(tupel_length - 1, arr_without_current_element);
        for (let a_x_minux_one_tupel of x_minus_one_tupel) {
            result.push([arr[e], ...a_x_minux_one_tupel]);
        }
    }
    return result;
}
