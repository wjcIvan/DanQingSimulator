(function () {
    const { CARD_DEFS, MACHINE_STONE_DEFS, CRAFT_STONE_DEFS } = window.Data;
    const { CombatEngine } = window.Engine;

    const ELEMENT_META = {
        fire: { title: "火", chip: "天火", border: "race-fire", tag: "tag-fire", text: "text-red-500" },
        ice: { title: "冰", chip: "玄冰", border: "race-ice", tag: "tag-ice", text: "text-cyan-600" },
        wood: { title: "木", chip: "苍木", border: "race-wood", tag: "tag-wood", text: "text-emerald-600" },
        thunder: { title: "雷", chip: "神雷", border: "race-thunder", tag: "tag-thunder", text: "text-violet-600" }
    };

    const selected = new Map();
    const selectedMachineStones = new Map();
    let selectedCraftStone = null;
    let chart = null;
    let lastResult = null;
    let currentTab = "basic";
    let bfWorkers = [];
    let bfStopped = false;
    // 模拟日志只保留第 1 轮，避免多轮迭代把内存和 DOM 撑爆。
    let simulationLog = [];
    let simulationLogTruncated = false;
    let logFilter = "all";
    let logExpanded = false;

    const LOG_KIND_LABELS = {
        damage: "伤害",
        buff: "状态",
        meter: "计量",
        amplify: "激化",
        craft: "匠心",
        event: "事件"
    };

    function initDefaults() {
        selected.clear();
        selectedMachineStones.clear();
        selectedCraftStone = null;
    }

    function getSelectedDeck() {
        return Array.from(selected.values());
    }

    function getSelectedMachineStones() {
        return Array.from(selectedMachineStones.values());
    }

    function getMachineFee() {
        return getSelectedMachineStones().reduce((sum, item) => {
            const stone = MACHINE_STONE_DEFS.find(entry => entry.id === item.id);
            return sum + (stone ? item.rank : 0);
        }, 0);
    }

    function getTotalFee() {
        return getSelectedDeck().reduce((sum, item) => {
            const card = CARD_DEFS.find(entry => entry.id === item.id);
            return sum + (card ? card.fee : 0);
        }, 0);
    }

    function formatValue(value, digits = 0) {
        if (typeof value !== "number" || Number.isNaN(value)) return value;
        return digits > 0 ? value.toFixed(digits) : Math.round(value).toString();
    }

    function describeCardAtLevel(card, level) {
        const p = window.Data.resolveCardParams(card, level);
        switch (card.id) {
            case "scarlet-ant":
                return `造成伤害时，引燃最多 ${p.maxTargets} 名敌人，附加可叠层燃烧：每 ${formatValue(p.burnTickInterval)} 秒造成 ${formatValue(p.burnDamage)} 天火伤害，持续 ${formatValue(p.burnDuration)} 秒。燃烧最多 ${formatValue(p.burnMaxStacks)} 层，每额外 1 层基础伤害提高 ${formatValue(p.extraLayerBonus * 100)}%。`;
            case "fierce-tiger":
                return `燃烧造成伤害时累加 ${formatValue(p.burnMeterGain)} 天火值；触发爆燃时累加 ${formatValue(p.combustMeterGain)} 天火值；天火值达到 ${formatValue(p.triggerThreshold)} 时触发天火激化。`;
            case "sui-shou":
                return `燃烧生效频率提高 ${formatValue(p.tickRateBonus * 100)}%；燃烧造成伤害时有 ${formatValue(p.extraStackChance * 100)}% 概率额外叠加 1 层，且不会重置持续时间。`;
            case "two-tail-fox":
                return `每次尝试添加或叠加燃烧时，立刻造成 ${formatValue(p.procDamage)} 天火伤害。`;
            case "six-tail-fox":
                return `燃烧叠加至 ${formatValue(p.threshold)} 层以上时，${formatValue(p.delay, 1)} 秒后触发爆燃：引爆额外燃烧层数并将燃烧重置为 1 层，每引爆 1 层造成 ${formatValue(p.damagePerExtraLayer)} 天火伤害。`;
            case "yan-hong":
                return `释放技能时发射 1 枚冰箭，造成 ${formatValue(p.arrowDamage)} 玄冰伤害，每枚冰箭至多命中 ${formatValue(p.arrowTargets)} 名敌人（${formatValue(p.cooldown)} 秒内置冷却）。`;
            case "shangguan-ce":
                return `冰箭命中累加 ${formatValue(p.arrowMeterGain)} 玄冰值；碎裂伤害对所有目标各累加 ${formatValue(p.shatterMeterGain)}；玄冰风暴总计累加 ${formatValue(p.stormMeterGain)}；达到 ${formatValue(p.triggerThreshold)} 时触发玄冰激化。`;
            case "wen-min":
                return `冰箭伤害提高 ${formatValue(p.arrowDamageBonus * 100)}%；战斗中每经过 ${formatValue(p.volleyCooldown)} 秒，召唤 ${formatValue(p.volleyArrows)} 枚冰箭攻击敌人，每枚至多命中 ${formatValue(p.arrowTargets)} 名敌人。`;
            case "zuo-gui":
                return `冰箭和玄冰风暴伤害提高 ${formatValue(p.damageBonus * 100)}%；命中时有 ${formatValue(p.shatterChance * 100)}% 概率碎裂，对目标及周围所有敌人造成 ${formatValue(p.shatterDamage)} 玄冰伤害。`;
            case "qi-hao":
                return `召唤冰霜元素施放玄冰风暴，造成 ${formatValue(p.stormDamage)} 玄冰伤害；冰箭造成伤害时，玄冰风暴冷却缩短 ${formatValue(p.cooldownReductionPerArrowHit)} 秒（${formatValue(p.cooldown)} 秒内置冷却）。`;
            case "folding-fan":
                return `每 ${formatValue(p.interval)} 秒触发脉冲，对周围敌人造成 ${formatValue(p.pulseDamage)} 苍木伤害。`;
            case "cool-pearl":
                return `脉冲命中敌人时累加 ${formatValue(p.meterGain)} 苍木值；达到 ${formatValue(p.triggerThreshold)} 时触发苍木激化。`;
            case "sacred-wood-dice":
                return `脉冲造成伤害时，在 ${formatValue(p.echoDuration)} 秒内额外造成 ${formatValue(p.echoDamage)} 苍木伤害；进入战斗的 ${formatValue(p.openingPulseWindow)} 秒内总计额外触发 ${formatValue(p.openingPulseTimes)} 次脉冲。`;
            case "lin-feng":
                return `脉冲伤害提高 ${formatValue(p.damageBonus * 100)}%，每额外命中 1 名敌人该增幅降低 ${formatValue(p.reductionPerExtraEnemy * 100, 1)}%。`;
            case "liu-he-mirror":
                return `折扇的脉冲间隔缩短 ${formatValue(p.intervalReduction, 1)} 秒；脉冲触发时，2 秒内以 ${formatValue(p.extraPulseEfficiency * 100)}% 效能额外触发 ${formatValue(p.extraPulseCount)} 次脉冲。`;
            case "thunder-banner":
                return `造成伤害时触发连锁闪电，对最多 ${formatValue(p.maxEnemyTargets)} 名敌人造成 ${formatValue(p.chainDamage)} 神雷伤害（${formatValue(p.cooldown)} 秒内置冷却）。`;
            case "zi-xiao-gourd":
                return `连锁闪电命中敌人时累加 ${formatValue(p.meterGain)} 神雷值；达到 ${formatValue(p.triggerThreshold)} 时触发神雷激化。`;
            case "thunder-crystal":
                return `连锁闪电使目标进入静电过载，${formatValue(p.duration)} 秒内总计受到 ${formatValue(p.totalDamage)} 神雷伤害。`;
            case "chain-lightning-wall":
                return `连锁闪电伤害提高 ${formatValue(p.damageBonus * 100)}%；每额外命中 1 名敌人，伤害再提高 ${formatValue(p.extraEnemyBonus * 100)}%。`;
            case "purple-dragon":
                return `连锁闪电有 ${formatValue(p.extraTriggerChance * 100)}% 概率额外触发 1 次；进入战斗及其后每 ${formatValue(p.frenzyInterval)} 秒，连锁闪电转化为狂雷：以 ${formatValue(p.frenzyEfficiency * 100)}% 效能连续释放 ${formatValue(p.frenzyCount)} 次。`;
            default:
                return card.baseEffectText;
        }
    }

    function renderCards() {
        const grid = document.getElementById("cardGrid");
        const sections = Object.keys(ELEMENT_META).map(element => {
            const meta = ELEMENT_META[element];
            const cards = CARD_DEFS.filter(card => card.element === element);
            return `
                <div class="race-section">
                    ${cards.map(card => renderCard(card, meta)).join("")}
                </div>
            `;
        }).join("");
        grid.innerHTML = sections;
        CARD_DEFS.forEach(card => {
            if (selected.has(card.id)) updateLevel(card.id, selected.get(card.id).level, true);
            else {
                const slider = document.querySelector(`#star-ui-${card.id} input`);
                if (slider) slider.style.backgroundSize = "100% 100%";
            }
        });
    }

    function renderCard(card, meta) {
        const picked = selected.get(card.id);
        const level = picked ? picked.level : 6;
        const active = Boolean(picked);
        const effectText = describeCardAtLevel(card, level);
        return `
            <div id="card-anchor-${card.id}" class="card-box rounded-2xl ${meta.border} relative ${active ? "selected" : ""}" onclick="UI.toggleCard('${card.id}')">
                ${active ? `<div class="selected-badge">✓</div>` : ""}
                <div class="w-full">
                    <div class="flex justify-between items-center mb-1">
                        <div class="flex items-center gap-2 overflow-hidden">
                            <span class="text-[16px] font-black text-slate-800 tracking-tight leading-none truncate">${card.name}</span>
                            <span class="text-[11px] font-black px-2 py-0.5 rounded-md ${meta.tag} shrink-0">${meta.title}</span>
                        </div>
                        <div class="flex flex-col items-end shrink-0 ml-2">
                            <span class="text-[10px] bg-gradient-to-br from-slate-50 to-slate-100 text-slate-600 px-2 py-1 rounded-lg font-black tracking-tight border border-slate-200 shadow-sm">${card.fee}</span>
                        </div>
                    </div>

                    <div class="card-hover-panel">
                        <div class="card-copy">
                            <p>${effectText}</p>
                        </div>
                    </div>

                    <div id="star-ui-${card.id}" class="star-ui ${active ? "" : "hidden"}" onclick="event.stopPropagation()">
                        <div class="flex items-center gap-3 mt-4 mb-1">
                            <div class="flex-1 relative group/slider">
                                <input type="range" min="0" max="6" value="${level}" class="w-full h-1.5 star-slider" oninput="UI.updateLevel('${card.id}', this.value)">
                                <div class="absolute -top-7 left-[calc(var(--p,100%)-10px)] bg-slate-800 text-white text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover/slider:opacity-100 transition-opacity pointer-events-none font-black shadow-xl">
                                    <span id="bubble-${card.id}">${level}</span>★
                                </div>
                            </div>
                            <div class="flex flex-col items-center min-w-[24px]">
                                <span class="text-[11px] font-black text-indigo-600 leading-none"><span id="lv-${card.id}">${level}</span></span>
                                <span class="text-[10px] font-black text-indigo-400">★</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function renderMachineStones() {
        const grid = document.getElementById("machineStoneGrid");
        if (!grid) return;
        const sections = Object.keys(ELEMENT_META).map(element => {
            const meta = ELEMENT_META[element];
            const stones = MACHINE_STONE_DEFS.filter(stone => stone.element === element);
            return `<div class="machine-race-section">
                ${stones.map(stone => renderMachineStone(stone, meta)).join("")}
            </div>`;
        }).join("");
        grid.innerHTML = sections;
        grid.querySelectorAll("[data-machine-stone]").forEach(node => {
            const id = node.dataset.machineStone;
            node.addEventListener("click", event => {
                if (event.target.closest("input")) return;
                if (selectedMachineStones.has(id)) {
                    selectedMachineStones.delete(id);
                } else {
                    selectedMachineStones.set(id, { id, rank: 5 });
                }
                renderMachineStones();
                updateMachineSummary();
            });
        });
        grid.querySelectorAll(".machine-rank-slider").forEach(slider => {
            const id = slider.dataset.id;
            const item = selectedMachineStones.get(id);
            if (item) {
                const pct = ((item.rank - 1) / 4) * 100;
                slider.style.backgroundSize = `${pct}% 100%`;
            }
            slider.addEventListener("input", event => {
                const next = selectedMachineStones.get(id);
                if (!next) return;
                next.rank = parseInt(event.target.value, 10);
                const level = document.getElementById(`machine-rank-${id}`);
                if (level) level.innerText = next.rank;
                event.target.style.backgroundSize = `${((next.rank - 1) / 4) * 100}% 100%`;
                updateMachineSummary();
            });
            slider.addEventListener("click", event => event.stopPropagation());
            slider.addEventListener("mousedown", event => event.stopPropagation());
        });
    }

    function renderMachineStone(stone, meta) {
        const picked = selectedMachineStones.get(stone.id);
        const rank = picked ? picked.rank : 1;
        const pct = ((rank - 1) / 4) * 100;
        return `<div class="card-box rounded-2xl ${meta.border} relative ${picked ? "selected" : ""}" data-machine-stone="${stone.id}">
            ${picked ? `<div class="selected-badge">✓</div>` : ""}
            <div class="w-full">
                <div class="flex justify-between items-center mb-1">
                    <div class="flex items-center gap-2 overflow-hidden">
                        <span class="text-[16px] font-black text-slate-800 tracking-tight leading-none truncate">${stone.name}</span>
                        <span class="text-[11px] font-black px-2 py-0.5 rounded-md ${meta.tag} shrink-0">${meta.title}</span>
                    </div>
                </div>
                <div class="card-hover-panel">
                    <div class="card-copy">
                        <p>${stone.baseEffectText}</p>
                        <p class="upgrade-line whitespace-pre-line">${stone.upgradeText}</p>
                    </div>
                </div>
                <div class="star-ui ${picked ? "" : "hidden"}" onclick="event.stopPropagation()">
                    <div class="flex items-center gap-3 mt-4 mb-1">
                        <div class="flex-1 relative">
                            <input class="machine-rank-slider star-slider" type="range" min="1" max="5" value="${rank}" data-id="${stone.id}" style="background-size:${pct}% 100%">
                        </div>
                        <div class="flex flex-col items-center min-w-[30px]">
                            <span class="text-[11px] font-black text-indigo-600 leading-none"><span id="machine-rank-${stone.id}">${rank}</span>/5</span>
                            <span class="text-[10px] font-black text-indigo-400">★</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
    }

    function renderCraftStones() {
        const grid = document.getElementById("craftStoneGrid");
        if (!grid) return;
        grid.innerHTML = CRAFT_STONE_DEFS.map(stone => {
            const meta = ELEMENT_META[stone.element];
            const active = selectedCraftStone === stone.id;
            return `<div class="card-box rounded-2xl ${meta.border} relative ${active ? "selected" : ""}" data-craft-stone="${stone.id}">
                ${active ? `<div class="selected-badge">✓</div>` : ""}
                <div class="w-full">
                    <div class="flex justify-between items-center mb-1">
                        <div class="flex items-center gap-2 overflow-hidden">
                            <span class="text-[16px] font-black text-slate-800 tracking-tight leading-none truncate">${stone.name}</span>
                            <span class="text-[11px] font-black px-2 py-0.5 rounded-md ${meta.tag} shrink-0">${meta.title}</span>
                        </div>
                    </div>
                    <div class="card-hover-panel">
                        <div class="card-copy">
                            <p>${stone.baseEffectText}</p>
                            <p class="upgrade-line">基础技能 · ${stone.castTime}s 施法 · ${stone.cooldown}s 冷却</p>
                        </div>
                    </div>
                </div>
            </div>`;
        }).join("");
        grid.querySelectorAll("[data-craft-stone]").forEach(node => node.addEventListener("click", () => {
            selectedCraftStone = selectedCraftStone === node.dataset.craftStone ? null : node.dataset.craftStone;
            renderCraftStones();
            updateMachineSummary();
        }));
    }

    function updateMachineSummary() {
        const limit = 18;
        const label = document.getElementById("machineFeeLabel");
        if (!label) return;
        label.innerText = `${getMachineFee()} / ${limit} 费`;
        label.className = getMachineFee() > limit
            ? "rounded-full bg-red-500 px-2 py-1 text-white"
            : "rounded-full bg-white px-2 py-1 text-cyan-700";
    }

    function updateSummary() {
        const fee = getTotalFee();
        const label = document.getElementById("feeLabel");
        label.innerText = `${fee} / 15 费`;
        const baseClass = "ml-2 text-[15px] px-2 py-0.5 rounded-full font-black uppercase";
        label.className = fee > 15
            ? `${baseClass} fee-warning`
            : `${baseClass} bg-emerald-50 text-emerald-600 border border-emerald-100`;
    }

    function toggleCard(id) {
        const node = document.getElementById(`card-anchor-${id}`);
        const starUi = document.getElementById(`star-ui-${id}`);
        if (selected.has(id)) {
            selected.delete(id);
            if (node) node.classList.remove("selected");
            if (starUi) starUi.classList.add("hidden");
            const badge = node ? node.querySelector(".selected-badge") : null;
            if (badge) badge.remove();
        } else {
            selected.set(id, { id, level: 6 });
            if (node) node.classList.add("selected");
            if (starUi) starUi.classList.remove("hidden");
            if (node && !node.querySelector(".selected-badge")) {
                node.insertAdjacentHTML("afterbegin", `<div class="selected-badge">✓</div>`);
            }
        }
        renderCards();
        updateSummary();
    }

    function selectElement(element) {
        CARD_DEFS.filter(card => card.element === element).forEach(card => {
            if (!selected.has(card.id)) {
                selected.set(card.id, { id: card.id, level: 6 });
            }
        });
        renderCards();
        updateSummary();
    }

    function switchTab(tab) {
        currentTab = tab;
        document.getElementById("tab-basic").classList.toggle("hidden", tab !== "basic");
        document.getElementById("tab-advanced").classList.toggle("hidden", tab !== "advanced");
        document.getElementById("btn-tab-basic").classList.toggle("active", tab === "basic");
        document.getElementById("btn-tab-advanced").classList.toggle("active", tab === "advanced");
    }

    function generateSeason2Combos(cards, maxCost) {
        const results = [];
        const source = [...cards].sort((a, b) => a.fee - b.fee || a.name.localeCompare(b.name, 'zh-CN'));

        function backtrack(startIndex, current, cost) {
            if (cost > maxCost) return;
            if (current.length > 0) {
                results.push({
                    id: `${results.length + 1}`,
                    cost,
                    deck: current.map(item => ({ id: item.id, level: item.level }))
                });
            }
            if (cost === maxCost) return;
            for (let i = startIndex; i < source.length; i++) {
                const card = source[i];
                if (cost + card.fee > maxCost) continue;
                current.push(card);
                backtrack(i + 1, current, cost + card.fee);
                current.pop();
            }
        }

        backtrack(0, [], 0);

        // 15 费是理论上限，只在这一档强制用满；其余档位取费用最高的前 20 组。
        if (maxCost === 15) {
            const exact = results.filter(item => item.cost === 15);
            if (exact.length > 0) return exact;
        }
        return results
            .sort((a, b) => b.cost - a.cost || a.deck.length - b.deck.length)
            .slice(0, 20);
    }

    function renderSeason2BruteForceResults(results) {
        const resultBox = document.getElementById("bfResultBox");
        const resultList = document.getElementById("bfResultList");
        const top = results.slice(0, 10);
        resultList.innerHTML = top.map((item, index) => {
            const rankClass = index === 0 ? "top-1" : index === 1 ? "top-2" : index === 2 ? "top-3" : "";
            const colorize = (element, label) => {
                const cls = ELEMENT_META[element]?.text || "text-slate-600";
                return `<span class="${cls}">${label}</span>`;
            };
            const lineup = item.deck.map(entry => {
                const card = CARD_DEFS.find(c => c.id === entry.id);
                if (!card) return entry.id;
                return colorize(card.element, `${card.name}${entry.level === 6 ? '' : `(${entry.level})`}`);
            }).join('<span class="text-slate-300"> / </span>');
            const stones = (item.machineStones || []).map(entry => {
                const stone = MACHINE_STONE_DEFS.find(s => s.id === entry.id);
                if (!stone) return entry.id;
                return colorize(stone.element, `${stone.name}(${entry.rank})`);
            }).join('<span class="text-slate-300"> / </span>');
            const craftDef = item.craftStone
                ? CRAFT_STONE_DEFS.find(s => s.id === item.craftStone.id)
                : null;
            const craft = craftDef
                ? colorize(craftDef.element, craftDef.name)
                : (item.craftStone ? item.craftStone.id : null);
            const machineCost = (item.machineStones || []).reduce((sum, entry) => sum + entry.rank, 0);
            return `
                <div class="bf-result-item" data-lineup='${JSON.stringify({ deck: item.deck, machineStones: item.machineStones || [], craftStone: item.craftStone || null })}'>
                    <div class="flex items-center justify-between gap-3 mb-2">
                        <div class="flex items-center gap-2">
                            <span class="bf-rank ${rankClass}">${index + 1}</span>
                            <span class="text-sm font-black text-slate-700">${item.avgDps.toFixed(2)} DPS</span>
                        </div>
                        <span class="text-[11px] font-black text-slate-400 uppercase">${item.cost}费 / 机巧${machineCost}费</span>
                    </div>
                    <div class="text-[12px] leading-6 font-bold">${lineup}</div>
                    ${stones ? `<div class="text-[11px] leading-5 font-bold mt-1"><span class="text-slate-400">机巧石：</span>${stones}</div>` : ''}
                    ${craft ? `<div class="text-[11px] leading-5 font-bold"><span class="text-slate-400">匠心石：</span>${craft}</div>` : ''}
                </div>
            `;
        }).join("");
        resultBox.classList.remove("hidden");
        resultList.querySelectorAll(".bf-result-item").forEach(node => {
            node.addEventListener("click", () => {
                const payload = JSON.parse(node.dataset.lineup);
                selected.clear();
                payload.deck.forEach(item => selected.set(item.id, { id: item.id, level: item.level }));
                selectedMachineStones.clear();
                (payload.machineStones || []).forEach(item => selectedMachineStones.set(item.id, { id: item.id, rank: item.rank }));
                selectedCraftStone = payload.craftStone ? payload.craftStone.id : null;
                renderCards();
                renderMachineStones();
                renderCraftStones();
                updateSummary();
                updateMachineSummary();
                switchTab("basic");
            });
        });
    }

    function stopSeason2BruteForce() {
        bfStopped = true;
        if (bfWorkers.length > 0) {
            bfWorkers.forEach(worker => worker.terminate());
            bfWorkers = [];
        }
        document.getElementById("btnStopBF").classList.add("hidden");
        document.getElementById("bfStatusText").innerText = "已停止";
    }

    function runParallelSeason2(combos, iterations, duration, targetCount, externalSkillDps, onProgress) {
        return new Promise((resolve) => {
            // 主线程在等待期间基本空闲，用满所有核心。
            const threadCount = Math.max(1, navigator.hardwareConcurrency || 4);
            bfWorkers.forEach(worker => worker.terminate());
            bfWorkers = [];
            for (let i = 0; i < threadCount; i++) {
                bfWorkers.push(new Worker("worker.js"));
            }

            let finishedWorkers = 0;
            let processedCombos = 0;
            let allResults = [];
            const chunkSize = Math.ceil(combos.length / threadCount);

            bfWorkers.forEach((worker, index) => {
                const start = index * chunkSize;
                const end = Math.min(combos.length, (index + 1) * chunkSize);
                const chunk = combos.slice(start, end);
                if (chunk.length === 0) {
                    finishedWorkers += 1;
                    if (finishedWorkers === threadCount) resolve(allResults);
                    return;
                }

                worker.onmessage = (event) => {
                    if (bfStopped) return;
                    const { type, results, count } = event.data;
                    if (type === "PROGRESS_TICK") {
                        processedCombos += count || 1;
                        onProgress(processedCombos, combos.length);
                    } else if (type === "BATCH_DONE") {
                        allResults = allResults.concat(results);
                        finishedWorkers += 1;
                        if (finishedWorkers === threadCount) resolve(allResults);
                    }
                };

                worker.postMessage({ type: "BATCH", data: { combos: chunk, duration, iterations, targetCount, externalSkillDps } });
            });
        });
    }

    // 机巧石与丹青按元素绑定：跨系搭配时机巧石的触发源缺失，只会白占费用。
    // 左侧有勾选时只在勾选范围内搜索，全部未选才走全量。
    function buildElementPlans(crossElement) {
        const elements = Object.keys(ELEMENT_META);
        const hasPicked = selected.size > 0 || selectedMachineStones.size > 0 || Boolean(selectedCraftStone);
        const cardPool = hasPicked && selected.size > 0
            ? CARD_DEFS.filter(card => selected.has(card.id))
            : CARD_DEFS;
        const stonePool = hasPicked && selectedMachineStones.size > 0
            ? MACHINE_STONE_DEFS.filter(stone => selectedMachineStones.has(stone.id))
            : MACHINE_STONE_DEFS;
        const craftPool = hasPicked && selectedCraftStone
            ? CRAFT_STONE_DEFS.filter(stone => stone.id === selectedCraftStone)
            : CRAFT_STONE_DEFS;

        if (crossElement) {
            return [{
                element: null,
                cards: cardPool,
                stones: stonePool,
                crafts: craftPool
            }];
        }
        return elements
            .map(element => ({
                element,
                cards: cardPool.filter(card => card.element === element),
                stones: stonePool.filter(stone => stone.element === element),
                crafts: craftPool.filter(stone => stone.element === element)
            }))
            .filter(plan => plan.cards.length > 0 || plan.stones.length > 0);
    }

    // 系内空间可穷举：每条机巧石取 0~5 星，只保留恰好用满费用上限的配置。
    function generateMachineStoneCombos(stones, machineLimit) {
        const results = [];
        const current = [];

        function backtrack(index, cost) {
            if (index === stones.length) {
                if (cost === machineLimit) {
                    results.push(current.filter(item => item.rank > 0).map(item => ({ id: item.id, rank: item.rank })));
                }
                return;
            }
            const stone = stones[index];
            for (let rank = 0; rank <= 5; rank += 1) {
                if (cost + rank > machineLimit) break;
                current.push({ id: stone.id, rank });
                backtrack(index + 1, cost + rank);
                current.pop();
            }
        }

        backtrack(0, 0);
        return results;
    }

    async function startSeason2BruteForce() {
        const maxCost = parseInt(document.getElementById("bfMaxCost").value, 10) || 15;
        const iterations = parseInt(document.getElementById("bfIter").value, 10) || 20;
        const machineCostRaw = parseInt(document.getElementById("bfMachineCost")?.value, 10);
        const machineLimit = Number.isFinite(machineCostRaw) ? Math.max(0, machineCostRaw) : 18;
        const crossElement = Boolean(document.getElementById("bfCrossElement")?.checked);
        const duration = parseInt(document.getElementById("simTime").value, 10) || 240;
        const targetCount = parseInt(document.getElementById("targetCount").value, 10) || 1;
        const externalSkillDps = parseFloat(document.getElementById("externalSkillDps")?.value || "150000") || 150000;

        const statusText = document.getElementById("bfStatusText");
        const percentText = document.getElementById("bfPercent");
        const progressBar = document.getElementById("bfProgressBar");

        bfStopped = false;
        document.getElementById("bfPlaceholder").classList.add("hidden");
        document.getElementById("bfResultBox").classList.add("hidden");
        document.getElementById("bfProgressBox").classList.remove("hidden");
        document.getElementById("btnStopBF").classList.remove("hidden");
        statusText.innerText = "正在生成组合...";
        percentText.innerText = "0%";
        progressBar.style.width = "0%";

        const plans = buildElementPlans(crossElement);
        const combos = [];
        plans.forEach(plan => {
            const pool = plan.cards.map(card => ({
                ...card,
                level: selected.get(card.id)?.level ?? 6
            }));
            const deckCombos = generateSeason2Combos(pool, maxCost);
            const craftOptions = plan.crafts.length > 0
                ? plan.crafts.map(stone => ({ id: stone.id }))
                : [null];
            const stoneCombos = generateMachineStoneCombos(plan.stones, machineLimit);
            deckCombos.forEach(deckCombo => {
                stoneCombos.forEach(machineStones => {
                    craftOptions.forEach(craftStone => {
                        combos.push({
                            id: `${combos.length}`,
                            cost: deckCombo.cost,
                            deck: deckCombo.deck,
                            machineStones,
                            craftStone
                        });
                    });
                });
            });
        });

        if (combos.length === 0) {
            alert("没有找到符合费用条件的组合");
            document.getElementById("btnStopBF").classList.add("hidden");
            return;
        }

        // 粗筛用短时长换速度，只负责淘汰明显垫底的方案；长冷却技能的偏差由第二阶段纠正。
        const coarseDuration = Math.min(60, duration);
        const coarseTopN = Math.min(500, combos.length);
        const midTopN = Math.min(20, coarseTopN);
        const needCoarse = combos.length > coarseTopN;

        const totalTicks = (needCoarse ? combos.length + coarseTopN : combos.length) + midTopN;
        let ticks = 0;
        const bump = () => {
            ticks += 1;
            const percent = Math.min(99, Math.floor((ticks / totalTicks) * 100));
            percentText.innerText = `${percent}%`;
            progressBar.style.width = `${percent}%`;
        };

        const comboMap = new Map(combos.map(combo => [combo.id, combo]));
        const pickTop = (results, count) => results
            .sort((a, b) => b.avgDps - a.avgDps)
            .slice(0, count)
            .map(item => comboMap.get(item.id))
            .filter(Boolean);

        const totalStages = needCoarse ? 3 : 2;
        let stage = 0;
        let survivors = combos;

        if (needCoarse) {
            stage += 1;
            statusText.innerText = `[${stage}/${totalStages}] 粗筛 (${combos.length} 组 · ${coarseDuration}s)...`;
            const coarse = await runParallelSeason2(combos, 1, coarseDuration, targetCount, externalSkillDps, (finished, total) => {
                bump();
                statusText.innerText = `[${stage}/${totalStages}] 粗筛进度: ${finished} / ${total}`;
            });
            if (bfStopped) return;
            survivors = pickTop(coarse, coarseTopN);
        }

        stage += 1;
        statusText.innerText = `[${stage}/${totalStages}] 完整时长复筛 (${survivors.length} 组)...`;
        const refined = await runParallelSeason2(survivors, 1, duration, targetCount, externalSkillDps, (finished, total) => {
            bump();
            statusText.innerText = `[${stage}/${totalStages}] 复筛进度: ${finished} / ${total}`;
        });
        if (bfStopped) return;

        const finalists = pickTop(refined, midTopN);

        stage += 1;
        statusText.innerText = `[${stage}/${totalStages}] 精算 Top ${finalists.length}...`;
        const finalResults = await runParallelSeason2(finalists, iterations, duration, targetCount, externalSkillDps, (finished, total) => {
            bump();
            statusText.innerText = `[${stage}/${totalStages}] 精算进度: ${finished} / ${total}`;
        });
        if (bfStopped) return;

        renderSeason2BruteForceResults(finalResults.sort((a, b) => b.avgDps - a.avgDps));
        statusText.innerText = `完成，共遍历 ${combos.length} 个方案`;
        percentText.innerText = "100%";
        progressBar.style.width = "100%";
        document.getElementById("btnStopBF").classList.add("hidden");
        if (bfWorkers.length > 0) {
            bfWorkers.forEach(worker => worker.terminate());
            bfWorkers = [];
        }
    }

    function updateLevel(id, value, silent = false) {
        const level = parseInt(value, 10) || 0;
        if (!selected.has(id)) {
            selected.set(id, { id, level });
        } else {
            selected.get(id).level = level;
        }
        const lvNode = document.getElementById(`lv-${id}`);
        const bubbleNode = document.getElementById(`bubble-${id}`);
        if (lvNode) lvNode.innerText = level;
        if (bubbleNode) bubbleNode.innerText = level;

        const card = CARD_DEFS.find(entry => entry.id === id);
        const hoverTextNode = document.querySelector(`#card-anchor-${id} .card-copy p`);
        if (card && hoverTextNode) {
            hoverTextNode.innerText = describeCardAtLevel(card, level);
        }

        const slider = document.querySelector(`#star-ui-${id} input`);
        if (slider) {
            const pct = (level / 6) * 100;
            slider.style.backgroundSize = `${pct}% 100%`;
            slider.parentElement.style.setProperty("--p", `${pct}%`);
        }
        if (!silent) updateSummary();
    }

    function runSimulation() {
        const duration = parseInt(document.getElementById("simTime").value, 10) || 60;
        const iterations = parseInt(document.getElementById("simIter").value, 10) || 50;
        const targetCount = parseInt(document.getElementById("targetCount").value, 10) || 1;
        const externalSkillDps = parseFloat(document.getElementById("externalSkillDps")?.value || "150000") || 150000;
        const deck = getSelectedDeck();
        const machineStones = getSelectedMachineStones();
        if (deck.length === 0 && machineStones.length === 0 && !selectedCraftStone) {
            alert("请至少选择一张丹青、机巧石或匠心石");
            return;
        }

        const totals = [];
        const histories = [];
        const cardMap = new Map();
        const warningSet = new Set();

        for (let i = 0; i < iterations; i++) {
            const engine = new CombatEngine({
                deck,
                machineStones,
                craftStone: selectedCraftStone ? { id: selectedCraftStone } : null
            }, {
                duration,
                targetCount,
                seed: 1000 + i,
                externalSkillDps,
                // 只让第 1 轮记录日志，其余轮次保持原有性能。
                collectLog: i === 0
            });
            const result = engine.simulate();
            if (i === 0) {
                simulationLog = result.log || [];
                simulationLogTruncated = Boolean(result.logTruncated);
            }
            totals.push(result.totalDps);
            histories.push(result.dpsHistory);
            result.breakdown.byCard.forEach(item => {
                const current = cardMap.get(item.name) || 0;
                cardMap.set(item.name, current + item.damage);
            });
            result.warnings.forEach(text => warningSet.add(text));
            lastResult = result;
        }

        const avgDps = totals.reduce((sum, value) => sum + value, 0) / totals.length;
        const minDps = Math.min(...totals);
        const maxDps = Math.max(...totals);
        const stdDev = Math.sqrt(totals.reduce((sum, value) => sum + Math.pow(value - avgDps, 2), 0) / totals.length);
        const ci95 = 1.96 * (stdDev / Math.sqrt(totals.length));

        const averageCurve = [];
        const maxLength = Math.max(...histories.map(item => item.length));
        for (let i = 0; i < maxLength; i++) {
            let sum = 0;
            let count = 0;
            histories.forEach(history => {
                if (typeof history[i] === "number") {
                    sum += history[i];
                    count += 1;
                }
            });
            averageCurve.push(count ? Math.round(sum / count) : 0);
        }

        renderOverview({ avgDps, minDps, maxDps, ci95, iterations, targetCount, duration });
        renderBreakdown(cardMap, iterations, duration);
        renderWarnings(warningSet);
        renderChart(averageCurve);
        renderLog();
    }

    function matchesLogFilter(entry) {
        if (logFilter === "all") return true;
        if (entry.kind === logFilter) return true;
        // tags 让一条日志同时归入多个筛选，例如激化产出的伤害。
        return Array.isArray(entry.tags) && entry.tags.includes(logFilter);
    }

    function renderLog() {
        const body = document.getElementById("logBody");
        const meta = document.getElementById("logMeta");
        if (!body) return;

        const rows = logFilter === "all"
            ? simulationLog
            : simulationLog.filter(matchesLogFilter);

        if (meta) {
            const total = simulationLog.length;
            const shown = rows.length;
            const parts = [];
            if (total > 0) {
                parts.push(logFilter === "all" ? `${total} 条` : `${shown} / ${total} 条`);
                if (simulationLogTruncated) parts.push("已截断");
            }
            meta.innerText = parts.join(" · ");
        }

        if (rows.length === 0) {
            const hint = simulationLog.length === 0
                ? "运行基础模拟后显示第 1 轮日志"
                : "当前筛选下没有日志";
            body.innerHTML = `<p class="text-[11px] text-slate-400 py-6 text-center font-bold">${hint}</p>`;
            return;
        }

        body.innerHTML = rows.map(entry => {
            const kindLabel = LOG_KIND_LABELS[entry.kind] || entry.kind;
            const name = entry.name
                ? `<span class="log-name">${escapeHtml(entry.name)}</span> `
                : "";
            return `<div class="log-row">
                <span class="log-time">${entry.time.toFixed(1)}s</span>
                <span class="log-kind log-kind-${entry.kind}">${kindLabel}</span>
                <span class="log-text">${name}${escapeHtml(entry.message)}</span>
            </div>`;
        }).join("");
        body.scrollTop = 0;
    }

    function escapeHtml(text) {
        return String(text).replace(/[&<>"']/g, ch => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[ch]);
    }

    function setLogExpanded(expanded) {
        const card = document.getElementById("logCard");
        if (!card) return;
        logExpanded = expanded;
        card.classList.toggle("log-expanded", expanded);

        let backdrop = document.getElementById("logBackdrop");
        if (expanded && !backdrop) {
            backdrop = document.createElement("div");
            backdrop.id = "logBackdrop";
            backdrop.className = "log-backdrop";
            // 点击遮罩收起，和 Esc 行为一致。
            backdrop.addEventListener("click", () => setLogExpanded(false));
            document.body.appendChild(backdrop);
        } else if (!expanded && backdrop) {
            backdrop.remove();
        }

        const button = document.getElementById("btnExpandLog");
        if (button) {
            button.innerText = expanded ? "收起" : "放大";
            button.title = expanded ? "收起（Esc）" : "放大查看（Esc 退出）";
        }
    }

    function toggleLogExpanded() {
        setLogExpanded(!logExpanded);
    }

    function copyLog() {
        const rows = logFilter === "all"
            ? simulationLog
            : simulationLog.filter(matchesLogFilter);
        if (rows.length === 0) return;
        const text = rows
            .map(entry => `${entry.time.toFixed(1)}s\t[${LOG_KIND_LABELS[entry.kind] || entry.kind}]\t${entry.name ? entry.name + " — " : ""}${entry.message}`)
            .join("\n");
        const button = document.getElementById("btnCopyLog");
        const restore = () => {
            if (button) setTimeout(() => { button.innerText = "复制"; }, 1200);
        };
        navigator.clipboard?.writeText(text).then(() => {
            if (button) button.innerText = "已复制";
            restore();
        }).catch(() => {
            if (button) button.innerText = "复制失败";
            restore();
        });
    }

    function renderOverview(summary) {
        document.getElementById("avgDps").innerText = summary.avgDps.toFixed(2);
        document.getElementById("dpsMin").innerText = summary.minDps.toFixed(2);
        document.getElementById("dpsMax").innerText = summary.maxDps.toFixed(2);
        document.getElementById("dpsCi").innerText = summary.ci95.toFixed(2);
        document.getElementById("rangeMin").innerText = summary.minDps.toFixed(2);
        document.getElementById("rangeMax").innerText = summary.maxDps.toFixed(2);
        document.getElementById("simMeta").innerText = `${summary.duration}s · ${summary.targetCount} 目标 · ${summary.iterations} 次`;

        const chartBox = document.getElementById("dpsChart").closest('.bg-white');
        if (chartBox) chartBox.classList.remove('hidden');

        const denom = Math.max(1, summary.maxDps - summary.minDps + 1);
        const rangePercent = ((2 * summary.ci95) / denom) * 100;
        const leftPercent = ((summary.avgDps - summary.ci95 - summary.minDps) / denom) * 100;
        const rangeBar = document.getElementById("rangeBar");
        rangeBar.style.left = `${Math.max(0, leftPercent)}%`;
        rangeBar.style.width = `${Math.min(100, rangePercent)}%`;
    }

    function renderBreakdown(cardMap, iterations, duration) {
        const cardRows = Array.from(cardMap.entries())
            .map(([name, damage]) => ({ name, dps: damage / iterations / duration }))
            .sort((a, b) => b.dps - a.dps)
            .map(item => `<li><span>${item.name}</span><strong>${item.dps.toFixed(2)}</strong></li>`)
            .join("");

        document.getElementById("cardBreakdown").innerHTML = cardRows || "<li><span>暂无</span><strong>0</strong></li>";
    }

    function renderWarnings(warningSet) {
        const existing = document.getElementById("machineWarnings");
        if (existing) existing.remove();
        if (!warningSet || warningSet.size === 0) return;
        const statsGrid = document.querySelector('#tab-basic .grid.grid-cols-2.gap-3');
        if (!statsGrid) return;
        statsGrid.insertAdjacentHTML('afterend', `
            <div id="machineWarnings" class="warning-card">
                <h3>机巧石提示</h3>
                <ul>${Array.from(warningSet).map(text => `<li>${text}</li>`).join('')}</ul>
            </div>
        `);
    }

    function renderChart(data) {
        const ctx = document.getElementById("dpsChart").getContext("2d");
        if (chart) chart.destroy();
        const gradient = ctx.createLinearGradient(0, 0, 0, 260);
        gradient.addColorStop(0, "rgba(99, 102, 241, 0.28)");
        gradient.addColorStop(1, "rgba(99, 102, 241, 0.02)");
        chart = new Chart(ctx, {
            type: "line",
            data: {
                labels: data.map((_, idx) => `${idx + 1}s`),
                datasets: [{
                    label: "平均 DPS",
                    data,
                    borderColor: "#6366f1",
                    backgroundColor: gradient,
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    fill: true,
                    tension: 0.24
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: "index",
                    intersect: false
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: true,
                        backgroundColor: "rgba(15, 23, 42, 0.92)",
                        padding: 12,
                        displayColors: false,
                        callbacks: {
                            label(context) {
                                return `平均 DPS：${context.parsed.y}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: "rgba(148, 163, 184, 0.14)"
                        },
                        ticks: {
                            color: "#64748b",
                            maxTicksLimit: 8
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: "rgba(148, 163, 184, 0.16)"
                        },
                        ticks: {
                            color: "#64748b"
                        }
                    }
                }
            }
        });
    }

    function bind() {
        document.getElementById("runButton").addEventListener("click", runSimulation);
        document.getElementById("btn-tab-basic").addEventListener("click", () => switchTab("basic"));
        document.getElementById("btn-tab-advanced").addEventListener("click", () => switchTab("advanced"));
        document.getElementById("btnStartBF").addEventListener("click", startSeason2BruteForce);
        document.getElementById("btnStopBF").addEventListener("click", stopSeason2BruteForce);
        document.getElementById("btnCopyLog")?.addEventListener("click", copyLog);
        document.getElementById("btnExpandLog")?.addEventListener("click", toggleLogExpanded);
        document.addEventListener("keydown", event => {
            if (event.key === "Escape" && logExpanded) setLogExpanded(false);
        });
        document.querySelectorAll("#logFilters .log-filter").forEach(btn => {
            btn.addEventListener("click", () => {
                logFilter = btn.dataset.kind;
                document.querySelectorAll("#logFilters .log-filter").forEach(other => {
                    other.classList.toggle("active", other === btn);
                });
                renderLog();
            });
        });

        const externalSkillDpsInput = document.getElementById("externalSkillDps");
        const externalDpsVal = document.getElementById("externalDpsVal");
        const simTimeInput = document.getElementById("simTimeInput");
        const simIterInput = document.getElementById("simIterInput");
        const targetCountInput = document.getElementById("targetCountInput");

        const syncRangeLabels = () => {
            timeVal.innerText = simTime.value;
            iterVal.innerText = simIter.value;
            targetVal.innerText = targetCount.value;
            if (simTimeInput) simTimeInput.value = simTime.value;
            if (simIterInput) simIterInput.value = simIter.value;
            if (targetCountInput) targetCountInput.value = targetCount.value;
            externalDpsVal.innerText = externalSkillDpsInput.value || "0";

            const timePct = (simTime.value - 10) / (600 - 10) * 100;
            simTime.style.backgroundSize = `${timePct}% 100%`;

            const iterPct = (simIter.value - 1) / (200 - 1) * 100;
            simIter.style.backgroundSize = `${iterPct}% 100%`;

            const targetPct = (targetCount.value - 1) / (10 - 1) * 100;
            targetCount.style.backgroundSize = `${targetPct}% 100%`;
        };
        syncRangeLabels();
        simTime.addEventListener("input", syncRangeLabels);
        simIter.addEventListener("input", syncRangeLabels);
        targetCount.addEventListener("input", syncRangeLabels);
        externalSkillDpsInput.addEventListener("input", syncRangeLabels);
        if (simTimeInput) simTimeInput.addEventListener("input", () => { simTime.value = simTimeInput.value; syncRangeLabels(); });
        if (simIterInput) simIterInput.addEventListener("input", () => { simIter.value = simIterInput.value; syncRangeLabels(); });
        if (targetCountInput) targetCountInput.addEventListener("input", () => { targetCount.value = targetCountInput.value; syncRangeLabels(); });

        document.querySelectorAll(".star-batch-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const star = parseInt(btn.dataset.star, 10) || 0;
                selected.forEach(item => { item.level = star; });
                renderCards();
                updateSummary();
            });
        });

        document.getElementById("clearDeck").addEventListener("click", () => {
            selected.clear();
            selectedMachineStones.clear();
            selectedCraftStone = null;
            renderCards();
            renderMachineStones();
            renderCraftStones();
            updateSummary();
            updateMachineSummary();
        });
        document.getElementById("fullDeck").addEventListener("click", () => {
            CARD_DEFS.forEach(card => selected.set(card.id, { id: card.id, level: selected.get(card.id)?.level ?? 6 }));
            renderCards();
            updateSummary();
        });
        document.querySelectorAll(".element-select-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                selectElement(btn.dataset.element);
            });
        });
    }

    function boot() {
        initDefaults();
        renderCards();
        renderMachineStones();
        renderCraftStones();
        updateSummary();
        updateMachineSummary();
        bind();
    }

    window.UI = {
        toggleCard,
        updateLevel,
        runSimulation,
        getLastResult: () => lastResult,
        getSimulationLog: () => simulationLog
    };

    window.addEventListener("DOMContentLoaded", boot);
})();
