const assert = require("assert");
const { generateInventoryMachineStoneCombos } = require("./stone_inventory.js");

const stones = ["A", "B", "C", "D", "E"].map(id => ({ id, maxRank: 5 }));
const inventory = ["AA", "AA", "BC", "BC", "DC", "DE", "DB", "DE"]
    .map(pair => pair.split(""));

const results = generateInventoryMachineStoneCombos(stones, inventory, { slotLimit: 9, minSlotLimit: 9, attributeDrop: 3 });
assert(results.length > 0, "example inventory should produce candidates");
assert(results.every(result => result.loadout.slotsUsed === 9), "every candidate should fill all available slots");
assert(Math.max(...results.map(result => result.loadout.attributeCount)) === 17, "8 double and 1 single stone should reach 17 attributes");
assert(Math.min(...results.map(result => result.loadout.attributeCount)) === 14, "candidates should search down by 3 attribute points");
assert(results.every(result => result.machineStones.every(stone => stone.rank <= 5)), "each attribute must respect rank 5");

const inventoryCounts = inventory.reduce((counts, pair) => {
    const key = pair.slice().sort().join("");
    counts[key] = (counts[key] || 0) + 1;
    return counts;
}, {});
results.forEach(result => {
    const usedCounts = result.loadout.doubleStonePairs.reduce((counts, pair) => {
        const key = pair.slice().sort().join("");
        counts[key] = (counts[key] || 0) + 1;
        return counts;
    }, {});
    Object.entries(usedCounts).forEach(([key, count]) => {
        assert(count <= (inventoryCounts[key] || 0), `${key} exceeds inventory`);
    });
});

const repeated = generateInventoryMachineStoneCombos(stones, [["A", "A"]], { slotLimit: 1 });
assert.deepStrictEqual(repeated[0].machineStones, [{ id: "A", rank: 2 }]);
assert.strictEqual(repeated[0].loadout.slotsUsed, 1);

const excessiveInventory = Array.from({ length: 1000 }, () => ["A", "B"]);
const capped = generateInventoryMachineStoneCombos(stones, excessiveInventory, { slotLimit: 2, minSlotLimit: 2 });
assert(capped.length > 0, "excess inventory should still produce candidates");
assert(capped.every(result => result.loadout.doubleStonePairs.length <= 2), "inventory beyond the slot limit must be ignored");

console.log(`stone inventory tests passed (${results.length} example candidates)`);
