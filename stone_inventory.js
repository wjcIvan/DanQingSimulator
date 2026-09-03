(function (root, factory) {
    const api = factory();
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    if (root) root.StoneInventory = api;
})(typeof self !== "undefined" ? self : globalThis, function () {
    function clampInteger(value, min, max) {
        const parsed = parseInt(value, 10);
        if (!Number.isFinite(parsed)) return min;
        return Math.max(min, Math.min(max, parsed));
    }

    function normalizePair(pair, validIds) {
        if (!Array.isArray(pair) || pair.length !== 2) return null;
        const left = pair[0];
        const right = pair[1];
        if (!validIds.has(left) || !validIds.has(right)) return null;
        return [left, right];
    }

    function rankKey(ranks) {
        return ranks.join(",");
    }

    // Each physical stone occupies one slot. Double stones come from inventory;
    // single stones are optional fillers and can be used without an inventory cap.
    function generateInventoryMachineStoneCombos(stones, inventoryPairs, options = {}) {
        const source = Array.isArray(stones) ? stones : [];
        const ids = source.map(stone => stone.id);
        const idIndex = new Map(ids.map((id, index) => [id, index]));
        const validIds = new Set(ids);
        const maxRanks = source.map(stone => clampInteger(stone.maxRank ?? 5, 0, 5));
        const slotLimit = clampInteger(options.slotLimit ?? 0, 0, 100);
        const minSlotLimit = clampInteger(options.minSlotLimit ?? 0, 0, slotLimit);
        const attributeLimit = clampInteger(options.attributeLimit ?? maxRanks.reduce((sum, rank) => sum + rank, 0), 0, 100);
        const allowSingles = options.allowSingles !== false;
        const normalizedPairs = (inventoryPairs || [])
            .map(pair => normalizePair(pair, validIds))
            .filter(Boolean);
        const pairCounts = new Map();
        normalizedPairs.forEach(pair => {
            const key = pair.join("\u0000");
            const existing = pairCounts.get(key);
            if (existing) existing.count += 1;
            else pairCounts.set(key, { pair, count: 1 });
        });
        const pairs = Array.from(pairCounts.values()).flatMap(({ pair, count }) => (
            Array.from({ length: Math.min(count, slotLimit) }, () => pair)
        ));

        let states = new Map();
        states.set(`0|${rankKey(ids.map(() => 0))}`, {
            ranks: ids.map(() => 0),
            doubleStonePairs: []
        });

        pairs.forEach(pair => {
            const next = new Map(states);
            states.forEach(state => {
                if (state.doubleStonePairs.length >= slotLimit) return;
                const ranks = state.ranks.slice();
                const leftIndex = idIndex.get(pair[0]);
                const rightIndex = idIndex.get(pair[1]);
                ranks[leftIndex] += 1;
                ranks[rightIndex] += 1;
                if (ranks[leftIndex] > maxRanks[leftIndex] || ranks[rightIndex] > maxRanks[rightIndex]) return;
                const attributeCount = ranks.reduce((sum, rank) => sum + rank, 0);
                if (attributeCount > attributeLimit) return;
                const doubleStonePairs = state.doubleStonePairs.concat([pair]);
                next.set(`${doubleStonePairs.length}|${rankKey(ranks)}`, { ranks, doubleStonePairs });
            });
            states = next;
        });

        const results = new Map();
        const addResult = (ranks, doubleStonePairs, singleStoneIds) => {
            const attributeCount = ranks.reduce((sum, rank) => sum + rank, 0);
            const slotsUsed = doubleStonePairs.length + singleStoneIds.length;
            if (attributeCount > attributeLimit || slotsUsed > slotLimit || slotsUsed < minSlotLimit) return;
            const key = rankKey(ranks);
            const previous = results.get(key);
            if (previous && previous.loadout.slotsUsed <= slotsUsed) return;
            results.set(key, {
                machineStones: ranks
                    .map((rank, index) => ({ id: ids[index], rank }))
                    .filter(item => item.rank > 0),
                loadout: {
                    doubleStonePairs: doubleStonePairs.map(pair => pair.slice()),
                    singleStoneIds: singleStoneIds.slice(),
                    slotsUsed,
                    attributeCount
                }
            });
        };

        states.forEach(state => {
            const baseSlots = state.doubleStonePairs.length;
            const singles = [];
            const ranks = state.ranks.slice();

            function fillSingles(index) {
                if (index === ids.length) {
                    addResult(ranks, state.doubleStonePairs, singles);
                    return;
                }
                const remainingSlots = slotLimit - baseSlots - singles.length;
                const remainingAttributes = attributeLimit - ranks.reduce((sum, rank) => sum + rank, 0);
                const maxAdd = allowSingles
                    ? Math.min(maxRanks[index] - ranks[index], remainingSlots, remainingAttributes)
                    : 0;
                for (let count = 0; count <= maxAdd; count += 1) {
                    ranks[index] += count;
                    for (let i = 0; i < count; i += 1) singles.push(ids[index]);
                    fillSingles(index + 1);
                    for (let i = 0; i < count; i += 1) singles.pop();
                    ranks[index] -= count;
                }
            }

            fillSingles(0);
        });

        const allResults = Array.from(results.values());
        const attributeDrop = options.attributeDrop == null
            ? null
            : clampInteger(options.attributeDrop, 0, 100);
        const maxAttributeCount = allResults.reduce((max, item) => Math.max(max, item.loadout.attributeCount), 0);
        const filteredResults = attributeDrop == null
            ? allResults
            : allResults.filter(item => item.loadout.attributeCount >= maxAttributeCount - attributeDrop);
        return filteredResults.sort((a, b) => {
            return b.loadout.attributeCount - a.loadout.attributeCount
                || a.loadout.slotsUsed - b.loadout.slotsUsed
                || rankKey(a.machineStones.map(item => item.rank)).localeCompare(rankKey(b.machineStones.map(item => item.rank)));
        });
    }

    return { generateInventoryMachineStoneCombos };
});
