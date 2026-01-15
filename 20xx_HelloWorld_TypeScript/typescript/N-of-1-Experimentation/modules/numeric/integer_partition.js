/*
Partitions a given integer into its parts - including all combinations
eg: (1) => (1)
    (2) => (2), (1, 1)
    (3) => (3), (2, 1), (1, 2), (1, 1, 1)
    (4) => (1, 1, 1, 1), (1, 1, 2), (1, 2, 1), (1, 3), (2, 1, 1), (2, 2), (3, 1), (4)
 */
import { repeat } from "../utils/loops/loop.js";
import { random_integer_up_to_excluding } from "../Experimentation/Experimentation.js";
export function random_integer_partition(n, number_of_partitions) {
    let partitions = [];
    repeat(number_of_partitions, n => partitions.push(1));
    repeat(n - number_of_partitions, _ => partitions[random_integer_up_to_excluding(number_of_partitions)] += 1);
    return partitions;
}
export function random_integer_partition_with_exclusion_criterion(n, number_of_partitions, exclusion_criterion) {
    let partitions;
    do {
        partitions = random_integer_partition(n, number_of_partitions);
    } while (is_invalid(partitions, exclusion_criterion));
    return partitions; /* ============ */
    function is_invalid(partitions, criterion) {
        for (let partition of partitions) {
            if (criterion(partition))
                return true;
        }
        return false;
    }
}
export function integer_partition_function(n) {
    let ret = [];
    if (n == 0)
        return [];
    for (let i = 1; i <= n; i++) {
        let partitions = integer_partition_function(n - i);
        for (let part of partitions) {
            let row = [i];
            for (let r of part) {
                row.push(r);
            }
            ret.push(row);
        }
        if (partitions.length == 0)
            ret.push([n]);
    }
    return ret;
}
export function integer_partitions_of_fix_length_with_constraint(n, number_of_partitions, constraint_function) {
    let partitions = integer_partitions_of_fix_length(n, number_of_partitions);
    let valid_partitions = [];
    for (let part of partitions) {
        let is_valid = true;
        for (let e of part) {
            if (!constraint_function(e)) {
                is_valid = false;
                break;
            }
        }
        if (is_valid) {
            if (part.length != number_of_partitions)
                console.log("strange");
            if (part.length != number_of_partitions) {
                throw "wtf";
            }
            valid_partitions.push(part);
        }
    }
    return valid_partitions;
}
export function integer_partitions_of_fix_length(n, number_of_partitions) {
    if (number_of_partitions == 1)
        return [[n]];
    let ret = [];
    for (let i = 0; i <= n; i++) {
        let partitions = integer_partitions_of_fix_length(n - i, number_of_partitions - 1);
        for (let part of partitions) {
            if (part.length != number_of_partitions - 1)
                throw "invalid partition!";
            let row = [i];
            for (let r of part) {
                row.push(r);
            }
            ret.push(row);
        }
        if (partitions.length == 0)
            ret.push([n]);
    }
    return ret;
}
function test_integer_partition_function() {
    let partition = [];
    partition = integer_partition_function(4);
    partition = integer_partition_function(0);
    console.log(partition);
}
test_integer_partition_function();
