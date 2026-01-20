/**
 * 丹青模拟器 - 高级演算 Web Worker
 */

// Shim window for engine.js
self.window = self;

importScripts('engine.js');

// 缓存 Class 引用
let cardClasses = {};

function initCardClasses() {
    if (self.CARD_DATABASE) {
        self.CARD_DATABASE.forEach(c => {
            cardClasses[c.className] = c.classRef;
        });
    }
}

/**
 * 组合生成算法 (Backtracking)
 */
function generateCombos(availableCards, maxCost) {
    const results = [];
    const sorted = availableCards.sort((a, b) => b.fee - a.fee);

    function backtrack(start, current, currentCost) {
        if (currentCost > maxCost) return;
        if (current.length > 0) {
            results.push({
                cost: currentCost,
                deckRef: [...current] // Copy the array of card objects
            });
        }
        for (let i = start; i < sorted.length; i++) {
            const card = sorted[i];
            if (currentCost + card.fee <= maxCost) {
                current.push(card);
                backtrack(i + 1, current, currentCost + card.fee);
                current.pop();
            }
        }
    }
    backtrack(0, [], 0);
    return results;
}

function runSimulation(params) {
    initCardClasses();
    const { baseAtk, baseDps, timeLimit, iterations, maxCost, selectedCardPool } = params;

    postMessage({ type: 'STATUS', message: '正在生成所有可能组合...' });

    const allCombosRaw = generateCombos(selectedCardPool, maxCost);

    // 过滤逻辑：只保留费用等于“实际能达到的最大费用”的组合
    let maxFound = 0;
    if (allCombosRaw.length > 0) {
        for (const c of allCombosRaw) {
            if (c.cost > maxFound) maxFound = c.cost;
        }
    }
    const allCombos = allCombosRaw.filter(c => c.cost === maxFound);

    postMessage({ type: 'STATUS', message: `生成 ${allCombosRaw.length} 种组合，筛选出 ${allCombos.length} 组 (Cost=${maxFound})，开始演算...` });

    const total = allCombos.length;
    const finalResults = [];
    const reportInterval = Math.max(1, Math.floor(total / 50));

    for (let i = 0; i < total; i++) {
        const combo = allCombos[i];
        let comboTotalDps = 0;

        // 构造卡组实例
        const deckInstances = combo.deckRef.map(c => {
            const Cls = cardClasses[c.className];
            if (!Cls) return null;
            return new Cls(c.level || 6);
        }).filter(Boolean);

        for (let iter = 0; iter < iterations; iter++) {
            const engine = new RaceCombatEngine(deckInstances, baseAtk, baseDps);
            const res = engine.simulate(timeLimit);
            comboTotalDps += res.total;
        }

        const avgDps = comboTotalDps / iterations;

        finalResults.push({
            cost: combo.cost,
            dps: avgDps,
            deckNames: combo.deckRef.map(c => c.name),
            deckDetails: combo.deckRef.map(c => c.level === 6 ? c.name : `${c.name}(${c.level})`)
        });

        if (i % reportInterval === 0 || i === total - 1) {
            const progress = ((i + 1) / total * 100).toFixed(1);
            postMessage({ type: 'PROGRESS', progress: progress, current: i + 1, total: total });
        }
    }

    postMessage({ type: 'RESULT', data: finalResults });
}

onmessage = function (e) {
    const { type, data } = e.data;
    if (type === 'START') {
        runSimulation(data);
    }
};
