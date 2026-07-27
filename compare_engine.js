const cp = require("child_process");
const Module = require("module");
const path = require("path");

const Data = require("./data.js");
global.Data = Data;

function loadHeadEngine() {
    const oldCode = cp.execSync("git show HEAD:engine.js", {
        cwd: __dirname,
        encoding: "utf8"
    });
    const filename = path.resolve(__dirname, "engine_head_snapshot.js");
    const m = new Module(filename, module);
    m.filename = filename;
    m.paths = Module._nodeModulePaths(__dirname);
    m._compile(oldCode, filename);
    return m.exports;
}

function cloneDeck(deck) {
    return deck.map(card => ({ id: card.id, level: card.level }));
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
    }
];

function main() {
    const HeadEngine = loadHeadEngine();
    const CurrentEngine = require("./engine.js");
    const failures = [];

    scenarios.forEach((scenario, index) => {
        const oldResult = new HeadEngine.CombatEngine(
            cloneDeck(scenario.deck),
            scenario.options
        ).simulate();
        const newResult = new CurrentEngine.CombatEngine(
            cloneDeck(scenario.deck),
            scenario.options
        ).simulate();

        const oldNormalized = normalizeResult(oldResult);
        const newNormalized = normalizeResult(newResult);
        const diffs = diffValue(oldNormalized, newNormalized);

        console.log(`[${index + 1}/${scenarios.length}] ${scenario.name}: ${diffs.length === 0 ? "PASS" : "FAIL"}`);
        if (diffs.length > 0) {
            failures.push({
                name: scenario.name,
                diffs,
                oldNormalized,
                newNormalized
            });
        }
    });

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
        process.exit(1);
    }

    console.log("");
    console.log(`All ${scenarios.length} scenarios matched HEAD engine.js exactly.`);
}

main();
