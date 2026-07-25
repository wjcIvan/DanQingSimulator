(function (global) {
    const Data = global.Data || (typeof require !== "undefined" ? require("./data.js") : null);
    if (!Data) {
        throw new Error("Data is required before engine.js");
    }

    // Public API
    const ELEMENT_LABELS = {
        fire: "天火",
        ice: "玄冰",
        wood: "苍木",
        thunder: "神雷"
    };

    // Card ids and execution order
    const CARD_IDS = {
        SCARLET_ANT: "scarlet-ant",
        FIERCE_TIGER: "fierce-tiger",
        SUI_SHOU: "sui-shou",
        TWO_TAIL_FOX: "two-tail-fox",
        SIX_TAIL_FOX: "six-tail-fox",
        YAN_HONG: "yan-hong",
        SHANGGUAN_CE: "shangguan-ce",
        WEN_MIN: "wen-min",
        ZUO_GUI: "zuo-gui",
        QI_HAO: "qi-hao",
        FOLDING_FAN: "folding-fan",
        COOL_PEARL: "cool-pearl",
        SACRED_WOOD_DICE: "sacred-wood-dice",
        LIN_FENG: "lin-feng",
        LIU_HE_MIRROR: "liu-he-mirror",
        THUNDER_BANNER: "thunder-banner",
        ZI_XIAO_GOURD: "zi-xiao-gourd",
        THUNDER_CRYSTAL: "thunder-crystal",
        CHAIN_LIGHTNING_WALL: "chain-lightning-wall",
        PURPLE_DRAGON: "purple-dragon"
    };

    const FIRE_CARD_IDS = [
        CARD_IDS.SCARLET_ANT,
        CARD_IDS.FIERCE_TIGER,
        CARD_IDS.SUI_SHOU,
        CARD_IDS.TWO_TAIL_FOX,
        CARD_IDS.SIX_TAIL_FOX
    ];

    const ICE_CARD_IDS = [
        CARD_IDS.YAN_HONG,
        CARD_IDS.SHANGGUAN_CE,
        CARD_IDS.WEN_MIN,
        CARD_IDS.ZUO_GUI,
        CARD_IDS.QI_HAO
    ];

    const WOOD_CARD_IDS = [
        CARD_IDS.FOLDING_FAN,
        CARD_IDS.COOL_PEARL,
        CARD_IDS.SACRED_WOOD_DICE,
        CARD_IDS.LIN_FENG,
        CARD_IDS.LIU_HE_MIRROR
    ];

    const THUNDER_CARD_IDS = [
        CARD_IDS.THUNDER_BANNER,
        CARD_IDS.ZI_XIAO_GOURD,
        CARD_IDS.THUNDER_CRYSTAL,
        CARD_IDS.CHAIN_LIGHTNING_WALL,
        CARD_IDS.PURPLE_DRAGON
    ];

    const CARD_ORDER = [
        ...FIRE_CARD_IDS,
        ...ICE_CARD_IDS,
        ...WOOD_CARD_IDS,
        ...THUNDER_CARD_IDS
    ];

    const TICK_MS = 100;
    const TICK_SECONDS = TICK_MS / 1000;
    const EVENTS = {
        TIME: "time",
        BURN_APPLIED: "burn_applied",
        BURN_TICK: "burn_tick",
        COMBUST: "combust",
        ICE_ARROW_HIT: "ice_arrow_hit",
        SHATTER: "shatter",
        ICE_STORM_HIT: "ice_storm_hit",
        PULSE_TRIGGERED: "pulse_triggered",
        CHAIN_LIGHTNING_HIT: "chain_lightning_hit",
        THUNDER_FRENZY: "thunder_frenzy",
        ELEMENT_AMPLIFY: "element_amplify"
    };
    const FIRE_AMPLIFY_DELAYS = [2, 4, 6, 8, 10];
    const ICE_AMPLIFY_FINAL_DELAY = 2;
    const WOOD_AMPLIFY_DELAYS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const WOOD_ECHO_DELAYS = [2, 4, 6, 8, 10];
    const OPENING_PULSE_SCHEDULE = [0, 2, 4];
    const STATIC_OVERLOAD_TICKS = 4;

    // Shared helpers
    function clampLevel(level) {
        return Math.max(0, Math.min(6, parseInt(level, 10) || 0));
    }

    function createRng(seed) {
        let value = seed % 2147483647;
        if (value <= 0) value += 2147483646;
        return function next() {
            value = value * 16807 % 2147483647;
            return (value - 1) / 2147483646;
        };
    }

    function createBreakdown() {
        return {
            byCard: {},
            byMechanic: {},
            byMechanicCount: {}
        };
    }

    function createEffects() {
        return {
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
    }

    // Target state
    class Target {
        constructor() {
            // 天火状态
            this.burnStacks = 0;
            this.burnExpireAt = 0;
            this.burnTickAt = 0;
            this.combustAt = null;

            // 神雷持续伤害队列
            this.staticOverloadEvents = [];
        }

        clearBurn() {
            this.burnStacks = 0;
            this.burnExpireAt = 0;
            this.burnTickAt = 0;
            this.combustAt = null;
        }
    }

    // Base card
    class Card {
        static handlers = {};

        constructor(level) {
            const def = Data.getCardDefById(this.constructor.cardId);
            if (!def) {
                throw new Error(`Unknown season2 card id: ${this.constructor.cardId}`);
            }
            this.id = def.id;
            this.name = def.name;
            this.element = def.element;
            this.fee = def.fee;
            this.level = clampLevel(level);
            this.mechanics = def.mechanics.slice();
            this.params = Data.resolveCardParams(def, this.level);
            this.notes = def.notes || [];
        }

        // 判断当前卡是否响应该类型事件。
        check(eventType, event) {
            if (eventType === EVENTS.ELEMENT_AMPLIFY && event && this.element !== event.element) {
                return false;
            }
            return Boolean(this.constructor.handlers[eventType]);
        }

        // 统一事件入口：把事件路由到 handlers 声明的方法上。
        trigger(engine, eventType, event) {
            const methodName = this.constructor.handlers[eventType];
            if (!methodName || typeof this[methodName] !== "function") return;
            this[methodName](engine, event);
        }

        // 战斗开始前挂全局被动。
        applyPassive() {}
        // 战斗开始时初始化本卡内部状态。
        init() {}
        // 时间驱动型丹青在每一拍进入这里。
        onTick() {}
    }

    // Fire
    class ScarletAnt extends Card {
        static handlers = {
            [EVENTS.TIME]: "onTick"
        };

        static cardId = CARD_IDS.SCARLET_ANT;

        init() {
            this.nextApplyAt = 0;
        }

        onTick(engine) {
            if (engine.time < this.nextApplyAt) return;
            const hits = Math.min(this.params.maxTargets, engine.targetCount);
            for (let i = 0; i < hits; i++) {
                engine.applyBurn(i, this, 1, true, true);
            }
            this.nextApplyAt += this.params.assumedApplyInterval;
        }
    }

    class FierceTiger extends Card {
        static handlers = {
            [EVENTS.BURN_TICK]: "onBurnTick",
            [EVENTS.COMBUST]: "onCombust",
            [EVENTS.ELEMENT_AMPLIFY]: "onElementAmplify"
        };

        static cardId = CARD_IDS.FIERCE_TIGER;

        applyPassive(engine) {
            engine.effects.fire.blazeOnBurn += this.params.burnMeterGain;
            engine.effects.fire.blazeOnCombust += this.params.combustMeterGain;
            engine.effects.fire.triggerThreshold = this.params.triggerThreshold;
        }

        onBurnTick(engine) {
            engine.addMeter("fire", this.params.burnMeterGain);
        }

        onCombust(engine) {
            engine.addMeter("fire", this.params.combustMeterGain);
        }

        onElementAmplify(engine) {
            FIRE_AMPLIFY_DELAYS.forEach(delay => {
                engine.scheduleEvent(engine.time + delay, () => {
                    engine.addDamage(39181, this.id, "fire_amplify");
                });
            });
        }
    }

    class SuiShou extends Card {
        static handlers = {
            [EVENTS.BURN_TICK]: "onBurnTick"
        };

        static cardId = CARD_IDS.SUI_SHOU;

        applyPassive(engine) {
            engine.effects.fire.burnTickRateBonus += this.params.tickRateBonus;
            engine.effects.fire.extraStackChance += this.params.extraStackChance;
        }

        onBurnTick(engine, event) {
            const scarletAnt = engine.getCard(CARD_IDS.SCARLET_ANT);
            const target = engine.targets[event.targetIndex];
            if (!scarletAnt || !target) return;
            if (target.burnStacks >= scarletAnt.params.burnMaxStacks) return;
            // 岁兽的补层不刷新持续时间，只额外补 1 层。
            if (engine.random() < this.params.extraStackChance) {
                engine.applyBurn(event.targetIndex, scarletAnt, 1, false, true);
            }
        }
    }

    class TwoTailFox extends Card {
        static handlers = {
            [EVENTS.BURN_APPLIED]: "onBurnApplied"
        };

        static cardId = CARD_IDS.TWO_TAIL_FOX;

        applyPassive(engine) {
            engine.effects.fire.burnApplyProcDamage += this.params.procDamage;
        }

        onBurnApplied(engine) {
            engine.addDamage(this.params.procDamage, this.id, "ignite");
        }
    }

    class SixTailFox extends Card {
        static handlers = {
            [EVENTS.BURN_APPLIED]: "onBurnApplied",
            [EVENTS.COMBUST]: "onCombust"
        };

        static cardId = CARD_IDS.SIX_TAIL_FOX;

        applyPassive(engine) {
            engine.effects.fire.combustThreshold = this.params.threshold;
            engine.effects.fire.combustDelay = this.params.delay;
            engine.effects.fire.combustDamagePerExtraLayer += this.params.damagePerExtraLayer;
        }

        onBurnApplied(engine, event) {
            const target = engine.targets[event.targetIndex];
            if (!target) return;
            if (target.burnStacks >= this.params.threshold && event.beforeStacks < this.params.threshold) {
                target.combustAt = engine.time + this.params.delay;
            }
        }

        onCombust(engine, event) {
            const target = engine.targets[event.targetIndex];
            if (!target || target.burnStacks < this.params.threshold) return;
            engine.addDamage(target.burnStacks * this.params.damagePerExtraLayer, this.id, "combust");
            const preservedTickAt = target.burnTickAt;
            target.burnStacks = 0;
            target.burnExpireAt = 0;
            target.burnTickAt = preservedTickAt;
            const scarletAnt = engine.getCard(CARD_IDS.SCARLET_ANT);
            if (scarletAnt) {
                // 爆燃后立即回到 1 层燃烧，并保留原先的 tick 节奏。
                engine.applyBurn(event.targetIndex, scarletAnt, 1, true, true, true);
            }
        }
    }

    // Ice
    class YanHong extends Card {
        static handlers = {
            [EVENTS.TIME]: "onTick"
        };

        static cardId = CARD_IDS.YAN_HONG;

        init() {
            this.nextShotAt = 0;
        }

        onTick(engine) {
            if (engine.time < this.nextShotAt) return;
            engine.fireIceArrow(this, 1, engine.getIceArrowDamage(this.params.arrowDamage), "ice_arrow", this.params.arrowTargets);
            this.nextShotAt += this.params.cooldown;
        }
    }

    class ShangguanCe extends Card {
        static handlers = {
            [EVENTS.ICE_ARROW_HIT]: "onIceArrowHit",
            [EVENTS.SHATTER]: "onShatter",
            [EVENTS.ICE_STORM_HIT]: "onIceStormHit",
            [EVENTS.ELEMENT_AMPLIFY]: "onElementAmplify"
        };

        static cardId = CARD_IDS.SHANGGUAN_CE;

        applyPassive(engine) {
            engine.effects.ice.triggerThreshold = this.params.triggerThreshold;
        }

        onIceArrowHit(engine, event) {
            engine.addMeter("ice", this.params.arrowMeterGain * event.targetsHit);
        }

        onShatter(engine) {
            engine.addMeter("ice", this.params.shatterMeterGain * engine.targetCount);
        }

        onIceStormHit(engine, event) {
            if (event.shouldAddStormMeter) {
                engine.addMeter("ice", this.params.stormMeterGain);
            }
        }

        onElementAmplify(engine) {
            engine.addDamage(43534, this.id, "ice_amplify");
            engine.scheduleEvent(engine.time + ICE_AMPLIFY_FINAL_DELAY, () => {
                engine.addDamage(85327, this.id, "ice_amplify");
            });
        }
    }

    class WenMin extends Card {
        static handlers = {
            [EVENTS.TIME]: "onTick"
        };

        static cardId = CARD_IDS.WEN_MIN;

        applyPassive(engine) {
            engine.effects.ice.arrowDamageBonus += this.params.arrowDamageBonus;
        }

        init() {
            this.nextVolleyAt = Math.max(1, this.params.volleyCooldown);
        }

        onTick(engine) {
            if (engine.time < this.nextVolleyAt) return;
            const yanHong = engine.getCard(CARD_IDS.YAN_HONG);
            const baseDamage = engine.getIceArrowDamage(yanHong ? yanHong.params.arrowDamage : 4830);
            engine.fireIceArrow(this, this.params.volleyArrows, baseDamage, "ice_arrow_volley", this.params.arrowTargets);
            this.nextVolleyAt += Math.max(1, this.params.volleyCooldown);
        }
    }

    class ZuoGui extends Card {
        static handlers = {
            [EVENTS.ICE_ARROW_HIT]: "onIceArrowHit",
            [EVENTS.ICE_STORM_HIT]: "onIceStormHit"
        };

        static cardId = CARD_IDS.ZUO_GUI;

        applyPassive(engine) {
            engine.effects.ice.arrowDamageBonus += this.params.damageBonus;
            engine.effects.ice.shatterChance += this.params.shatterChance;
            engine.effects.ice.shatterDamage += this.params.shatterDamage;
        }

        onIceArrowHit(engine) {
            this.tryShatter(engine);
        }

        onIceStormHit(engine) {
            this.tryShatter(engine);
        }

        // 左归的碎裂逻辑同时复用于冰箭和风暴命中。
        tryShatter(engine) {
            if (engine.effects.ice.shatterChance <= 0) return;
            if (engine.random() < engine.effects.ice.shatterChance) {
                // 碎裂始终按全目标结算，再回推给上官策积累玄冰值。
                engine.addDamage(engine.effects.ice.shatterDamage * engine.targetCount, this.id, "shatter");
                engine.notifyShatter();
            }
        }
    }

    class QiHao extends Card {
        static handlers = {
            [EVENTS.TIME]: "onTick",
            [EVENTS.ICE_ARROW_HIT]: "onIceArrowHit"
        };

        static cardId = CARD_IDS.QI_HAO;

        init() {
            this.cooldownRemaining = 0;
            this.isBursting = false;
            this.burstHitsDone = 0;
            this.nextBurstHitAt = 0;
            this.burstTickInterval = this.params.burstDuration / this.params.burstHits;
        }

        onTick(engine) {
            this.cooldownRemaining -= TICK_SECONDS;
            if (!this.isBursting && this.cooldownRemaining <= 0) {
                this.isBursting = true;
                this.burstHitsDone = 0;
                this.burstTickInterval = this.params.burstDuration / this.params.burstHits;
                this.nextBurstHitAt = engine.time;
                this.cooldownRemaining += this.params.cooldown;
            }
            if (!this.isBursting) return;
            if (engine.time < this.nextBurstHitAt || this.burstHitsDone >= this.params.burstHits) return;
            // 齐昊把一次风暴拆成多段 tick，保持与旧版完全一致的节奏。
            engine.castIceStorm(this, 1 / this.params.burstHits, this.burstHitsDone === 0);
            this.burstHitsDone += 1;
            this.nextBurstHitAt += this.burstTickInterval;
            if (this.burstHitsDone >= this.params.burstHits) {
                this.isBursting = false;
            }
        }

        onIceArrowHit(engine, event) {
            this.cooldownRemaining = Math.max(0, this.cooldownRemaining - (this.params.cooldownReductionPerArrowHit * event.targetsHit));
        }
    }

    // Wood
    class FoldingFan extends Card {
        static handlers = {
            [EVENTS.TIME]: "onTick"
        };

        static cardId = CARD_IDS.FOLDING_FAN;

        init(engine) {
            this.nextPulseAt = Math.max(1, this.params.interval - engine.effects.wood.pulseIntervalReduction);
        }

        onTick(engine) {
            if (engine.time < this.nextPulseAt) return;
            engine.triggerPulse(this, 1, "pulse");
            this.nextPulseAt += Math.max(1, this.params.interval - engine.effects.wood.pulseIntervalReduction);
        }
    }

    class CoolPearl extends Card {
        static handlers = {
            [EVENTS.PULSE_TRIGGERED]: "onPulseTriggered",
            [EVENTS.ELEMENT_AMPLIFY]: "onElementAmplify"
        };

        static cardId = CARD_IDS.COOL_PEARL;

        applyPassive(engine) {
            engine.effects.wood.triggerThreshold = this.params.triggerThreshold;
        }

        onPulseTriggered(engine) {
            engine.addMeter("wood", this.params.meterGain * engine.targetCount);
        }

        onElementAmplify(engine) {
            let tickCount = 0;
            WOOD_AMPLIFY_DELAYS.forEach(delay => {
                engine.scheduleEvent(engine.time + delay, () => {
                    engine.addDamage(24916, this.id, "wood_amplify");
                    tickCount += 1;
                    if (tickCount % 3 === 0) {
                        engine.addDamage(72108, this.id, "wood_bloom");
                    }
                });
            });
        }
    }

    class SacredWoodDice extends Card {
        static handlers = {
            [EVENTS.TIME]: "onTick",
            [EVENTS.PULSE_TRIGGERED]: "onPulseTriggered"
        };

        static cardId = CARD_IDS.SACRED_WOOD_DICE;

        init() {
            this.openingSchedule = OPENING_PULSE_SCHEDULE.slice(0, this.params.openingPulseTimes);
        }

        onTick(engine) {
            if (!this.openingSchedule || this.openingSchedule.length === 0) return;
            if (engine.time < this.openingSchedule[0]) return;
            engine.triggerPulse(this, 1, "opening_pulse");
            this.openingSchedule.shift();
        }

        onPulseTriggered(engine, event) {
            const echoTickDamage = (this.params.echoDamage * engine.targetCount * event.efficiency) / 5;
            WOOD_ECHO_DELAYS.forEach(delay => {
                engine.scheduleEvent(engine.time + delay, () => {
                    engine.addDamage(echoTickDamage, this.id, "pulse_echo");
                });
            });
        }
    }

    class LinFeng extends Card {
        static cardId = CARD_IDS.LIN_FENG;

        applyPassive(engine) {
            engine.effects.wood.pulseDamageBonus += this.params.damageBonus;
            engine.effects.wood.pulseDamageReductionPerExtraEnemy += this.params.reductionPerExtraEnemy;
        }
    }

    class LiuHeMirror extends Card {
        static handlers = {
            [EVENTS.PULSE_TRIGGERED]: "onPulseTriggered"
        };

        static cardId = CARD_IDS.LIU_HE_MIRROR;

        applyPassive(engine) {
            engine.effects.wood.pulseIntervalReduction += this.params.intervalReduction;
            engine.effects.wood.extraPulseCount += this.params.extraPulseCount;
            engine.effects.wood.extraPulseEfficiency = Math.max(engine.effects.wood.extraPulseEfficiency, this.params.extraPulseEfficiency);
            engine.effects.wood.extraPulseSpacing = this.params.extraPulseSpacing;
        }

        onPulseTriggered(engine, event) {
            if (event.mechanic === "pulse_followup") return;
            for (let i = 0; i < this.params.extraPulseCount; i++) {
                const delay = i === 0 ? 0 : this.params.extraPulseSpacing * i;
                const rawTriggerAt = engine.time + delay;
                // 末尾 1 秒内的补脉冲允许钳到 duration，避免因为浮点时间错过结算。
                const triggerAt = rawTriggerAt > engine.duration && rawTriggerAt <= engine.duration + 1
                    ? engine.duration
                    : rawTriggerAt;
                engine.scheduleEvent(triggerAt, () => {
                    engine.triggerPulse(event.card, this.params.extraPulseEfficiency, "pulse_followup");
                });
            }
        }
    }

    // Thunder
    class ThunderBanner extends Card {
        static handlers = {
            [EVENTS.TIME]: "onTick"
        };

        static cardId = CARD_IDS.THUNDER_BANNER;

        init() {
            this.nextChainAt = 0;
        }

        onTick(engine) {
            if (engine.time >= engine.duration || engine.time < this.nextChainAt) return;
            if (engine.shouldTriggerThunderFrenzy()) {
                engine.notifyThunderFrenzy();
                engine.nextThunderFrenzyAt += engine.effects.thunder.frenzyInterval;
            } else {
                engine.triggerChainLightning(this, 1, false);
            }
            this.nextChainAt += this.params.cooldown;
        }
    }

    class ZiXiaoGourd extends Card {
        static handlers = {
            [EVENTS.CHAIN_LIGHTNING_HIT]: "onChainLightningHit",
            [EVENTS.ELEMENT_AMPLIFY]: "onElementAmplify"
        };

        static cardId = CARD_IDS.ZI_XIAO_GOURD;

        applyPassive(engine) {
            engine.effects.thunder.triggerThreshold = this.params.triggerThreshold;
        }

        onChainLightningHit(engine, event) {
            engine.addMeter("thunder", this.params.meterGain * event.targetsHit);
        }

        onElementAmplify(engine) {
            engine.addDamage(93805 * engine.targetCount, this.id, "thunder_amplify");
        }
    }

    class ThunderCrystal extends Card {
        static handlers = {
            [EVENTS.CHAIN_LIGHTNING_HIT]: "onChainLightningHit"
        };

        static cardId = CARD_IDS.THUNDER_CRYSTAL;

        applyPassive(engine) {
            engine.effects.thunder.staticOverloadDamage += this.params.totalDamage;
            engine.effects.thunder.staticOverloadDuration = this.params.duration;
        }

        onChainLightningHit(engine, event) {
            engine.applyStaticOverload(event.sourceCardId, event.targetsHit, 1);
        }
    }

    class ChainLightningWall extends Card {
        static cardId = CARD_IDS.CHAIN_LIGHTNING_WALL;

        applyPassive(engine) {
            engine.effects.thunder.chainDamageBonus += this.params.damageBonus;
            engine.effects.thunder.chainExtraEnemyBonus += this.params.extraEnemyBonus;
        }
    }

    class PurpleDragon extends Card {
        static handlers = {
            [EVENTS.CHAIN_LIGHTNING_HIT]: "onChainLightningHit",
            [EVENTS.THUNDER_FRENZY]: "onThunderFrenzy"
        };

        static cardId = CARD_IDS.PURPLE_DRAGON;

        applyPassive(engine) {
            engine.effects.thunder.extraTriggerChance = Math.max(engine.effects.thunder.extraTriggerChance, this.params.extraTriggerChance);
            engine.effects.thunder.frenzyEfficiency = Math.max(engine.effects.thunder.frenzyEfficiency, this.params.frenzyEfficiency);
            engine.effects.thunder.frenzyCount = Math.max(engine.effects.thunder.frenzyCount, this.params.frenzyCount);
            engine.effects.thunder.frenzyInterval = this.params.frenzyInterval;
        }

        init(engine) {
            engine.nextThunderFrenzyAt = 0;
        }

        onChainLightningHit(engine, event) {
            if (engine.effects.thunder.extraTriggerChance <= 0) return;
            if (engine.random() >= engine.effects.thunder.extraTriggerChance) return;
            engine.addDamage(event.damagePerTarget * event.targetsHit, this.id, "chain_lightning_extra");
            const gourd = engine.getCard(CARD_IDS.ZI_XIAO_GOURD);
            if (gourd) {
                // 额外雷链需要继续喂给计量和静电过载，行为对齐旧引擎。
                gourd.onChainLightningHit(engine, { targetsHit: event.targetsHit, sourceCardId: this.id });
            }
            const crystal = engine.getCard(CARD_IDS.THUNDER_CRYSTAL);
            if (crystal) {
                crystal.onChainLightningHit(engine, { targetsHit: event.targetsHit, sourceCardId: this.id });
            }
        }

        onThunderFrenzy(engine) {
            if (engine.effects.thunder.frenzyCount <= 0) return;
            const thunderBanner = engine.getCard(CARD_IDS.THUNDER_BANNER);
            if (!thunderBanner) return;
            for (let i = 0; i < engine.effects.thunder.frenzyCount; i++) {
                engine.triggerChainLightning(thunderBanner, engine.effects.thunder.frenzyEfficiency, false);
            }
        }
    }

    const EVENT_CARD_ORDER = {
        [EVENTS.BURN_APPLIED]: [CARD_IDS.TWO_TAIL_FOX, CARD_IDS.SIX_TAIL_FOX],
        [EVENTS.BURN_TICK]: [CARD_IDS.FIERCE_TIGER, CARD_IDS.SUI_SHOU],
        [EVENTS.COMBUST]: [CARD_IDS.SIX_TAIL_FOX, CARD_IDS.FIERCE_TIGER],
        [EVENTS.ICE_ARROW_HIT]: [CARD_IDS.SHANGGUAN_CE, CARD_IDS.ZUO_GUI, CARD_IDS.QI_HAO],
        [EVENTS.SHATTER]: [CARD_IDS.SHANGGUAN_CE],
        [EVENTS.ICE_STORM_HIT]: [CARD_IDS.SHANGGUAN_CE, CARD_IDS.ZUO_GUI],
        [EVENTS.PULSE_TRIGGERED]: [CARD_IDS.COOL_PEARL, CARD_IDS.SACRED_WOOD_DICE, CARD_IDS.LIU_HE_MIRROR],
        [EVENTS.CHAIN_LIGHTNING_HIT]: [CARD_IDS.ZI_XIAO_GOURD, CARD_IDS.THUNDER_CRYSTAL, CARD_IDS.PURPLE_DRAGON],
        [EVENTS.THUNDER_FRENZY]: [CARD_IDS.PURPLE_DRAGON],
        [EVENTS.ELEMENT_AMPLIFY]: [
            CARD_IDS.FIERCE_TIGER,
            CARD_IDS.SHANGGUAN_CE,
            CARD_IDS.COOL_PEARL,
            CARD_IDS.ZI_XIAO_GOURD
        ]
    };

    const CARD_REGISTRY = {
        [CARD_IDS.SCARLET_ANT]: ScarletAnt,
        [CARD_IDS.FIERCE_TIGER]: FierceTiger,
        [CARD_IDS.SUI_SHOU]: SuiShou,
        [CARD_IDS.TWO_TAIL_FOX]: TwoTailFox,
        [CARD_IDS.SIX_TAIL_FOX]: SixTailFox,
        [CARD_IDS.YAN_HONG]: YanHong,
        [CARD_IDS.SHANGGUAN_CE]: ShangguanCe,
        [CARD_IDS.WEN_MIN]: WenMin,
        [CARD_IDS.ZUO_GUI]: ZuoGui,
        [CARD_IDS.QI_HAO]: QiHao,
        [CARD_IDS.FOLDING_FAN]: FoldingFan,
        [CARD_IDS.COOL_PEARL]: CoolPearl,
        [CARD_IDS.SACRED_WOOD_DICE]: SacredWoodDice,
        [CARD_IDS.LIN_FENG]: LinFeng,
        [CARD_IDS.LIU_HE_MIRROR]: LiuHeMirror,
        [CARD_IDS.THUNDER_BANNER]: ThunderBanner,
        [CARD_IDS.ZI_XIAO_GOURD]: ZiXiaoGourd,
        [CARD_IDS.THUNDER_CRYSTAL]: ThunderCrystal,
        [CARD_IDS.CHAIN_LIGHTNING_WALL]: ChainLightningWall,
        [CARD_IDS.PURPLE_DRAGON]: PurpleDragon
    };

    // Combat engine
    class CombatEngine {
        constructor(deckConfig, options = {}) {
            this.duration = Math.max(1, Number(options.duration) || 60);
            this.targetCount = Math.max(1, Number(options.targetCount) || 1);
            this.seed = Number(options.seed) || Math.floor(Math.random() * 2147483647);
            this.rng = createRng(this.seed);
            this.time = 0;
            this.targets = Array.from({ length: this.targetCount }, () => new Target());
            this.queue = [];
            this.delayedEvents = [];
            this.warnings = [];
            this.breakdown = createBreakdown();
            this.meters = { fire: 0, ice: 0, wood: 0, thunder: 0 };
            this.amplifyTriggers = { fire: 0, ice: 0, wood: 0, thunder: 0 };
            this.timeline = [];
            this.totalDamage = 0;
            this.lastSecondSample = 0;
            this.nextThunderFrenzyAt = Infinity;
            this.effects = createEffects();
            this.deck = this.buildDeck(deckConfig);
            this.cardMap = new Map(this.deck.map(card => [card.id, card]));
            this.tickCards = CARD_ORDER.map(id => this.cardMap.get(id)).filter(card => card && typeof card.onTick === "function");
            this.eventCards = Object.fromEntries(
                Object.entries(EVENT_CARD_ORDER).map(([eventType, cardIds]) => [
                    eventType,
                    cardIds.map(id => this.cardMap.get(id)).filter(Boolean)
                ])
            );
            this.initializeDeckState();
        }

        // 按配置把牌组实例化成具体卡类。
        buildDeck(deckConfig) {
            return (deckConfig || []).map(item => {
                const CardClass = CARD_REGISTRY[item.id];
                if (!CardClass) {
                    throw new Error(`Unknown season2 card id: ${item.id}`);
                }
                return new CardClass(item.level);
            });
        }

        // 对整套牌执行同名生命周期钩子。
        runDeckHook(methodName) {
            this.deck.forEach(card => {
                if (typeof card[methodName] === "function") {
                    card[methodName](this);
                }
            });
        }

        // 先挂被动，再初始化各卡内部状态。
        initializeDeckState() {
            this.runDeckHook("applyPassive");
            this.runDeckHook("init");
        }

        // 战斗内统一随机源，确保同 seed 下结果可复现。
        random() {
            return this.rng();
        }

        // 按 id 取当前牌组中的卡实例。
        getCard(id) {
            return this.cardMap.get(id) || null;
        }

        // 按固定顺序向注册过该事件的卡分发事件。
        dispatch(eventType, event) {
            const cards = this.eventCards[eventType] || [];
            cards.forEach(card => {
                if (card.check(eventType, event)) {
                    // 事件顺序由 EVENT_CARD_ORDER 显式控制，避免触发先后被重构打乱。
                    card.trigger(this, eventType, event);
                }
            });
        }

        // 对外统一事件派发入口。
        emit(eventType, event) {
            this.dispatch(eventType, event);
        }

        // 把即时事件压入主队列，等待本拍统一处理。
        queueEvent(event) {
            this.queue.push(event);
        }

        // 注册未来时刻触发的延迟事件。
        scheduleEvent(triggerAt, handler) {
            this.delayedEvents.push({ triggerAt, handler });
        }

        // 取出当前拍已经到时的延迟事件。
        getReadyDelayedEvents() {
            if (this.delayedEvents.length === 0) return [];
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
            return readyEvents;
        }

        // 统一累计总伤、分卡伤害和机制伤害。
        addDamage(amount, cardId, mechanic) {
            const dmg = Math.max(0, amount || 0);
            if (dmg <= 0) return;
            this.totalDamage += dmg;
            this.breakdown.byCard[cardId] = (this.breakdown.byCard[cardId] || 0) + dmg;
            this.breakdown.byMechanic[mechanic] = (this.breakdown.byMechanic[mechanic] || 0) + dmg;
            this.breakdown.byMechanicCount[mechanic] = (this.breakdown.byMechanicCount[mechanic] || 0) + 1;
        }

        // 累加元素计量；达到阈值时把激化效果排到下一拍执行。
        addMeter(element, amount) {
            if (!amount) return;
            this.meters[element] += amount;
            const threshold = this.getElementThreshold(element);
            if (!threshold) return;
            while (this.meters[element] >= threshold) {
                this.meters[element] -= threshold;
                // 激化效果在下一拍入队，保持与旧实现相同的触发时机。
                this.scheduleEvent(this.time + TICK_SECONDS, () => {
                    this.amplifyTriggers[element] += 1;
                    this.triggerAmplify(element);
                });
            }
        }

        // 读取当前元素对应的激化阈值。
        getElementThreshold(element) {
            switch (element) {
                case "fire":
                    return this.effects.fire.triggerThreshold;
                case "ice":
                    return this.effects.ice.triggerThreshold;
                case "wood":
                    return this.effects.wood.triggerThreshold;
                case "thunder":
                    return this.effects.thunder.triggerThreshold;
                default:
                    return null;
            }
        }

        // 主模拟循环：推进时间、执行时间事件、更新目标状态并结算队列。
        simulate() {
            while (this.time < this.duration) {
                this.time = Number((this.time + TICK_SECONDS).toFixed(4));
                this.tickCards.forEach(card => {
                    if (card.check(EVENTS.TIME)) {
                        card.trigger(this, EVENTS.TIME);
                    }
                });
                this.updateTargets();
                this.flushQueue();
                this.sampleTimeline();
            }
            return this.finalize();
        }

        // 处理目标身上的持续状态，如燃烧、爆燃和静电过载。
        updateTargets() {
            this.targets.forEach((target, index) => {
                if (target.burnStacks > 0 && this.time >= target.burnExpireAt) {
                    target.clearBurn();
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
                    // 这里直接按时间消费静电过载，不再额外入主队列。
                    target.staticOverloadEvents = target.staticOverloadEvents.filter(event => {
                        if (this.time >= event.triggerAt) {
                            this.addDamage(event.damagePerTick, event.cardId, "static_overload");
                            return false;
                        }
                        return true;
                    });
                }
            });
            this.flushDelayedEvents();
        }

        // 执行当前拍到时的所有延迟事件。
        flushDelayedEvents() {
            this.getReadyDelayedEvents().forEach(event => event.handler());
        }

        // 处理主事件队列里的单个事件。
        processQueueEvent(event) {
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

        // 清空当前拍的主事件队列。
        flushQueue() {
            while (this.queue.length > 0) {
                this.processQueueEvent(this.queue.shift());
            }
        }

        // 每秒记录一次平均 DPS 轨迹，供 UI 展示。
        sampleTimeline() {
            const currentSecond = Math.floor(this.time + 1e-9);
            if (currentSecond > this.lastSecondSample && currentSecond <= this.duration) {
                this.timeline.push(Math.round(this.totalDamage / currentSecond));
                this.lastSecondSample = currentSecond;
            }
        }

        // 计算当前燃烧 tick 间隔，受岁兽加速影响。
        getBurnTickInterval() {
            return Math.max(0.3, 3 / (1 + this.effects.fire.burnTickRateBonus));
        }

        // 计算冰箭单段伤害，统一吃冰系增伤。
        getIceArrowDamage(baseDamage) {
            return baseDamage * (1 + this.effects.ice.arrowDamageBonus);
        }

        // 计算脉冲基础伤害，统一处理多目标衰减。
        getPulseDamage(baseDamage) {
            const extraEnemies = Math.max(0, this.targetCount - 1);
            const bonus = this.effects.wood.pulseDamageBonus - (this.effects.wood.pulseDamageReductionPerExtraEnemy * extraEnemies);
            return baseDamage * (1 + Math.max(-0.95, bonus));
        }

        // 计算雷链单目标伤害，统一处理额外目标加成。
        getChainDamage(baseDamage, targetsHit) {
            const extraEnemies = Math.max(0, targetsHit - 1);
            const bonus = this.effects.thunder.chainDamageBonus + this.effects.thunder.chainExtraEnemyBonus * extraEnemies;
            return baseDamage * (1 + bonus);
        }

        // 给指定目标叠加燃烧，并按规则决定是否触发“上火”事件。
        applyBurn(targetIndex, sourceCard, stacks, refreshDuration, shouldIgnite = true, preserveTick = false) {
            const target = this.targets[targetIndex];
            if (!target) return;
            const beforeStacks = target.burnStacks;
            const maxStacks = sourceCard.params.burnMaxStacks;
            const existingTickAt = target.burnTickAt;
            target.burnStacks = Math.min(maxStacks, target.burnStacks + stacks);
            if (refreshDuration) {
                target.burnExpireAt = this.time + sourceCard.params.burnDuration;
            }
            if (preserveTick && existingTickAt > this.time) {
                target.burnTickAt = existingTickAt;
            } else if (!target.burnTickAt || target.burnTickAt <= this.time) {
                target.burnTickAt = this.time + this.getBurnTickInterval();
            }
            if (shouldIgnite) {
                // 标准上火路径：触发二尾、六尾等“燃烧被施加”事件。
                this.notifyBurnApplied({
                    targetIndex,
                    sourceCard,
                    beforeStacks,
                    afterStacks: target.burnStacks
                });
            } else {
                const sixTailFox = this.getCard(CARD_IDS.SIX_TAIL_FOX);
                if (sixTailFox) {
                    // 岁兽补层只需要让六尾检查是否跨过爆燃阈值，不重复点燃二尾。
                    sixTailFox.onBurnApplied(this, {
                        targetIndex,
                        sourceCard,
                        beforeStacks,
                        afterStacks: target.burnStacks
                    });
                }
            }
        }

        // 结算一次燃烧 tick 伤害，并通知相关火系联动。
        handleBurnTick(targetIndex) {
            const target = this.targets[targetIndex];
            const scarletAnt = this.getCard(CARD_IDS.SCARLET_ANT);
            if (!target || target.burnStacks <= 0 || !scarletAnt) return;
            const damage = scarletAnt.params.burnDamage * (1 + Math.max(0, target.burnStacks - 1) * scarletAnt.params.extraLayerBonus);
            this.addDamage(damage, scarletAnt.id, "burn_tick");
            this.notifyBurnTick({ targetIndex, damage });
        }

        // 结算一次爆燃事件。
        handleCombust(targetIndex) {
            this.notifyCombust({ targetIndex });
        }

        // 发射冰箭；每一段命中后都向冰系联动广播事件。
        fireIceArrow(card, arrowCount, damagePerArrow, mechanic, maxTargets) {
            const targetsHit = Math.min(this.targetCount, maxTargets || this.targetCount);
            for (let i = 0; i < arrowCount; i++) {
                const totalDamage = damagePerArrow * targetsHit;
                this.addDamage(totalDamage, card.id, mechanic);
                this.notifyIceArrowHit({
                    card,
                    targetsHit,
                    damagePerArrow,
                    totalDamage
                });
            }
        }

        // 结算一次玄冰风暴命中。
        castIceStorm(card, efficiency, shouldAddStormMeter) {
            const zuoGui = this.getCard(CARD_IDS.ZUO_GUI);
            // 左归对风暴只提供自身那部分伤害加成，避免重复叠加冰箭增伤。
            const stormOnlyBonus = zuoGui ? zuoGui.params.damageBonus : 0;
            const damage = card.params.stormDamage * (1 + stormOnlyBonus) * efficiency;
            this.addDamage(damage, card.id, efficiency < 1 ? "ice_storm_frenzy" : "ice_storm");
            this.notifyIceStormHit({
                card,
                efficiency,
                damage,
                shouldAddStormMeter
            });
        }

        // 触发一次木系脉冲，并广播给木系联动丹青。
        triggerPulse(card, efficiency, mechanic) {
            const base = this.getPulseDamage(card.params.pulseDamage || 9792);
            const damage = base * this.targetCount * efficiency;
            this.addDamage(damage, card.id, mechanic);
            this.notifyPulseTriggered({
                card,
                efficiency,
                mechanic,
                damage
            });
        }

        // 触发一次雷链，并广播给神雷联动丹青。
        triggerChainLightning(card, efficiency) {
            const targetsHit = Math.min(this.targetCount, card.params.maxEnemyTargets || 3);
            const damagePerTarget = this.getChainDamage(card.params.chainDamage, targetsHit) * efficiency;
            this.addDamage(damagePerTarget * targetsHit, card.id, efficiency < 1 ? "chain_lightning_frenzy" : "chain_lightning");
            this.notifyChainLightningHit({
                sourceCardId: card.id,
                targetsHit,
                damagePerTarget,
                efficiency
            });
        }

        // 给目标挂上静电过载的未来伤害 tick。
        applyStaticOverload(cardId, targetsHit, efficiency) {
            const totalDamage = this.effects.thunder.staticOverloadDamage * efficiency;
            const perTick = totalDamage / STATIC_OVERLOAD_TICKS;
            for (let targetIndex = 0; targetIndex < targetsHit; targetIndex++) {
                for (let i = 1; i <= STATIC_OVERLOAD_TICKS; i++) {
                    // 引雷幡触发的静电过载归因到雷魄晶，其余额外雷链则保留来源卡。
                    this.targets[targetIndex].staticOverloadEvents.push({
                        triggerAt: this.time + (this.effects.thunder.staticOverloadDuration / STATIC_OVERLOAD_TICKS) * i,
                        damagePerTick: perTick,
                        cardId: cardId === CARD_IDS.THUNDER_BANNER ? CARD_IDS.THUNDER_CRYSTAL : cardId
                    });
                }
            }
        }

        // 判断当前拍是否轮到紫电螭吻的雷暴阶段。
        shouldTriggerThunderFrenzy() {
            return this.time >= this.nextThunderFrenzyAt;
        }

        // 触发对应元素的激化效果。
        triggerAmplify(element) {
            this.emit(EVENTS.ELEMENT_AMPLIFY, { element });
        }

        // 以下 notifyXxx 方法都是语义化事件入口，便于阅读调用链。
        notifyBurnApplied(event) {
            this.emit(EVENTS.BURN_APPLIED, event);
        }

        notifyBurnTick(event) {
            this.emit(EVENTS.BURN_TICK, event);
        }

        notifyCombust(event) {
            this.emit(EVENTS.COMBUST, event);
        }

        notifyIceArrowHit(event) {
            this.emit(EVENTS.ICE_ARROW_HIT, event);
        }

        notifyShatter() {
            this.emit(EVENTS.SHATTER);
        }

        notifyIceStormHit(event) {
            this.emit(EVENTS.ICE_STORM_HIT, event);
        }

        notifyPulseTriggered(event) {
            this.emit(EVENTS.PULSE_TRIGGERED, event);
        }

        notifyChainLightningHit(event) {
            this.emit(EVENTS.CHAIN_LIGHTNING_HIT, event);
        }

        notifyThunderFrenzy() {
            this.emit(EVENTS.THUNDER_FRENZY);
        }

        // 把内部累计结果整理成最终返回结构。
        finalize() {
            const duration = Math.max(1, this.duration);
            const byCard = Object.entries(this.breakdown.byCard)
                .map(([cardId, damage]) => {
                    const card = this.getCard(cardId) || Data.getCardDefById(cardId) || { name: cardId };
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
