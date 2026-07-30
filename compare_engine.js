const fs = require("fs");
const path = require("path");

const Data = require("./data.js");
global.Data = Data;

// 金标准基线：记录各场景的期望结算结果。
// 引擎逻辑有意变更时，用 `node compare_engine.js --update` 重新生成。
const BASELINE_PATH = path.resolve(__dirname, "engine_baseline.json");

function loadBaseline() {
    if (!fs.existsSync(BASELINE_PATH)) return null;
    return JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
}

function saveBaseline(baseline) {
    fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
}

function cloneDeck(deck) {
    return deck.map(card => ({ id: card.id, level: card.level }));
}

// 场景可以只给 deck（数组），也可以给完整 config（{deck, machineStones, craftStone}）。
// 机巧石/匠心石必须放在构造函数的第一个参数里，塞进第二个参数不会报错但会静默失效。
function cloneConfig(scenario) {
    if (Array.isArray(scenario.deck) && !scenario.machineStones && !scenario.craftStone) {
        return cloneDeck(scenario.deck);
    }
    return {
        deck: cloneDeck(scenario.deck),
        machineStones: (scenario.machineStones || []).map(s => ({ id: s.id, rank: s.rank })),
        craftStone: scenario.craftStone ? { id: scenario.craftStone.id || scenario.craftStone } : null
    };
}

function createDeck(ids, level) {
    return ids.map(id => ({ id, level }));
}

function createMixedDeck() {
    return Data.CARD_DEFS.map((card, index) => ({
        id: card.id,
        level: index % 7
    }));
}

function sortObject(value) {
    if (Array.isArray(value)) {
        return value.map(sortObject);
    }
    if (!value || typeof value !== "object") {
        return value;
    }
    const sorted = {};
    Object.keys(value).sort().forEach(key => {
        sorted[key] = sortObject(value[key]);
    });
    return sorted;
}

function normalizeResult(result) {
    return sortObject({
        totalDamage: result.totalDamage,
        totalDps: result.totalDps,
        meters: result.meters,
        amplifyTriggers: result.amplifyTriggers,
        warnings: result.warnings,
        byCard: result.breakdown.byCard,
        byMechanic: result.breakdown.byMechanic
    });
}

function diffValue(oldValue, newValue, pathParts = []) {
    const diffs = [];
    const pathLabel = pathParts.join(".");

    if (Array.isArray(oldValue) || Array.isArray(newValue)) {
        if (!Array.isArray(oldValue) || !Array.isArray(newValue)) {
            diffs.push(`${pathLabel}: type mismatch`);
            return diffs;
        }
        if (oldValue.length !== newValue.length) {
            diffs.push(`${pathLabel}: length ${oldValue.length} != ${newValue.length}`);
        }
        const length = Math.max(oldValue.length, newValue.length);
        for (let i = 0; i < length; i += 1) {
            diffs.push(...diffValue(oldValue[i], newValue[i], pathParts.concat(String(i))));
        }
        return diffs;
    }

    const oldIsObject = oldValue && typeof oldValue === "object";
    const newIsObject = newValue && typeof newValue === "object";
    if (oldIsObject || newIsObject) {
        if (!oldIsObject || !newIsObject) {
            diffs.push(`${pathLabel}: type mismatch`);
            return diffs;
        }
        const keys = Array.from(new Set([
            ...Object.keys(oldValue),
            ...Object.keys(newValue)
        ])).sort();
        keys.forEach(key => {
            diffs.push(...diffValue(oldValue[key], newValue[key], pathParts.concat(key)));
        });
        return diffs;
    }

    if (oldValue !== newValue) {
        diffs.push(`${pathLabel}: ${JSON.stringify(oldValue)} != ${JSON.stringify(newValue)}`);
    }
    return diffs;
}

const cardIdsByElement = Data.CARD_DEFS.reduce((acc, card) => {
    acc[card.element].push(card.id);
    return acc;
}, { fire: [], ice: [], wood: [], thunder: [] });

const CRAFT_STONE_BY_ELEMENT = {
    fire: "blazing-skyfire",
    ice: "frost-glory",
    wood: "verdant-life",
    thunder: "thunder-aegis"
};

