/**
 * Simple block generator — with occurrence controls
 *
 * Supports:
 * - Fixed or ranged block/column counts
 * - Exact total attribute count across all blocks
 * - Randomized occurrence controls (exact/min/max) per word
 * - Placement strategy (spread/random)
 * - Layout modes: "block" (one item per line) or "inline" (title, then items line)
 * - Inline separator customization
 * - Multi-run helpers that return flattened arrays of rendered queries
 * - Paired outputs per repetition (same content) in both inline & block
 * - Paired results can return rich objects with:
 *   { query, totalblocks, totalAttributes, totalOccurences, kind }
 * - Aggregates: Optional MIN/MAX/AVG/COUNT wrapping with alias
 *   as "<column>_<FUNC>" (case configurable), either via per-block counts
 *   or (fallback) probability.
 * - aggregationAfterNormalAttributes: EXACT control how many normal attributes
 *   appear before the ONE aggregate (per block), can be a number or an array pattern.
 */
// ────────────────────────────────────────────────────────────────────────────────
// BASE API
function* blockGenerator(title, items, indent = 4, withColon = true, layout = 'block', inlineSeparator = ', ') {
    const heading = withColon ? `${title}:` : title;
    const pad = ' '.repeat(Math.max(0, indent));
    // Flatten items
    const flatItems = [];
    for (const item of items) {
        for (const p of String(item).split(/\r?\n/)) {
            flatItems.push(p);
        }
    }
    if (layout === 'inline') {
        yield heading;
        if (flatItems.length > 0) {
            yield `${pad}${flatItems.join(inlineSeparator)}`;
        }
        return;
    }
    yield heading;
    for (const p of flatItems) {
        yield `${pad}${p}`;
    }
}
function renderBlock(title, items, indent = 4, withColon = true, layout = 'block', inlineSeparator = ', ') {
    return Array.from(blockGenerator(title, items, indent, withColon, layout, inlineSeparator)).join('\n');
}
function printBlock(title, items, indent = 4, withColon = true, layout = 'block', inlineSeparator = ', ') {
    for (const line of blockGenerator(title, items, indent, withColon, layout, inlineSeparator)) {
        console.log(line);
    }
}
function normalizeRange(r) {
    if (typeof r === 'number')
        return { min: r, max: r };
    const min = Math.floor(Math.min(r.min, r.max));
    const max = Math.floor(Math.max(r.min, r.max));
    return { min, max };
}
function mulberry32(seed) {
    let t = seed >>> 0;
    return function () {
        t += 0x6d2b79f5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}
function randomIntInc(rand, min, max) {
    const a = Math.ceil(min);
    const b = Math.floor(max);
    return Math.floor(rand() * (b - a + 1)) + a;
}
function normalizeCellPool(pool) {
    if (!pool)
        return pool;
    return pool.map(s => String(s).slice(0, 5));
}
function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function countOccurrences(haystack, word) {
    const w = String(word).slice(0, 5);
    if (!w)
        return 0;
    const re = new RegExp(`\\b${escapeRegExp(w)}\\b`, 'g');
    const matches = haystack.match(re);
    return matches ? matches.length : 0;
}
function normalizeWord5(s) {
    return String(s).slice(0, 5);
}
/** INTERNAL helper: should we aggregate (probability fallback). */
function shouldAggregateChance(rand, word5, chance, targets, allowPrice = true) {
    const w = normalizeWord5(word5);
    const inTargets = !targets || targets.map(normalizeWord5).includes(w);
    const priceOk = allowPrice && w === 'price';
    return (inTargets || priceOk) && rand() < Math.min(Math.max(chance, 0), 1);
}
/** INTERNAL helper: apply case to function name. */
function applyCase(s, mode) {
    return mode === 'lower' ? s.toLowerCase() : s.toUpperCase();
}
/** INTERNAL helper: wrap token with a random aggregate function + alias. */
function wrapAggregate(funcNames, rand, raw, caseMode) {
    const funcs = funcNames?.length ? funcNames : ['MIN', 'MAX', 'AVG', 'COUNT'];
    const idx = Math.floor(rand() * funcs.length);
    const fBase = funcs[idx];
    const f = applyCase(fBase, caseMode);
    const aliasSuffix = applyCase(fBase, caseMode);
    return `${f}(${raw}) AS ${raw}_${aliasSuffix}`;
}
/** INTERNAL: sample K unique elements from an array (uniform, without replacement). */
function sampleK(rand, arr, k) {
    const a = arr.slice();
    for (let i = 0; i < k && i < a.length; i++) {
        const j = i + Math.floor(rand() * (a.length - i));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a.slice(0, Math.min(k, a.length));
}
/** INTERNAL: generate one run and also return metadata needed for paired/flat outputs. */
function generateRandomBlocksWithMeta(opts) {
    const { blockCount, columnsPerBlock, totalAttributes, rngSeed = Date.now(), indent = 4, withColon = true, titleFactory = i => `BLOCK ${i + 1}`, cellFactory, cellPool, blockSeparator = '', occurrenceRules, occurrencePlacement = 'spread', layout = 'block', inlineSeparator = ', ', 
    // Aggregation controls
    aggregationPerBlock, aggregationChance = 0.25, aggregationFunctions = ['MIN', 'MAX', 'AVG', 'COUNT'], aggregationTargets, aggregationAllowPrice = true, aggregationCase = 'upper', aggregationAfterNormalAttributes, } = opts;
    const rangeBlocks = normalizeRange(blockCount);
    const rangeCols = normalizeRange(columnsPerBlock);
    const rand = mulberry32(rngSeed);
    const normalizedPool = normalizeCellPool(cellPool) ?? [];
    const nBlocks = randomIntInc(rand, rangeBlocks.min, rangeBlocks.max);
    const colsPerBlock = [];
    // Distribute a fixed total or random per-block sizes
    if (totalAttributes && totalAttributes > 0) {
        const base = Math.floor(totalAttributes / nBlocks);
        let remainder = totalAttributes - base * nBlocks;
        for (let i = 0; i < nBlocks; i++) {
            const extra = remainder-- > 0 ? 1 : 0;
            colsPerBlock.push(base + extra);
        }
    }
    else {
        for (let b = 0; b < nBlocks; b++) {
            colsPerBlock.push(randomIntInc(rand, rangeCols.min, rangeCols.max));
        }
    }
    const totalCells = colsPerBlock.reduce((a, b) => a + b, 0);
    // Normalize occurrence rules and pick random counts
    const rules = (occurrenceRules ?? []).map(r => {
        const word = normalizeWord5(r.word);
        const exact = r.exact != null ? Math.max(0, Math.floor(r.exact)) : undefined;
        const min = r.min != null ? Math.max(0, Math.floor(r.min)) : undefined;
        const max = r.max != null ? Math.max(0, Math.floor(r.max)) : undefined;
        return {
            word,
            exact,
            min,
            max,
        };
    });
    const desiredByWord = new Map();
    for (const r of rules) {
        if (r.exact != null) {
            desiredByWord.set(r.word, Math.min(r.exact, totalCells));
        }
        else {
            const lo = r.min ?? 0;
            const hi = r.max ?? lo;
            const desired = Math.min(randomIntInc(rand, lo, hi), totalCells);
            desiredByWord.set(r.word, desired);
        }
    }
    const capByWord = new Map();
    for (const r of rules)
        capByWord.set(r.word, desiredByWord.get(r.word));
    const forced = new Map();
    function tryPlaceIndices(count, word) {
        if (count <= 0)
            return;
        const chosen = new Set();
        const step = totalCells / (count + 1);
        if (occurrencePlacement === 'spread') {
            for (let i = 1; i <= count; i++) {
                let idx = Math.min(totalCells - 1, Math.max(0, Math.floor(i * step)));
                let attempts = 0;
                while ((forced.has(idx) || chosen.has(idx)) && attempts < totalCells) {
                    idx = (idx + 1) % totalCells;
                    attempts++;
                }
                if (!forced.has(idx) && !chosen.has(idx))
                    chosen.add(idx);
            }
        }
        else {
            let attempts = 0;
            while (chosen.size < count && attempts < totalCells * 4) {
                const idx = randomIntInc(rand, 0, totalCells - 1);
                if (!forced.has(idx) && !chosen.has(idx))
                    chosen.add(idx);
                attempts++;
            }
        }
        for (const idx of chosen)
            forced.set(idx, word);
    }
    // Force placements
    for (const r of rules) {
        const desired = Math.min(desiredByWord.get(r.word) ?? 0, totalCells);
        tryPlaceIndices(desired, r.word);
    }
    // Track how many of each capped token were globally used (forced pre-counted)
    const globalCounts = new Map();
    for (const w of forced.values())
        globalCounts.set(w, (globalCounts.get(w) ?? 0) + 1);
    const safeFiller = 'asdf';
    const allowedToUse = (word) => {
        const cap = capByWord.get(word);
        if (cap == null)
            return true;
        const used = globalCounts.get(word) ?? 0;
        return used < cap;
    };
    function pickFromPoolAvoidingCaps() {
        if (normalizedPool.length === 0)
            return safeFiller;
        for (let i = 0; i < 50; i++) {
            const w = normalizedPool[randomIntInc(rand, 0, normalizedPool.length - 1)];
            if (allowedToUse(w))
                return w;
        }
        return safeFiller;
    }
    // Normalize aggregationAfterNormalAttributes into an array (or undefined) and
    // also detect a global "disabled" mode (scalar 0 or all-non-positive array).
    let aggregationDisabled = false;
    const aggAfterArray = (() => {
        if (aggregationAfterNormalAttributes == null)
            return undefined;
        if (Array.isArray(aggregationAfterNormalAttributes)) {
            const rawVals = aggregationAfterNormalAttributes.map(v => Math.floor(v));
            const positives = rawVals.filter(v => v > 0);
            if (positives.length === 0 && rawVals.length > 0) {
                // Array provided but no positive values => disable aggregation
                aggregationDisabled = true;
                return undefined;
            }
            return positives.length ? positives : undefined;
        }
        const v = Math.floor(aggregationAfterNormalAttributes);
        if (v === 0) {
            // Scalar 0 => disable all aggregation
            aggregationDisabled = true;
            return undefined;
        }
        return v > 0 ? [v] : undefined;
    })();
    const blocks = [];
    const aggAfterPerBlock = [];
    let linearIndex = 0;
    for (let b = 0; b < nBlocks; b++) {
        const nCols = colsPerBlock[b];
        // Phase 1: choose base tokens (normalized 5-char) for each column.
        const tokens = new Array(nCols);
        for (let c = 0; c < nCols; c++, linearIndex++) {
            const forcedWord = forced.get(linearIndex);
            if (forcedWord) {
                tokens[c] = normalizeWord5(forcedWord);
                continue;
            }
            const proposed = normalizeWord5(String(cellFactory?.(b, c) ?? ''));
            let token5;
            if (proposed && allowedToUse(proposed)) {
                token5 = proposed;
            }
            else {
                token5 = normalizeWord5(pickFromPoolAvoidingCaps());
            }
            if (capByWord.has(token5)) {
                const used = globalCounts.get(token5) ?? 0;
                globalCounts.set(token5, used + 1);
            }
            tokens[c] = token5;
        }
        // Phase 2: decide which columns to aggregate.
        let aggregateSet = new Set();
        const isEligible = (w) => {
            const inTargets = !aggregationTargets || aggregationTargets.map(normalizeWord5).includes(w);
            const priceOk = aggregationAllowPrice && w === 'price';
            return inTargets || priceOk;
        };
        if (!aggregationDisabled && aggAfterArray && aggAfterArray.length > 0) {
            // EXACT MODE with number or pattern array:
            //   - exactly N normal attributes (N from array)
            //   - then 1 aggregate (if block has at least N+1 attributes).
            //
            // Choose spacing for this block by repeating the pattern.
            const thresholdRaw = aggAfterArray[b % aggAfterArray.length];
            const threshold = Math.max(1, thresholdRaw);
            aggAfterPerBlock[b] = threshold; // record effective N for this block
            if (nCols > threshold) {
                aggregateSet.add(threshold);
            }
        }
        else if (!aggregationDisabled && aggregationPerBlock != null) {
            // existing mode: choose K aggregated columns per block (subject to eligibility)
            const { min, max } = normalizeRange(aggregationPerBlock);
            const eligibleIdxs = [];
            for (let i = 0; i < tokens.length; i++) {
                if (isEligible(tokens[i]))
                    eligibleIdxs.push(i);
            }
            const k = Math.min(randomIntInc(rand, min, max), eligibleIdxs.length);
            aggregateSet = new Set(sampleK(rand, eligibleIdxs, k));
        }
        // else: aggregationDisabled => aggregateSet stays empty, no aggregates.
        // Phase 3: render items
        const items = [];
        for (let c = 0; c < nCols; c++) {
            const token5 = tokens[c];
            let shouldAgg;
            if (aggregationDisabled) {
                shouldAgg = false;
            }
            else if (aggAfterArray && aggAfterArray.length > 0) {
                shouldAgg = aggregateSet.has(c);
            }
            else if (aggregationPerBlock != null) {
                shouldAgg = aggregateSet.has(c);
            }
            else {
                shouldAgg = shouldAggregateChance(rand, token5, aggregationChance, aggregationTargets, aggregationAllowPrice);
            }
            const rendered = shouldAgg
                ? wrapAggregate(aggregationFunctions, rand, token5, aggregationCase)
                : token5;
            items.push(rendered);
        }
        const title = titleFactory(b);
        blocks.push(renderBlock(title, items, indent, withColon, layout, inlineSeparator));
    }
    const text = blocks.join(blockSeparator);
    // Build counts for words referenced in rules (and any in pool)
    const countsByWord = {};
    const candidateSet = new Set();
    for (const r of rules)
        candidateSet.add(r.word);
    if (cellPool)
        for (const p of cellPool)
            candidateSet.add(normalizeWord5(p));
    for (const w of candidateSet)
        countsByWord[w] = countOccurrences(text, w);
    const aggAfterPerBlockFinal = aggAfterPerBlock.length > 0 ? aggAfterPerBlock.slice() : undefined;
    return {
        text,
        totalblocks: nBlocks,
        totalAttributes: totalCells,
        countsByWord,
        aggregationAfterNormalAttributesPerBlock: aggAfterPerBlockFinal,
    };
}
/** Public: generate blocks (string). */
function generateRandomBlocks(opts) {
    return generateRandomBlocksWithMeta(opts).text;
}
function generateRandomBlocksAndCount(opts, searchWord) {
    const { text, countsByWord } = generateRandomBlocksWithMeta(opts);
    const normalizedSearch = String(searchWord).slice(0, 5);
    const count = countsByWord[normalizedSearch] ?? countOccurrences(text, normalizedSearch);
    return { text, count, normalizedSearch, countsByWord };
}
// ────────────────────────────────────────────────────────────────────────────────
// FLATTENED ARRAY (MULTI-REPETITION) API
/** One query as an array of lines (flattened). */
function generateRandomBlocksLines(opts) {
    return generateRandomBlocks(opts).split('\n');
}
/**
 * Generate multiple queries as a flattened array of strings.
 * Each element is a full rendered query (string). RNG seed is offset per run.
 */
function generateRandomQueries(opts, repetitions, seedStride = 1000003) {
    const baseSeed = opts.rngSeed ?? Date.now();
    const out = [];
    for (let i = 0; i < repetitions; i++) {
        const seededOpts = {
            ...opts,
            rngSeed: (baseSeed + i * seedStride) >>> 0,
        };
        out.push(generateRandomBlocks(seededOpts));
    }
    return out;
}
/**
 * Generate N repetitions for each totalAttributes value.
 * Returns: totalAttributes -> array of rendered queries (length = repetitions).
 */
function generateQueriesByTotalAttributes(baseOpts, totals, repetitions, seedStride = 1000003) {
    const result = {};
    const baseSeed = baseOpts.rngSeed ?? Date.now();
    totals.forEach((ta, i) => {
        const optsForTotal = {
            ...baseOpts,
            totalAttributes: ta,
            rngSeed: (baseSeed + i * 10000019) >>> 0,
        };
        result[ta] = generateRandomQueries(optsForTotal, repetitions, seedStride);
    });
    return result;
}
/**
 * For each totalAttributes, generate paired outputs per repetition as RICH OBJECTS:
 * - query, totalblocks, totalAttributes, totalOccurences, kind
 */
function generatePairedInlineAndBlockByTotals(baseOpts, totals, repetitions, seedStride = 1000003) {
    const result = {};
    const baseSeed = baseOpts.rngSeed ?? Date.now();
    for (let tIndex = 0; tIndex < totals.length; tIndex++) {
        const ta = totals[tIndex];
        const rows = [];
        const seedForTotal = (baseSeed + tIndex * 10000019) >>> 0;
        for (let r = 0; r < repetitions; r++) {
            const repSeed = (seedForTotal + r * seedStride) >>> 0;
            const inlineMeta = generateRandomBlocksWithMeta({
                ...baseOpts,
                totalAttributes: ta,
                layout: 'inline',
                rngSeed: repSeed,
            });
            const blockMeta = generateRandomBlocksWithMeta({
                ...baseOpts,
                totalAttributes: ta,
                layout: 'block',
                rngSeed: repSeed,
            });
            const sumOccurrences = (counts, rules) => {
                if (!rules || rules.length === 0)
                    return 0;
                let s = 0;
                for (const rr of rules)
                    s += counts[normalizeWord5(rr.word)] ?? 0;
                return s;
            };
            const perBlock = inlineMeta.aggregationAfterNormalAttributesPerBlock;
            const aggAfterSetting = perBlock && perBlock.length === 1 ? perBlock[0] : perBlock;
            rows.push({
                query: inlineMeta.text,
                totalblocks: inlineMeta.totalblocks,
                totalAttributes: inlineMeta.totalAttributes,
                totalOccurences: sumOccurrences(inlineMeta.countsByWord, baseOpts.occurrenceRules),
                kind: 'inline',
                aggregationAfterNormalAttributesSetting: aggAfterSetting,
            });
            rows.push({
                query: blockMeta.text,
                totalblocks: blockMeta.totalblocks,
                totalAttributes: blockMeta.totalAttributes,
                totalOccurences: sumOccurrences(blockMeta.countsByWord, baseOpts.occurrenceRules),
                kind: 'block',
                aggregationAfterNormalAttributesSetting: aggAfterSetting,
            });
        }
        result[ta] = rows;
    }
    return result;
}
/**
 * Sweep across aggregation-per-block counts (grouped).
 */
function generatePairedInlineAndBlockByAggregation(baseOpts, perBlockCounts, repetitions, seedStride = 1000003) {
    const result = {};
    const baseSeed = baseOpts.rngSeed ?? Date.now();
    for (let aIndex = 0; aIndex < perBlockCounts.length; aIndex++) {
        const aggK = perBlockCounts[aIndex];
        const rows = [];
        const seedForAgg = (baseSeed + aIndex * 9000029) >>> 0;
        for (let r = 0; r < repetitions; r++) {
            const repSeed = (seedForAgg + r * seedStride) >>> 0;
            const inlineMeta = generateRandomBlocksWithMeta({
                ...baseOpts,
                aggregationPerBlock: aggK,
                layout: 'inline',
                rngSeed: repSeed,
            });
            const blockMeta = generateRandomBlocksWithMeta({
                ...baseOpts,
                aggregationPerBlock: aggK,
                layout: 'block',
                rngSeed: repSeed,
            });
            const sumOccurrences = (counts, rules) => {
                if (!rules || rules.length === 0)
                    return 0;
                let s = 0;
                for (const rr of rules)
                    s += counts[normalizeWord5(rr.word)] ?? 0;
                return s;
            };
            const perBlock = inlineMeta.aggregationAfterNormalAttributesPerBlock;
            const aggAfterSetting = perBlock && perBlock.length === 1 ? perBlock[0] : perBlock;
            rows.push({
                query: inlineMeta.text,
                totalblocks: inlineMeta.totalblocks,
                totalAttributes: inlineMeta.totalAttributes,
                totalOccurences: sumOccurrences(inlineMeta.countsByWord, baseOpts.occurrenceRules),
                kind: 'inline',
                aggregationAfterNormalAttributesSetting: aggAfterSetting,
            });
            rows.push({
                query: blockMeta.text,
                totalblocks: blockMeta.totalblocks,
                totalAttributes: blockMeta.totalAttributes,
                totalOccurences: sumOccurrences(blockMeta.countsByWord, baseOpts.occurrenceRules),
                kind: 'block',
                aggregationAfterNormalAttributesSetting: aggAfterSetting,
            });
        }
        result[aggK] = rows;
    }
    return result;
}
/**
 * Flat sweep across aggregation-per-block counts.
 */
function generatePairedInlineAndBlockByAggregationFlat(baseOpts, perBlockCounts, repetitions, seedStride = 1000003) {
    const out = [];
    const baseSeed = baseOpts.rngSeed ?? Date.now();
    for (let aIndex = 0; aIndex < perBlockCounts.length; aIndex++) {
        const aggK = perBlockCounts[aIndex];
        const seedForAgg = (baseSeed + aIndex * 9000029) >>> 0;
        for (let r = 0; r < repetitions; r++) {
            const repSeed = (seedForAgg + r * seedStride) >>> 0;
            const inlineMeta = generateRandomBlocksWithMeta({
                ...baseOpts,
                aggregationPerBlock: aggK,
                layout: 'inline',
                rngSeed: repSeed,
            });
            const blockMeta = generateRandomBlocksWithMeta({
                ...baseOpts,
                aggregationPerBlock: aggK,
                layout: 'block',
                rngSeed: repSeed,
            });
            const sumOccurrences = (counts, rules) => {
                if (!rules || rules.length === 0)
                    return 0;
                let s = 0;
                for (const rr of rules)
                    s += counts[normalizeWord5(rr.word)] ?? 0;
                return s;
            };
            const perBlock = inlineMeta.aggregationAfterNormalAttributesPerBlock;
            const aggAfterSetting = perBlock && perBlock.length === 1 ? perBlock[0] : perBlock;
            out.push({
                query: inlineMeta.text,
                totalblocks: inlineMeta.totalblocks,
                totalAttributes: inlineMeta.totalAttributes,
                totalOccurences: sumOccurrences(inlineMeta.countsByWord, baseOpts.occurrenceRules),
                kind: 'inline',
                aggregationPerBlockSetting: aggK,
                aggregationAfterNormalAttributesSetting: aggAfterSetting,
            });
            out.push({
                query: blockMeta.text,
                totalblocks: blockMeta.totalblocks,
                totalAttributes: blockMeta.totalAttributes,
                totalOccurences: sumOccurrences(blockMeta.countsByWord, baseOpts.occurrenceRules),
                kind: 'block',
                aggregationPerBlockSetting: aggK,
                aggregationAfterNormalAttributesSetting: aggAfterSetting,
            });
        }
    }
    return out;
}
/**
 * Sweep BOTH totalAttributes and aggregation-per-block (grouped).
 * Returns: { [total]: { [aggK]: Entry[] } }
 */
function generatePairedInlineAndBlockByTotalsAndAggregation(baseOpts, totals, perBlockCounts, repetitions, seedStride = 1000003) {
    const grouped = {};
    const baseSeed = baseOpts.rngSeed ?? Date.now();
    const P1 = 10000019;
    const P2 = 9000029;
    for (let tIndex = 0; tIndex < totals.length; tIndex++) {
        const ta = totals[tIndex];
        grouped[ta] = grouped[ta] ?? {};
        for (let aIndex = 0; aIndex < perBlockCounts.length; aIndex++) {
            const aggK = perBlockCounts[aIndex];
            const rows = [];
            const seedForPair = (baseSeed + tIndex * P1 + aIndex * P2) >>> 0;
            for (let r = 0; r < repetitions; r++) {
                const repSeed = (seedForPair + r * seedStride) >>> 0;
                const inlineMeta = generateRandomBlocksWithMeta({
                    ...baseOpts,
                    totalAttributes: ta,
                    aggregationPerBlock: aggK,
                    layout: 'inline',
                    rngSeed: repSeed,
                });
                const blockMeta = generateRandomBlocksWithMeta({
                    ...baseOpts,
                    totalAttributes: ta,
                    aggregationPerBlock: aggK,
                    layout: 'block',
                    rngSeed: repSeed,
                });
                const sumOccurrences = (counts, rules) => {
                    if (!rules || rules.length === 0)
                        return 0;
                    let s = 0;
                    for (const rr of rules)
                        s += counts[normalizeWord5(rr.word)] ?? 0;
                    return s;
                };
                const perBlock = inlineMeta.aggregationAfterNormalAttributesPerBlock;
                const aggAfterSetting = perBlock && perBlock.length === 1 ? perBlock[0] : perBlock;
                rows.push({
                    query: inlineMeta.text,
                    totalblocks: inlineMeta.totalblocks,
                    totalAttributes: inlineMeta.totalAttributes,
                    totalOccurences: sumOccurrences(inlineMeta.countsByWord, baseOpts.occurrenceRules),
                    kind: 'inline',
                    aggregationAfterNormalAttributesSetting: aggAfterSetting,
                });
                rows.push({
                    query: blockMeta.text,
                    totalblocks: blockMeta.totalblocks,
                    totalAttributes: blockMeta.totalAttributes,
                    totalOccurences: sumOccurrences(blockMeta.countsByWord, baseOpts.occurrenceRules),
                    kind: 'block',
                    aggregationAfterNormalAttributesSetting: aggAfterSetting,
                });
            }
            grouped[ta][aggK] = rows;
        }
    }
    return grouped;
}
/**
 * Flat sweep across BOTH totalAttributes and aggregation-per-block.
 *
 * If baseOpts.aggregationAfterNormalAttributes is an array, we treat it as
 * the list of spacing values to experiment with (e.g. [0,5,10,15]).
 * For each value we generate `repetitions` queries (inline + block).
 *
 * - For value 0: aggregation is disabled (no aggregates at all) and
 *   aggregationAfterNormalAttributesSetting is 0 for that row.
 * - For positive values: normal “after N normal attributes then aggregate”.
 */
function generatePairedInlineAndBlockByTotalsAndAggregationFlat(baseOpts, totals, perBlockCounts, repetitions, seedStride = 1000003) {
    const out = [];
    const baseSeed = baseOpts.rngSeed ?? Date.now();
    const P1 = 10000019;
    const P2 = 9000029;
    const P3 = 8000053;
    // Derive list of spacing values from baseOpts.aggregationAfterNormalAttributes
    //  - Scalars are clamped to >= 0
    //  - Arrays keep 0 in the list (so you can include "no aggregate" as an experiment)
    const aggAfterRaw = baseOpts
        .aggregationAfterNormalAttributes;
    const aggAfterValues = aggAfterRaw == null
        ? [0]
        : Array.isArray(aggAfterRaw)
            ? aggAfterRaw.map(v => Math.max(0, Math.floor(v)))
            : [Math.max(0, Math.floor(aggAfterRaw))];
    for (let tIndex = 0; tIndex < totals.length; tIndex++) {
        const ta = totals[tIndex];
        for (let aIndex = 0; aIndex < perBlockCounts.length; aIndex++) {
            const aggK = perBlockCounts[aIndex];
            for (let sIndex = 0; sIndex < aggAfterValues.length; sIndex++) {
                const aggAfter = aggAfterValues[sIndex]; // concrete spacing for this batch
                const seedForTriple = (baseSeed + tIndex * P1 + aIndex * P2 + sIndex * P3) >>> 0;
                for (let r = 0; r < repetitions; r++) {
                    const repSeed = (seedForTriple + r * seedStride) >>> 0;
                    const inlineMeta = generateRandomBlocksWithMeta({
                        ...baseOpts,
                        totalAttributes: ta,
                        aggregationPerBlock: perBlockCounts[aIndex],
                        aggregationAfterNormalAttributes: aggAfter,
                        layout: 'inline',
                        rngSeed: repSeed,
                    });
                    const blockMeta = generateRandomBlocksWithMeta({
                        ...baseOpts,
                        totalAttributes: ta,
                        aggregationPerBlock: perBlockCounts[aIndex],
                        aggregationAfterNormalAttributes: aggAfter,
                        layout: 'block',
                        rngSeed: repSeed,
                    });
                    const sumOccurrences = (counts, rules) => {
                        if (!rules || rules.length === 0)
                            return 0;
                        let s = 0;
                        for (const rr of rules)
                            s += counts[normalizeWord5(rr.word)] ?? 0;
                        return s;
                    };
                    const perBlock = inlineMeta.aggregationAfterNormalAttributesPerBlock;
                    // If aggAfter == 0 (disabled), perBlock will be undefined; we expose 0 explicitly.
                    const aggAfterSetting = aggAfter === 0
                        ? 0
                        : perBlock && perBlock.length === 1
                            ? perBlock[0]
                            : undefined;
                    out.push({
                        query: inlineMeta.text,
                        totalblocks: inlineMeta.totalblocks,
                        totalAttributes: inlineMeta.totalAttributes,
                        totalOccurences: sumOccurrences(inlineMeta.countsByWord, baseOpts.occurrenceRules),
                        kind: 'inline',
                        totalAttributesSetting: ta,
                        aggregationPerBlockSetting: aggK,
                        aggregationAfterNormalAttributesSetting: aggAfterSetting,
                    });
                    out.push({
                        query: blockMeta.text,
                        totalblocks: blockMeta.totalblocks,
                        totalAttributes: blockMeta.totalAttributes,
                        totalOccurences: sumOccurrences(blockMeta.countsByWord, baseOpts.occurrenceRules),
                        kind: 'block',
                        totalAttributesSetting: ta,
                        aggregationPerBlockSetting: aggK,
                        aggregationAfterNormalAttributesSetting: aggAfterSetting,
                    });
                }
            }
        }
    }
    return out;
}
// ────────────────────────────────────────────────────────────────────────────────
// DEMOS
// Demo sweep controls
const totalsDemo = [20];
const aggregationCountsDemo = [1];
const aggregationCaseDemo = 'upper';
export const flat = generatePairedInlineAndBlockByTotalsAndAggregationFlat({
    blockCount: { min: 1, max: 1 },
    columnsPerBlock: { min: 1, max: 15 },
    rngSeed: 20251029,
    indent: 2,
    cellPool: [
        'ORDER', 'PRICE', 'STATE', 'VALUE', 'STOCK', 'LEVEL', 'TOTAL', 'ASSET', 'BUYER', 'SALES',
        'CLAIM', 'TAXES', 'COSTS', 'FUNDS', 'BONUS', 'GROSS', 'ITEMS', 'QUOTA', 'CHECK', 'RATES',
        'SPEND', 'TREND', 'WORTH', 'SCORE', 'NOTES', 'LOANS', 'CREDIT', 'BRAND',
    ],
    titleFactory: i => `EXP-${i + 1}`,
    blockSeparator: '\n',
    occurrenceRules: [{ word: 'PRICE', min: 1, max: 1 }],
    occurrencePlacement: 'random',
    inlineSeparator: ', ',
    withColon: true,
    aggregationFunctions: ['MIN', 'MAX', 'AVG', 'COUNT'],
    aggregationTargets: ['PRICE', 'STOCK', 'VALUE', 'COUNT'],
    aggregationAllowPrice: true,
    aggregationCase: aggregationCaseDemo,
    // You can extend this list with 0:
    //   0 => no aggregates
    //   5,10,15 => after N normal attributes then aggregate
    aggregationAfterNormalAttributes: [0, 5, 10, 15],
}, totalsDemo, aggregationCountsDemo, 10);
// Quick print: you should now see afterNormals=0, 5, 10, 15, each repeated
// (inline + block) per repetition. Rows with 0 contain NO aggregates.
for (let i = 0; i < flat.length; i++) {
    const row = flat[i];
    console.log(`[case=${aggregationCaseDemo}] ` +
        `[total=${row.totalAttributesSetting} agg=${row.aggregationPerBlockSetting}] ` +
        `[afterNormals=${row.aggregationAfterNormalAttributesSetting}] ` +
        `blocks=${row.totalblocks} attrs=${row.totalAttributes}`);
    console.log(row.query);
}
