self.window = self;
importScripts('data.js', 'engine.js');

function runBatch(data) {
  const { combos, duration, iterations, targetCount, externalSkillDps } = data;
  const results = [];

  for (let i = 0; i < combos.length; i++) {
    const combo = combos[i];
    let totalDps = 0;
    let totalDamage = 0;
    let firstDps = null;
    let firstDamage = null;
    const config = {
      deck: combo.deck,
      machineStones: combo.machineStones || [],
      craftStone: combo.craftStone || null
    };

    for (let iter = 0; iter < iterations; iter++) {
      const engine = new self.Engine.CombatEngine(config, {
        duration,
        targetCount,
        seed: 1000 + iter,
        externalSkillDps
      });
      const result = engine.simulate();

      if (iter === 0) {
        firstDps = result.totalDps;
        firstDamage = result.totalDamage;
        totalDps += result.totalDps;
        totalDamage += result.totalDamage;
      } else if (iter === 1) {
        if (result.totalDps === firstDps && result.totalDamage === firstDamage) {
          totalDps = firstDps * iterations;
          totalDamage = firstDamage * iterations;
          break;
        } else {
          totalDps += result.totalDps;
          totalDamage += result.totalDamage;
        }
      } else {
        totalDps += result.totalDps;
        totalDamage += result.totalDamage;
      }
    }

    results.push({
      id: combo.id,
      cost: combo.cost,
      avgDps: totalDps / iterations,
      avgDamage: totalDamage / iterations,
      deck: combo.deck,
      machineStones: combo.machineStones || [],
      craftStone: combo.craftStone || null
    });

    postMessage({ type: 'PROGRESS_TICK' });
  }

  postMessage({ type: 'BATCH_DONE', results });
}

self.onmessage = function (e) {
  const { type, data } = e.data;
  if (type === 'BATCH') runBatch(data);
};
