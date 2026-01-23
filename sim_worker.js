/**
 * 丹青模拟器 - 高级演算并行计算单元
 */

// Shim window for engine.js
self.window = self;
importScripts('engine.js');

let cardClasses = {};

function initCardClasses() {
    if (Object.keys(cardClasses).length === 0 && self.CARD_DATABASE) {
        self.CARD_DATABASE.forEach(c => {
            cardClasses[c.className] = c.classRef;
        });
    }
}

/**
 * 执行一批组合的模拟
 * @param {Object} data 包含组合列表和模拟参数
 */
function runBatch(data) {
    initCardClasses();
    const { combos, baseAtk, baseDps, timeLimit, iterations, targetCount } = data;
    const results = [];

    for (let i = 0; i < combos.length; i++) {
        const combo = combos[i];
        let comboTotalDps = 0;

        let firstRes = null;
        for (let iter = 0; iter < iterations; iter++) {
            // 确保每次迭代都重新构造实例，防止计时器等状态残留
            const deckInstances = combo.deckRef.map(c => {
                const Cls = cardClasses[c.className];
                return Cls ? new Cls(c.level || 6) : null;
            }).filter(Boolean);

            const engine = new RaceCombatEngine(deckInstances, baseAtk, baseDps, targetCount);
            const res = engine.simulate(timeLimit).total;

            // 稳定性检测优化：如果前两次结果完全一致，说明该卡组无随机性，无需继续模拟
            if (iter === 0) {
                firstRes = res;
                comboTotalDps += res;
            } else if (iter === 1) {
                if (res === firstRes) {
                    comboTotalDps = firstRes * iterations;
                    break;
                } else {
                    comboTotalDps += res;
                }
            } else {
                comboTotalDps += res;
            }
        }

        results.push({
            id: combo.id,
            cost: combo.cost,
            dps: comboTotalDps / iterations,
            deckDetails: combo.deckRef.map(c => c.level === 6 ? c.name : `${c.name}(${c.level})`)
        });

        // 发送进度滴答，让主线程进度条动起来
        postMessage({ type: 'PROGRESS_TICK' });
    }

    postMessage({ type: 'BATCH_DONE', results });
}

onmessage = function (e) {
    const { type, data } = e.data;
    if (type === 'BATCH') {
        runBatch(data);
    }
};