const scenarios = [
    {
        name: "all_cards_lv0_60s_1target_seed1",
        deck: createDeck(Data.CARD_DEFS.map(card => card.id), 0),
        options: { duration: 60, targetCount: 1, seed: 1 }
    },
    {
        name: "all_cards_lv6_243s_1target_seed1",
        deck: createDeck(Data.CARD_DEFS.map(card => card.id), 6),
        options: { duration: 243, targetCount: 1, seed: 1 }
    },
    {
        name: "all_cards_lv6_243s_3target_seed1",
        deck: createDeck(Data.CARD_DEFS.map(card => card.id), 6),
        options: { duration: 243, targetCount: 3, seed: 1 }
    },
    {
        name: "fire_only_lv6_243s_3target_seed7",
        deck: createDeck(cardIdsByElement.fire, 6),
        options: { duration: 243, targetCount: 3, seed: 7 }
    },
    {
        name: "ice_only_lv6_243s_3target_seed11",
        deck: createDeck(cardIdsByElement.ice, 6),
        options: { duration: 243, targetCount: 3, seed: 11 }
    },
    {
        name: "wood_only_lv6_243s_3target_seed13",
        deck: createDeck(cardIdsByElement.wood, 6),
        options: { duration: 243, targetCount: 3, seed: 13 }
    },
    {
        name: "thunder_only_lv6_243s_3target_seed17",
        deck: createDeck(cardIdsByElement.thunder, 6),
        options: { duration: 243, targetCount: 3, seed: 17 }
    },
    {
        name: "mixed_levels_120s_2target_seed23",
        deck: createMixedDeck(),
        options: { duration: 120, targetCount: 2, seed: 23 }
    },
    // ---- 机巧石 / 匠心石覆盖 ----
    // 上面 8 个场景都没有配置任何石头，所以石头相关的改动会「自动通过」。
    // 以下场景每系一条，把该系全部机巧石 5/5 与对应匠心石一起挂上，
    // 确保 dispatchMachineStones 的分支、升星效果和伤害归属都被基线锁住。
    ...["fire", "ice", "wood", "thunder"].map(element => ({
        name: `${element}_all_stones_r5_243s_1target_seed1`,
        deck: createDeck(cardIdsByElement[element], 6),
        machineStones: Data.MACHINE_STONE_DEFS
            .filter(s => s.element === element)
            .map(s => ({ id: s.id, rank: 5 })),
        craftStone: { id: CRAFT_STONE_BY_ELEMENT[element] },
        options: { duration: 243, targetCount: 1, seed: 1 }
    })),
    // 3/5 档单独锁一条，防止 3/5 与 5/5 的分支被改成同一行为。
    ...["fire", "ice", "wood", "thunder"].map(element => ({
        name: `${element}_all_stones_r3_243s_3target_seed5`,
        deck: createDeck(cardIdsByElement[element], 6),
        machineStones: Data.MACHINE_STONE_DEFS
            .filter(s => s.element === element)
            .map(s => ({ id: s.id, rank: 3 })),
        craftStone: { id: CRAFT_STONE_BY_ELEMENT[element] },
        options: { duration: 243, targetCount: 3, seed: 5 }
    }))
];

function main() {
    const Engine = require("./engine.js");
    const shouldUpdate = process.argv.includes("--update");
    const baseline = loadBaseline();

    if (!baseline && !shouldUpdate) {
        console.error(`Baseline not found: ${path.basename(BASELINE_PATH)}`);
        console.error("Run `node compare_engine.js --update` to create it.");
        process.exit(1);
    }

    const results = {};
    const failures = [];

    scenarios.forEach((scenario, index) => {
        const result = new Engine.CombatEngine(
            cloneConfig(scenario),
            scenario.options
        ).simulate();
        const normalized = normalizeResult(result);
        results[scenario.name] = normalized;

        if (shouldUpdate) return;

        const expected = baseline[scenario.name];
        if (!expected) {
            console.log(`[${index + 1}/${scenarios.length}] ${scenario.name}: NEW (no baseline entry)`);
            failures.push({
                name: scenario.name,
                diffs: ["scenario missing from baseline"]
            });
            return;
        }

        const diffs = diffValue(expected, normalized);
        console.log(`[${index + 1}/${scenarios.length}] ${scenario.name}: ${diffs.length === 0 ? "PASS" : "FAIL"}`);
        if (diffs.length > 0) {
            failures.push({ name: scenario.name, diffs });
        }
    });

    if (shouldUpdate) {
        saveBaseline(results);
        console.log("");
        console.log(`Baseline written: ${path.basename(BASELINE_PATH)} (${scenarios.length} scenarios).`);
        return;
    }

    const staleNames = Object.keys(baseline).filter(name => !(name in results));
    if (staleNames.length > 0) {
        console.error("");
        console.error(`Baseline has ${staleNames.length} stale scenario(s): ${staleNames.join(", ")}`);
        failures.push({
            name: "baseline",
            diffs: staleNames.map(name => `stale scenario: ${name}`)
        });
    }

    if (failures.length > 0) {
        console.error("");
        console.error(`Detected ${failures.length} failing scenario(s).`);
        failures.forEach(failure => {
            console.error("");
            console.error(`Scenario: ${failure.name}`);
            failure.diffs.slice(0, 50).forEach(diff => {
                console.error(`  - ${diff}`);
            });
            if (failure.diffs.length > 50) {
                console.error(`  - ... ${failure.diffs.length - 50} more diff(s)`);
            }
        });
        console.error("");
        console.error("If these changes are intentional, refresh the baseline with:");
        console.error("  node compare_engine.js --update");
        process.exit(1);
    }

    console.log("");
    console.log(`All ${scenarios.length} scenarios matched the recorded baseline exactly.`);
}

main();
