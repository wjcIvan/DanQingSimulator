(function (global) {
    const Data = global.Data || (typeof require !== "undefined" ? require("./data.js") : null);
    if (!Data) {
        throw new Error("Data is required before engine.js");
    }

    const ELEMENT_LABELS = {
        fire: "天火",
        ice: "玄冰",
        wood: "苍木",
        thunder: "神雷"
    };

    const TICK_MS = 100;
    const TICK_SECONDS = TICK_MS / 1000;

    function createRng(seed) {
        let value = seed % 2147483647;
        if (value <= 0) value += 2147483646;
        return function next() {
            value = value * 16807 % 2147483647;
            return (value - 1) / 2147483646;
        };
    }

    function createTarget() {
        return {
            burnStacks: 0,
            burnExpireAt: 0,
            burnTickAt: 0,
            combustAt: null,
            staticOverloadEvents: []
        };
    }

    class CombatEngine {
        constructor(deckConfig, options = {}) {
            this.duration = Math.max(1, Number(options.duration) || 60);
            this.targetCount = Math.max(1, Number(options.targetCount) || 1);
            this.seed = Number(options.seed) || Math.floor(Math.random() * 2147483647);
            this.rng = createRng(this.seed);
            this.time = 0;
            this.deck = this.buildDeck(deckConfig);
            this.targets = Array.from({ length: this.targetCount }, () => createTarget());
            this.queue = [];
            this.delayedEvents = [];
            this.warnings = [];
            this.breakdown = {
                byCard: {},
                byMechanic: {},
                byMechanicCount: {}
            };
            this.meters = {
                fire: 0,
                ice: 0,
                wood: 0,
                thunder: 0
            };
            this.amplifyTriggers = {
                fire: 0,
                ice: 0,
                wood: 0,
                thunder: 0
            };
            this.timeline = [];
            this.totalDamage = 0;
            this.lastSecondSample = 0;
            this.globalEffects = this.collectGlobalEffects();
            this.nextThunderFrenzyAt = this.globalEffects.thunder.frenzyCount > 0 ? 0 : Infinity;
            this.initializeDeckState();
        }

        buildDeck(deckConfig) {
            return (deckConfig || []).map(item => {
                const def = Data.getCardDefById(item.id);
                if (!def) {
                    throw new Error(`Unknown season2 card id: ${item.id}`);
                }
                const level = Math.max(0, Math.min(6, parseInt(item.level, 10) || 0));
                return {
                    id: def.id,
                    name: def.name,
                    element: def.element,
                    fee: def.fee,
                    level,
                    mechanics: def.mechanics.slice(),
                    params: Data.resolveCardParams(def, level),
                    notes: def.notes || [],
                    state: {}
                };
            });
        }

        collectGlobalEffects() {
            const effects = {
                fire: {
                    burnTickRateBonus: 0,
                    extraStackChance: 0,
                    burnApplyProcDamage: 0,
                    blazeOnBurn: 0,
                    blazeOnCombust: 0,
                    combustThreshold: null,
                    combustDelay: 1.5,
                    combustDamagePerExtraLayer: 0
                },
                ice: {
                    arrowDamageBonus: 0,
                    shatterChance: 0,
                    shatterDamage: 0,
                    arrowMeterGain: 0,
                    shatterMeterGain: 0,
                    stormMeterGain: 0,
                    triggerThreshold: null
                },
                wood: {
                    pulseDamageBonus: 0,
                    pulseDamageReductionPerExtraEnemy: 0,
                    pulseMeterGain: 0,
                    pulseIntervalReduction: 0,
                    extraPulseCount: 0,
                    extraPulseEfficiency: 0,
                    extraPulseSpacing: 1,
                    pulseEchoDamage: 0,
                    pulseEchoDuration: 10,
                    openingPulseTimes: 0,
                    openingPulseWindow: 6,
                    triggerThreshold: null
                },
                thunder: {
                    chainDamageBonus: 0,
                    chainExtraEnemyBonus: 0,
                    thunderMeterGain: 0,
                    staticOverloadDamage: 0,
                    staticOverloadDuration: 8,
                    extraTriggerChance: 0,
                    frenzyEfficiency: 0,
                    frenzyCount: 0,
                    frenzyInterval: 30,
                    triggerThreshold: null
                }
            };

            this.deck.forEach(card => {
                switch (card.id) {
                    case "sui-shou":
                        effects.fire.burnTickRateBonus += card.params.tickRateBonus;
                        effects.fire.extraStackChance += card.params.extraStackChance;
                        break;
                    case "two-tail-fox":
                        effects.fire.burnApplyProcDamage += card.params.procDamage;
                        break;
                    case "fierce-tiger":
                        effects.fire.blazeOnBurn += card.params.burnMeterGain;
                        effects.fire.blazeOnCombust += card.params.combustMeterGain;
                        effects.fire.triggerThreshold = card.params.triggerThreshold;
                        break;
                    case "six-tail-fox":
                        effects.fire.combustThreshold = card.params.threshold;
                        effects.fire.combustDelay = card.params.delay;
                        effects.fire.combustDamagePerExtraLayer += card.params.damagePerExtraLayer;
                        break;
                    case "wen-min":
                        effects.ice.arrowDamageBonus += card.params.arrowDamageBonus;
                        break;
                    case "zuo-gui":
                        effects.ice.arrowDamageBonus += card.params.damageBonus;
                        effects.ice.shatterChance += card.params.shatterChance;
                        effects.ice.shatterDamage += card.params.shatterDamage;
                        break;
                    case "shangguan-ce":
                        effects.ice.arrowMeterGain += card.params.arrowMeterGain;
                        effects.ice.shatterMeterGain += card.params.shatterMeterGain;
                        effects.ice.stormMeterGain += card.params.stormMeterGain;
                        effects.ice.triggerThreshold = card.params.triggerThreshold;
                        break;
                    case "cool-pearl":
                        effects.wood.pulseMeterGain += card.params.meterGain;
                        effects.wood.triggerThreshold = card.params.triggerThreshold;
                        break;
                    case "sacred-wood-dice":
                        effects.wood.pulseEchoDamage += card.params.echoDamage;
                        effects.wood.pulseEchoDuration = card.params.echoDuration;
                        effects.wood.openingPulseTimes += card.params.openingPulseTimes;
                        effects.wood.openingPulseWindow = Math.max(effects.wood.openingPulseWindow, card.params.openingPulseWindow);
                        break;
                    case "lin-feng":
                        effects.wood.pulseDamageBonus += card.params.damageBonus;
                        effects.wood.pulseDamageReductionPerExtraEnemy += card.params.reductionPerExtraEnemy;
                        break;
                    case "liu-he-mirror":
                        effects.wood.pulseIntervalReduction += card.params.intervalReduction;
                        effects.wood.extraPulseCount += card.params.extraPulseCount;
                        effects.wood.extraPulseEfficiency = Math.max(effects.wood.extraPulseEfficiency, card.params.extraPulseEfficiency);
                        effects.wood.extraPulseSpacing = card.params.extraPulseSpacing;
                        break;
                    case "zi-xiao-gourd":
                        effects.thunder.thunderMeterGain += card.params.meterGain;
                        effects.thunder.triggerThreshold = card.params.triggerThreshold;
                        break;
                    case "thunder-crystal":
                        effects.thunder.staticOverloadDamage += card.params.totalDamage;
                        effects.thunder.staticOverloadDuration = card.params.duration;
                        break;
                    case "chain-lightning-wall":
                        effects.thunder.chainDamageBonus += card.params.damageBonus;
                        effects.thunder.chainExtraEnemyBonus += card.params.extraEnemyBonus;
                        break;
                    case "purple-dragon":
                        effects.thunder.extraTriggerChance = Math.max(effects.thunder.extraTriggerChance, card.params.extraTriggerChance);
                        effects.thunder.frenzyEfficiency = Math.max(effects.thunder.frenzyEfficiency, card.params.frenzyEfficiency);
                        effects.thunder.frenzyCount = Math.max(effects.thunder.frenzyCount, card.params.frenzyCount);
                        effects.thunder.frenzyInterval = card.params.frenzyInterval;
                        break;
                    default:
                        break;
                }
            });

            return effects;
        }

        initializeDeckState() {
            this.deck.forEach(card => {
                switch (card.id) {
                    case "scarlet-ant":
                        card.state.nextApplyAt = 0;
                        break;
                    case "yan-hong":
                        card.state.nextShotAt = 0;
                        break;
                    case "wen-min":
                        card.state.nextVolleyAt = Math.max(1, card.params.volleyCooldown);
                        break;
                    case "qi-hao":
                        card.state.cooldownRemaining = 0;
                        card.state.isBursting = false;
                        card.state.burstHitsDone = 0;
                        card.state.nextBurstHitAt = 0;
                        card.state.burstTickInterval = card.params.burstDuration / card.params.burstHits;
                        break;
                    case "folding-fan":
                        card.state.nextPulseAt = Math.max(1, card.params.interval - this.globalEffects.wood.pulseIntervalReduction);
                        break;
                    case "sacred-wood-dice":
                        card.state.openingPulsesLeft = card.params.openingPulseTimes;
                        card.state.openingSchedule = [0, 2, 4].slice(0, card.params.openingPulseTimes);
                        break;
                    case "thunder-banner":
                        card.state.nextChainAt = 0;
                        break;
                    case "purple-dragon":
                        card.state.nextFrenzyAt = 0;
                        break;
                    default:
                        break;
                }
            });
        }

        random() {
            return this.rng();
        }

        queueEvent(event) {
            this.queue.push(event);
        }

        scheduleEvent(triggerAt, handler) {
            this.delayedEvents.push({ triggerAt, handler });
        }

        addDamage(amount, cardId, mechanic) {
            const dmg = Math.max(0, amount || 0);
            if (dmg <= 0) return;
            this.totalDamage += dmg;
            this.breakdown.byCard[cardId] = (this.breakdown.byCard[cardId] || 0) + dmg;
            this.breakdown.byMechanic[mechanic] = (this.breakdown.byMechanic[mechanic] || 0) + dmg;
            this.breakdown.byMechanicCount[mechanic] = (this.breakdown.byMechanicCount[mechanic] || 0) + 1;
        }

        addMeter(element, amount) {
            if (!amount) return;
            this.meters[element] += amount;
            const threshold = this.getElementThreshold(element);
            if (!threshold) return;
            while (this.meters[element] >= threshold) {
                this.meters[element] -= threshold;
                this.scheduleEvent(this.time + TICK_SECONDS, () => {
                    this.amplifyTriggers[element] += 1;
                    this.triggerAmplify(element);
                });
            }
        }

        triggerAmplify(element) {
            switch (element) {
                case "fire": {
                    [2, 4, 6, 8, 10].forEach(delay => {
                        this.scheduleEvent(this.time + delay, () => {
                            this.addDamage(39181, "fierce-tiger", "fire_amplify");
                        });
                    });
                    break;
                }
                case "ice": {
                    this.addDamage(43534, "shangguan-ce", "ice_amplify");
                    this.scheduleEvent(this.time + 2, () => {
                        this.addDamage(85327, "shangguan-ce", "ice_amplify");
                    });
                    break;
                }
                case "wood": {
                    let tickCount = 0;
                    [1, 2, 3, 4, 5, 6, 7, 8, 9].forEach(delay => {
                        this.scheduleEvent(this.time + delay, () => {
                            this.addDamage(24916, "cool-pearl", "wood_amplify");
                            tickCount += 1;
                            if (tickCount % 3 === 0) {
                                this.addDamage(72108, "cool-pearl", "wood_bloom");
                            }
                        });
                    });
                    break;
                }
                case "thunder": {
                    this.addDamage(93805 * this.targetCount, "zi-xiao-gourd", "thunder_amplify");
                    break;
                }
                default:
                    break;
            }
        }

        getElementThreshold(element) {
            switch (element) {
                case "fire": return this.globalEffects.fire.triggerThreshold;
                case "ice": return this.globalEffects.ice.triggerThreshold;
                case "wood": return this.globalEffects.wood.triggerThreshold;
                case "thunder": return this.globalEffects.thunder.triggerThreshold;
                default: return null;
            }
        }

        simulate() {
            while (this.time < this.duration) {
                this.time = Number((this.time + TICK_SECONDS).toFixed(4));
                this.updateCards();
                this.updateTargets();
                this.flushQueue();
                this.sampleTimeline();
            }

            return this.finalize();
        }

        updateCards() {
            this.deck.forEach(card => {
                switch (card.id) {
                    case "scarlet-ant":
                        if (this.time >= card.state.nextApplyAt) {
                            this.triggerScarletAnt(card);
                            card.state.nextApplyAt += card.params.assumedApplyInterval;
                        }
                        break;
                    case "yan-hong":
                        if (this.time >= card.state.nextShotAt) {
                            this.fireIceArrow(card, 1, this.getIceArrowDamage(card.params.arrowDamage), "ice_arrow", card.params.arrowTargets);
                            card.state.nextShotAt += card.params.cooldown;
                        }
                        break;
                    case "wen-min":
                        if (this.time >= card.state.nextVolleyAt) {
                            this.fireIceArrow(card, card.params.volleyArrows, this.getIceArrowDamage(this.deck.find(entry => entry.id === "yan-hong")?.params.arrowDamage || 4830), "ice_arrow_volley", card.params.arrowTargets);
                            card.state.nextVolleyAt += Math.max(1, card.params.volleyCooldown);
                        }
                        break;
                    case "qi-hao":
                        card.state.cooldownRemaining -= TICK_SECONDS;
                        if (!card.state.isBursting && card.state.cooldownRemaining <= 0) {
                            card.state.isBursting = true;
                            card.state.burstHitsDone = 0;
                            card.state.burstTickInterval = card.params.burstDuration / card.params.burstHits;
                            card.state.nextBurstHitAt = this.time;
                            card.state.cooldownRemaining += card.params.cooldown;
                        }
                        if (card.state.isBursting && this.time >= card.state.nextBurstHitAt && card.state.burstHitsDone < card.params.burstHits) {
                            this.castIceStorm(card, 1 / card.params.burstHits, card.state.burstHitsDone === 0);
                            card.state.burstHitsDone += 1;
                            card.state.nextBurstHitAt += card.state.burstTickInterval;
                            if (card.state.burstHitsDone >= card.params.burstHits) {
                                card.state.isBursting = false;
                            }
                        }
                        break;
                    case "folding-fan":
                        if (this.time >= card.state.nextPulseAt) {
                            this.triggerPulse(card, 1, "pulse");
                            card.state.nextPulseAt += Math.max(1, card.params.interval - this.globalEffects.wood.pulseIntervalReduction);
                        }
                        break;
                    case "sacred-wood-dice":
                        if (card.state.openingSchedule && card.state.openingSchedule.length > 0 && this.time >= card.state.openingSchedule[0]) {
                            this.triggerPulse(card, 1, "opening_pulse");
                            card.state.openingSchedule.shift();
                        }
                        break;
                    case "thunder-banner":
                        if (this.time < this.duration && this.time >= card.state.nextChainAt) {
                            const useFrenzy = this.time >= this.nextThunderFrenzyAt;
                            if (useFrenzy) {
                                this.triggerFrenzy(this.deck.find(entry => entry.id === "purple-dragon"));
                                this.nextThunderFrenzyAt += this.globalEffects.thunder.frenzyInterval;
                            } else {
                                this.triggerChainLightning(card, 1, false);
                            }
                            card.state.nextChainAt += card.params.cooldown;
                        }
                        break;
                    case "purple-dragon":
                        break;
                    default:
                        break;
                }
            });
        }

        updateTargets() {
            this.targets.forEach((target, index) => {
                if (target.burnStacks > 0 && this.time >= target.burnExpireAt) {
                    target.burnStacks = 0;
                    target.burnExpireAt = 0;
                    target.burnTickAt = 0;
                    target.combustAt = null;
                }

                if (target.burnStacks > 0 && this.time < this.duration && this.time >= target.burnTickAt) {
                    this.queueEvent({ type: "BURN_TICK", targetIndex: index });
                    target.burnTickAt += this.getBurnTickInterval();
                }

                if (target.combustAt !== null && this.time < this.duration && this.time >= target.combustAt) {
                    this.queueEvent({ type: "COMBUST", targetIndex: index });
                    target.combustAt = null;
                }

                if (target.staticOverloadEvents.length > 0) {
                    target.staticOverloadEvents = target.staticOverloadEvents.filter(event => {
                        if (this.time >= event.triggerAt) {
                            this.addDamage(event.damagePerTick, event.cardId, "static_overload");
                            return false;
                        }
                        return true;
                    });
                }
            });

            if (this.delayedEvents.length > 0) {
                const readyEvents = [];
                const pendingEvents = [];
                this.delayedEvents.forEach(event => {
                    if (this.time >= event.triggerAt) {
                        readyEvents.push(event);
                    } else {
                        pendingEvents.push(event);
                    }
                });
                this.delayedEvents = pendingEvents;
                readyEvents.forEach(event => {
                    event.handler();
                });
            }
        }

        flushQueue() {
            while (this.queue.length > 0) {
                const event = this.queue.shift();
                switch (event.type) {
                    case "BURN_TICK":
                        this.handleBurnTick(event.targetIndex);
                        break;
                    case "COMBUST":
                        this.handleCombust(event.targetIndex);
                        break;
                    default:
                        break;
                }
            }
        }

        sampleTimeline() {
            const currentSecond = Math.floor(this.time + 1e-9);
            if (currentSecond > this.lastSecondSample && currentSecond <= this.duration) {
                this.timeline.push(Math.round(this.totalDamage / currentSecond));
                this.lastSecondSample = currentSecond;
            }
        }

        getBurnTickInterval() {
            const bonus = this.globalEffects.fire.burnTickRateBonus;
            return Math.max(0.3, 3 / (1 + bonus));
        }

        getIceArrowDamage(baseDamage = 4830) {
            return baseDamage * (1 + this.globalEffects.ice.arrowDamageBonus);
        }

        getPulseDamage(baseDamage) {
            const extraEnemies = Math.max(0, this.targetCount - 1);
            const bonus = this.globalEffects.wood.pulseDamageBonus - (this.globalEffects.wood.pulseDamageReductionPerExtraEnemy * extraEnemies);
            return baseDamage * (1 + Math.max(-0.95, bonus));
        }

        getChainDamage(baseDamage, targetsHit) {
            const extraEnemies = Math.max(0, targetsHit - 1);
            const bonus = this.globalEffects.thunder.chainDamageBonus + this.globalEffects.thunder.chainExtraEnemyBonus * extraEnemies;
            return baseDamage * (1 + bonus);
        }

        triggerScarletAnt(card) {
            const hits = Math.min(card.params.maxTargets, this.targetCount);
            for (let i = 0; i < hits; i++) {
                this.applyBurn(i, card, 1, true, true);
            }
        }

        applyBurn(targetIndex, card, stacks, refreshDuration, shouldIgnite = true, preserveTick = false) {
            const target = this.targets[targetIndex];
            const beforeStacks = target.burnStacks;
            const maxStacks = card.params.burnMaxStacks;
            const existingTickAt = target.burnTickAt;
            target.burnStacks = Math.min(maxStacks, target.burnStacks + stacks);
            if (refreshDuration) {
                target.burnExpireAt = this.time + card.params.burnDuration;
            }
            if (preserveTick && existingTickAt > this.time) {
                target.burnTickAt = existingTickAt;
            } else if (!target.burnTickAt || target.burnTickAt <= this.time) {
                target.burnTickAt = this.time + this.getBurnTickInterval();
            }

            if (shouldIgnite && this.globalEffects.fire.burnApplyProcDamage > 0) {
                this.addDamage(this.globalEffects.fire.burnApplyProcDamage, "two-tail-fox", "ignite");
            }

            if (this.globalEffects.fire.combustThreshold !== null && target.burnStacks >= this.globalEffects.fire.combustThreshold && beforeStacks < this.globalEffects.fire.combustThreshold) {
                target.combustAt = this.time + this.globalEffects.fire.combustDelay;
            }
        }

        handleBurnTick(targetIndex) {
            const target = this.targets[targetIndex];
            if (target.burnStacks <= 0) return;

            const scarletAnt = this.deck.find(card => card.id === "scarlet-ant");
            if (!scarletAnt) return;

            const perLayerBase = scarletAnt.params.burnDamage;
            const damage = perLayerBase * (1 + Math.max(0, target.burnStacks - 1) * scarletAnt.params.extraLayerBonus);
            this.addDamage(damage, scarletAnt.id, "burn_tick");
            this.addMeter("fire", this.globalEffects.fire.blazeOnBurn);

            if (this.globalEffects.fire.extraStackChance > 0 && target.burnStacks < scarletAnt.params.burnMaxStacks && this.random() < this.globalEffects.fire.extraStackChance) {
                this.applyBurn(targetIndex, scarletAnt, 1, false, true);
            }
        }

        handleCombust(targetIndex) {
            const target = this.targets[targetIndex];
            const threshold = this.globalEffects.fire.combustThreshold;
            if (threshold === null || target.burnStacks < threshold) return;
            const damage = target.burnStacks * this.globalEffects.fire.combustDamagePerExtraLayer;
            this.addDamage(damage, "six-tail-fox", "combust");
            this.addMeter("fire", this.globalEffects.fire.blazeOnCombust);
            const preservedTickAt = target.burnTickAt;
            target.burnStacks = 0;
            target.burnExpireAt = 0;
            target.burnTickAt = preservedTickAt;
            const scarletAnt = this.deck.find(card => card.id === "scarlet-ant");
            if (scarletAnt) {
                this.applyBurn(targetIndex, scarletAnt, 1, true, true, true);
            }
        }

        fireIceArrow(card, arrowCount, damagePerArrow, mechanic, maxTargets) {
            const targetsHit = Math.min(this.targetCount, maxTargets || this.targetCount);
            for (let i = 0; i < arrowCount; i++) {
                const totalDamage = damagePerArrow * targetsHit;
                this.addDamage(totalDamage, card.id, mechanic);
                if (this.globalEffects.ice.arrowMeterGain > 0) {
                    this.addMeter("ice", this.globalEffects.ice.arrowMeterGain * targetsHit);
                }
                if (this.globalEffects.ice.shatterChance > 0 && this.random() < this.globalEffects.ice.shatterChance) {
                    this.addDamage(this.globalEffects.ice.shatterDamage * this.targetCount, "zuo-gui", "shatter");
                    if (this.globalEffects.ice.shatterMeterGain > 0) {
                        this.addMeter("ice", this.globalEffects.ice.shatterMeterGain * this.targetCount);
                    }
                }

                const qiHao = this.deck.find(entry => entry.id === "qi-hao");
                if (qiHao) {
                    qiHao.state.cooldownRemaining = Math.max(0, qiHao.state.cooldownRemaining - (qiHao.params.cooldownReductionPerArrowHit * targetsHit));
                }
            }
        }

        castIceStorm(card, efficiency, shouldAddStormMeter = true) {
            const stormOnlyBonus = this.deck.find(entry => entry.id === "zuo-gui") ? this.deck.find(entry => entry.id === "zuo-gui").params.damageBonus : 0;
            const damage = card.params.stormDamage * (1 + stormOnlyBonus) * efficiency;
            this.addDamage(damage, card.id, efficiency < 1 ? "ice_storm_frenzy" : "ice_storm");
            if (shouldAddStormMeter && this.globalEffects.ice.stormMeterGain > 0) {
                this.addMeter("ice", this.globalEffects.ice.stormMeterGain);
            }
            if (this.globalEffects.ice.shatterChance > 0 && this.random() < this.globalEffects.ice.shatterChance) {
                this.addDamage(this.globalEffects.ice.shatterDamage * this.targetCount, "zuo-gui", "shatter");
                if (this.globalEffects.ice.shatterMeterGain > 0) {
                    this.addMeter("ice", this.globalEffects.ice.shatterMeterGain * this.targetCount);
                }
            }
        }

        triggerPulse(card, efficiency, mechanic) {
            const base = this.getPulseDamage(card.params.pulseDamage || 9792);
            const damage = base * this.targetCount * efficiency;
            this.addDamage(damage, card.id, mechanic);
            if (this.globalEffects.wood.pulseMeterGain > 0) {
                this.addMeter("wood", this.globalEffects.wood.pulseMeterGain * this.targetCount);
            }
            if (this.globalEffects.wood.pulseEchoDamage > 0) {
                const echoTickDamage = (this.globalEffects.wood.pulseEchoDamage * this.targetCount * efficiency) / 5;
                [2, 4, 6, 8, 10].forEach(delay => {
                    this.scheduleEvent(this.time + delay, () => {
                        this.addDamage(echoTickDamage, "sacred-wood-dice", "pulse_echo");
                    });
                });
            }
            if (this.globalEffects.wood.extraPulseCount > 0 && mechanic !== "pulse_followup") {
                for (let i = 0; i < this.globalEffects.wood.extraPulseCount; i++) {
                    const delay = i === 0 ? 0 : this.globalEffects.wood.extraPulseSpacing * i;
                    const rawTriggerAt = this.time + delay;
                    const triggerAt = rawTriggerAt > this.duration && rawTriggerAt <= this.duration + 1
                        ? this.duration
                        : rawTriggerAt;
                    this.scheduleEvent(triggerAt, () => {
                        this.triggerPulse(card, this.globalEffects.wood.extraPulseEfficiency, "pulse_followup");
                    });
                }
            }
        }

        triggerChainLightning(card, efficiency, canTriggerFrenzy = false) {
            const targetsHit = Math.min(this.targetCount, card.params.maxEnemyTargets || 3);
            const damagePerTarget = this.getChainDamage(card.params.chainDamage, targetsHit) * efficiency;
            this.addDamage(damagePerTarget * targetsHit, card.id, efficiency < 1 ? "chain_lightning_frenzy" : "chain_lightning");
            if (this.globalEffects.thunder.thunderMeterGain > 0) {
                this.addMeter("thunder", this.globalEffects.thunder.thunderMeterGain * targetsHit);
            }
            if (this.globalEffects.thunder.staticOverloadDamage > 0) {
                this.applyStaticOverload(card.id, targetsHit, 1);
            }
            if (this.globalEffects.thunder.extraTriggerChance > 0 && this.random() < this.globalEffects.thunder.extraTriggerChance) {
                this.addDamage(damagePerTarget * targetsHit, "purple-dragon", "chain_lightning_extra");
                if (this.globalEffects.thunder.thunderMeterGain > 0) {
                    this.addMeter("thunder", this.globalEffects.thunder.thunderMeterGain * targetsHit);
                }
                if (this.globalEffects.thunder.staticOverloadDamage > 0) {
                    this.applyStaticOverload("purple-dragon", targetsHit, 1);
                }
                if (canTriggerFrenzy) {
                    for (let i = 0; i < this.globalEffects.thunder.frenzyCount; i++) {
                        this.triggerChainLightning(card, this.globalEffects.thunder.frenzyEfficiency, false);
                    }
                }
            }
        }

        triggerFrenzy(card) {
            if (!card || this.globalEffects.thunder.frenzyCount <= 0) return;
            const thunderBanner = this.deck.find(entry => entry.id === "thunder-banner");
            if (!thunderBanner) return;
            for (let i = 0; i < this.globalEffects.thunder.frenzyCount; i++) {
                this.triggerChainLightning(thunderBanner, this.globalEffects.thunder.frenzyEfficiency, false);
            }
        }

        applyStaticOverload(cardId, targetsHit, efficiency) {
            const totalDamage = this.globalEffects.thunder.staticOverloadDamage * efficiency;
            const ticks = 4;
            const perTick = totalDamage / ticks;
            for (let targetIndex = 0; targetIndex < targetsHit; targetIndex++) {
                for (let i = 1; i <= ticks; i++) {
                    this.targets[targetIndex].staticOverloadEvents.push({
                        triggerAt: this.time + (this.globalEffects.thunder.staticOverloadDuration / ticks) * i,
                        damagePerTick: perTick,
                        cardId: cardId === "thunder-banner" ? "thunder-crystal" : cardId
                    });
                }
            }
        }

        finalize() {
            const duration = Math.max(1, this.duration);
            const byCard = Object.entries(this.breakdown.byCard)
                .map(([cardId, damage]) => {
                    const card = this.deck.find(item => item.id === cardId) || Data.getCardDefById(cardId) || { name: cardId };
                    return {
                        id: cardId,
                        name: card.name,
                        damage: Math.round(damage),
                        dps: Number((damage / duration).toFixed(2))
                    };
                })
                .sort((a, b) => b.damage - a.damage);

            const byMechanic = Object.entries(this.breakdown.byMechanic)
                .map(([mechanic, damage]) => ({
                    mechanic,
                    damage: Math.round(damage),
                    dps: Number((damage / duration).toFixed(2)),
                    count: this.breakdown.byMechanicCount[mechanic] || 0
                }))
                .sort((a, b) => b.damage - a.damage);

            return {
                totalDamage: Math.round(this.totalDamage),
                totalDps: Number((this.totalDamage / duration).toFixed(2)),
                duration,
                targetCount: this.targetCount,
                dpsHistory: this.timeline,
                breakdown: {
                    byCard,
                    byMechanic
                },
                meters: {
                    fire: Math.round(this.meters.fire),
                    ice: Math.round(this.meters.ice),
                    wood: Math.round(this.meters.wood),
                    thunder: Math.round(this.meters.thunder)
                },
                amplifyTriggers: { ...this.amplifyTriggers },
                warnings: this.warnings.slice(),
                seed: this.seed
            };
        }
    }

    const api = {
        CombatEngine,
        ELEMENT_LABELS
    };

    global.Engine = api;
    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    }
})(typeof window !== "undefined" ? window : globalThis);
