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
        ELEMENT_AMPLIFY: "element_amplify",
        ICE_AMPLIFY_FREEZE: "ice_amplify_freeze",
        ICE_ELEMENTAL_SUMMONED: "ice_elemental_summoned",
        FIRE_AMPLIFY_TICK: "fire_amplify_tick",
        WOOD_BLOOM: "wood_bloom",
        THUNDER_AMPLIFY_TICK: "thunder_amplify_tick",
        CRAFT_STONE_CAST_START: "craft_stone_cast_start",
        CRAFT_STONE_CAST_END: "craft_stone_cast_end"
    };
    const FIRE_AMPLIFY_DELAYS = [2, 4, 6, 8, 10];
    const ICE_AMPLIFY_FINAL_DELAY = 2;
    const WOOD_AMPLIFY_DELAYS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const WOOD_ECHO_DELAYS = [2, 4, 6, 8, 10];
    const OPENING_PULSE_SCHEDULE = [0, 2, 4];
    const STATIC_OVERLOAD_TICKS = 4;
    const ELEMENT_TRIGGER_THRESHOLD = 10000;

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
                combustDamagePerExtraLayer: 0,
                triggerThreshold: null
            },
            ice: {
                arrowDamageBonus: 0,
                shatterChance: 0,
                shatterDamage: 0,
                amplifyDamageBonus: 0,
                freezeMeterBonus: 0,
                arrowMeterGain: 0,
                shatterMeterGain: 0,
                stormMeterGain: 0,
                triggerThreshold: ELEMENT_TRIGGER_THRESHOLD
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
                luckStacks: 0,
                triggerThreshold: ELEMENT_TRIGGER_THRESHOLD
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
            engine.addDamage(43534 * (1 + engine.effects.ice.amplifyDamageBonus), this.id, "ice_amplify");
            engine.scheduleEvent(engine.time + ICE_AMPLIFY_FINAL_DELAY, () => {
                engine.addDamage(85327 * (1 + engine.effects.ice.amplifyDamageBonus), this.id, "ice_amplify");
                engine.notifyIceAmplifyFreeze({ element: "ice" });
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
                engine.notifyIceElementalSummoned({ sourceCardId: this.id });
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

        onIceArrowHit(_engine, event) {
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
                        engine.notifyWoodBloom({ element: "wood" });
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
            if (event.skipStaticOverload) return;
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
            if (event.skipPurpleDragonExtra) return;
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
            const config = Array.isArray(deckConfig) ? { deck: deckConfig } : (deckConfig || {});
            this.duration = Math.max(1, Number(options.duration) || 60);
            this.targetCount = Math.max(1, Number(options.targetCount) || 1);
            this.seed = Number(options.seed) || Math.floor(Math.random() * 2147483647);
            this.externalSkillDps = Math.max(0, Number(options.externalSkillDps) || 0);
            this.rng = createRng(this.seed);
            this.time = 0;
            this.targets = Array.from({ length: this.targetCount }, () => new Target());
            this.queue = [];
            this.delayedEvents = [];
            this.warnings = [];
            this.breakdown = createBreakdown();
            this.meters = { fire: 0, ice: 0, wood: 0, thunder: 0 };
            this.amplifyTriggers = { fire: 0, ice: 0, wood: 0, thunder: 0 };
            this.amplifyTimeline = { fire: [], ice: [], wood: [], thunder: [] };
            this.timeline = [];
            this.totalDamage = 0;
            this.lastSecondSample = 0;
            this.nextThunderFrenzyAt = Infinity;
            this.effects = createEffects();
            this.deck = this.buildDeck(config.deck);
            this.cardMap = new Map(this.deck.map(card => [card.id, card]));
            this.machineStones = this.buildMachineStones(config.machineStones);
            this.machineStoneMap = new Map(this.machineStones.map(stone => [stone.id, stone]));
            this.craftStone = this.buildCraftStone(config.craftStone);
            this.hasExtendedSystems = this.machineStones.length > 0 || Boolean(this.craftStone);
            this.tickCards = CARD_ORDER.map(id => this.cardMap.get(id)).filter(card => card && typeof card.onTick === "function");
            this.eventCards = Object.fromEntries(
                Object.entries(EVENT_CARD_ORDER).map(([eventType, cardIds]) => [
                    eventType,
                    cardIds.map(id => this.cardMap.get(id)).filter(Boolean)
                ])
            );
            this.initializeDeckState();
            this.initializeMachineStoneState();
        }

        // 按配置把丹青实例化成具体卡类。
        buildDeck(deckConfig) {
            return (deckConfig || []).map(item => {
                const CardClass = CARD_REGISTRY[item.id];
                if (!CardClass) {
                    throw new Error(`Unknown season2 card id: ${item.id}`);
                }
                return new CardClass(item.level);
            });
        }

        buildMachineStones(stoneConfig) {
            return (stoneConfig || []).map(item => {
                const def = Data.getMachineStoneDefById(item.id);
                if (!def) throw new Error(`Unknown machine stone id: ${item.id}`);
                const rank = Math.max(1, Math.min(5, parseInt(item.rank ?? item.level, 10) || 1));
                return { ...def, rank, params: Data.resolveMachineStoneParams(def, rank) };
            });
        }

        buildCraftStone(stoneConfig) {
            if (!stoneConfig) return null;
            const def = Data.getCraftStoneDefById(stoneConfig.id || stoneConfig);
            if (!def) throw new Error(`Unknown craft stone id: ${stoneConfig.id || stoneConfig}`);
            return { ...def, params: { ...def.params } };
        }

        initializeMachineStoneState() {
            this.machineStones.forEach(stone => {
                stone.nextAt = 0;
                stone.counter = 0;
                stone.pendingCharges = 0;
                stone.activated = false;
                if (stone.id === "frost-surge" && stone.rank >= 3) {
                    this.effects.ice.amplifyDamageBonus += stone.params.iceAmplifyBonusAtRank3 || 0;
                }
                if (stone.id === "frost-surge" && stone.rank >= 5) {
                    this.effects.ice.freezeMeterBonus += stone.params.freezeMeterAtRank5 || 0;
                }
            });
            if (this.craftStone) {
                this.craftStone.nextCastAt = 0;
                this.warnings.push(...(this.craftStone.notes || []));
            }
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
            const machineStone = this.machineStoneMap ? this.machineStoneMap.get(cardId) : null;
            if (machineStone) machineStone.activated = true;
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
                    this.amplifyTimeline[element].push(Number(this.time.toFixed(1)));
                    this.triggerAmplify(element);
                });
            }
        }

        // 读取当前元素对应的激化阈值。
        getElementThreshold(element) {
            switch (element) {
                case "fire":
                    return this.effects.fire.triggerThreshold || (this.hasExtendedSystems ? ELEMENT_TRIGGER_THRESHOLD : null);
                case "ice":
                    return this.effects.ice.triggerThreshold || (this.hasExtendedSystems ? ELEMENT_TRIGGER_THRESHOLD : null);
                case "wood":
                    return this.effects.wood.triggerThreshold || (this.hasExtendedSystems ? ELEMENT_TRIGGER_THRESHOLD : null);
                case "thunder":
                    return this.effects.thunder.triggerThreshold || (this.hasExtendedSystems ? ELEMENT_TRIGGER_THRESHOLD : null);
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
                this.tickMachineStones();
                this.tickCraftStone();
                this.updateTargets();
                this.flushQueue();
                this.sampleTimeline();
            }
            return this.finalize();
        }

        tickMachineStones() {
            this.machineStones.forEach(stone => {
                const params = stone.params;
                if (stone.mechanics.includes("periodic_attack") || stone.mechanics.includes("periodic_next_attack") || stone.mechanics.includes("periodic_summon")) {
                    const interval = stone.id === "cold-tide" && stone.rank >= 3 ? (params.rank3Interval || params.interval || 20) : (params.interval || 20);
                    if (this.time >= stone.nextAt) {
                        if (stone.id === "fire-meteor") {
                            this.triggerFireMeteor(stone, "machine_periodic");
                        } else if (stone.id === "flame-body") {
                            this.triggerFlameBody(stone, 3, "machine_flame_body");
                        } else if (stone.id === "paper-forest") {
                            this.triggerPaperForest(stone);
                        } else if (stone.id === "five-thunder-orb") {
                            this.triggerFiveThunderOrb(stone);
                        } else if (stone.id === "cold-tide") {
                            stone.pendingCharges += 1;
                        } else {
                            this.addDamage((params.damage || 0) * this.targetCount, stone.id, "machine_periodic");
                            if (params.meter) this.addMeter(stone.element, params.meter);
                        }
                        stone.nextAt += interval;
                    }
                }
            });
            this.consumeColdTideCharge();
        }

        tickCraftStone() {
            if (!this.craftStone || this.time < this.craftStone.nextCastAt) return;
            const stone = this.craftStone;
            this.emit(EVENTS.CRAFT_STONE_CAST_START, { stoneId: stone.id });
            const impactAt = this.time + stone.castTime;
            if (impactAt <= this.duration) {
                if (stone.id === "frost-glory") {
                    const tickCount = Math.max(1, Math.round(stone.castTime));
                    const perTick = stone.params.damage / tickCount;
                    for (let i = 1; i <= tickCount; i += 1) {
                        this.scheduleEvent(this.time + i, () => {
                            this.addDamage(perTick * this.targetCount, stone.id, "craft_stone");
                            this.consumeColdTideCharge();
                        });
                    }
                    this.scheduleEvent(impactAt, () => {
                        this.notifyCraftStoneCastEnd({ stoneId: stone.id });
                    });
                } else {
                    this.scheduleEvent(impactAt, () => {
                        this.addDamage(stone.params.damage * this.targetCount, stone.id, "craft_stone");
                        if (stone.id === "thunder-aegis") {
                            this.scheduleThunderAegisChains(stone);
                        }
                        this.notifyCraftStoneCastEnd({ stoneId: stone.id });
                    });
                }
            }
            stone.nextCastAt += stone.cooldown;
        }

        scheduleThunderAegisChains(stone) {
            const duration = stone.params.chainDuration || 10;
            const interval = stone.params.chainInterval || 2;
            const sourceCard = this.getCard(CARD_IDS.THUNDER_BANNER) || {
                id: stone.id,
                params: { chainDamage: 9660, maxEnemyTargets: 3 }
            };
            for (let delay = interval; delay <= duration + 1e-9; delay += interval) {
                this.scheduleEvent(this.time + delay, () => {
                    this.triggerChainLightning(sourceCard, 1);
                });
            }
        }

        triggerFireMeteor(stone, mechanic) {
            const params = stone.params;
            this.addDamage((params.damage || 0) * this.targetCount, stone.id, mechanic);
            this.addMeter("fire", params.meter || 0);
            if (stone.rank >= 3 && params.burnDamage) {
                for (let delay = 2; delay <= params.burnDuration; delay += 2) {
                    this.scheduleEvent(this.time + delay, () => {
                        this.addDamage(params.burnDamage * this.targetCount, stone.id, "machine_fire_meteor_burn");
                        this.addMeter("fire", 200 * this.targetCount);
                    });
                }
            }
        }

        triggerFlameBody(stone, stacks, mechanic) {
            const params = stone.params;
            const ticks = Math.floor(params.duration || 12);
            for (let stack = 0; stack < stacks; stack += 1) {
                for (let delay = 1; delay <= ticks; delay += 1) {
                    this.scheduleEvent(this.time + delay, () => {
                        this.addDamage((params.damage || 0) * Math.min(3, this.targetCount), stone.id, mechanic);
                    });
                }
            }
        }

        triggerPaperForest(stone) {
            const params = stone.params;
            const attackCount = stone.rank >= 3 ? (params.upgradedAttacks || 3) : (params.attacks || 6);
            const attackInterval = params.attackInterval || 2;
            for (let i = 0; i < attackCount; i += 1) {
                this.scheduleEvent(this.time + i * attackInterval, () => {
                    this.addDamage((params.damage || 0) * this.targetCount, stone.id, "machine_paper_forest");
                    if (stone.rank >= 5) this.addMeter("wood", 80 * this.targetCount);
                    const earthRift = this.machineStoneMap.get("earth-rift");
                    if (earthRift && earthRift.rank >= 5) {
                        this.addDamage((earthRift.params.echoDamage || 0) * this.targetCount, earthRift.id, "machine_earth_rift_echo_followup");
                    }
                });
            }
            if (stone.rank >= 3) {
                const stormInterval = (params.stormDuration || 4) / ((params.stormHits || 11) - 1);
                for (let i = 0; i < (params.stormHits || 11); i += 1) {
                    this.scheduleEvent(this.time + i * stormInterval, () => {
                        this.addDamage((params.stormDamage || 4513) * this.targetCount, stone.id, "machine_paper_storm");
                        if (stone.rank >= 5) this.addMeter("wood", 80 * this.targetCount);
                        const earthRift = this.machineStoneMap.get("earth-rift");
                        if (earthRift && earthRift.rank >= 5) {
                            this.addDamage((earthRift.params.echoDamage || 0) * this.targetCount, earthRift.id, "machine_earth_rift_echo_followup");
                        }
                    });
                }
            }
        }

        triggerColdTideCraftWaves(stone) {
            const waves = stone.rank >= 5 ? 4 : 0;
            for (let i = 0; i < waves; i += 1) {
                stone.pendingCharges += 1;
            }
        }

        triggerFiveThunderOrb(stone) {
            const params = stone.params;
            const targetsHit = this.targetCount;
            this.addDamage((params.damage || 0) * targetsHit, stone.id, "machine_thunder_orb");
            if (stone.rank >= 3) {
                this.addDamage((params.burstDamage || 0) * targetsHit, stone.id, "machine_thunder_orb_burst");
            }
            if (stone.rank >= 5) {
                const thunderBanner = this.getCard(CARD_IDS.THUNDER_BANNER);
                if (!thunderBanner) return;
                const hasPurpleDragon = Boolean(this.getCard(CARD_IDS.PURPLE_DRAGON));
                const chainCount = hasPurpleDragon ? 6 : 3;
                for (let i = 0; i < chainCount; i += 1) {
                    this.triggerChainLightning(thunderBanner, 0.8, {
                        skipPurpleDragonExtra: true,
                        skipStaticOverload: true
                    });
                }
            }
        }

        triggerWoodSpirit(stone, count) {
            const params = stone.params;
            const attackCount = Math.floor((params.duration || 30) / (params.attackInterval || 3));
            for (let summon = 0; summon < count; summon += 1) {
                for (let i = 1; i <= attackCount; i += 1) {
                    this.scheduleEvent(this.time + i * (params.attackInterval || 3), () => {
                        this.addDamage((params.damage || 0) * this.targetCount, stone.id, "machine_wood_spirit");
                        if (stone.rank >= 3 && this.craftStone && this.craftStone.id === "verdant-life") {
                            this.craftStone.nextCastAt = Math.max(this.time, this.craftStone.nextCastAt - 1);
                        }
                        const earthRift = this.machineStoneMap.get("earth-rift");
                        if (earthRift && earthRift.rank >= 5) {
                            this.addDamage((earthRift.params.echoDamage || 0) * this.targetCount, earthRift.id, "machine_earth_rift_echo_followup");
                        }
                    });
                }
            }
        }

        triggerEarthRift(stone) {
            const params = stone.params;
            this.addDamage((params.damage || 0) * this.targetCount, stone.id, "machine_earth_rift");
            if (stone.rank >= 3) {
                for (let delay = 1; delay <= (params.echoDuration || 30); delay += 1) {
                    this.scheduleEvent(this.time + delay, () => {
                        this.addDamage((params.echoDamage || 0) * this.targetCount, stone.id, "machine_earth_rift_echo");
                    });
                }
            }
        }

        handleWoodDice() {
            const stone = this.machineStoneMap.get("wood-dice");
            if (!stone) return;
            stone.counter = (stone.counter || 0) + 1;
            const threshold = stone.params.pulseThreshold || 6;
            if (stone.counter < threshold) return;
            stone.counter = 0;
            const maxStacks = stone.rank >= 3 ? 6 : 3;
            this.effects.wood.luckStacks = maxStacks;
            if (stone.rank >= 5) {
                this.addDamage((stone.params.burstDamage || 0) * this.targetCount, stone.id, "machine_wood_dice_burst");
            }
        }

        applyWoodDicePulseMeter() {
            const stone = this.machineStoneMap.get("wood-dice");
            if (!stone || stone.rank < 3) return;
            this.addMeter("wood", 200 * this.targetCount);
        }

        consumeWoodDiceBonus(damage) {
            if (this.effects.wood.luckStacks <= 0) return damage;
            const stone = this.machineStoneMap.get("wood-dice");
            if (!stone) return damage;
            this.effects.wood.luckStacks -= 1;
            return damage * (1 + (stone.params.damageBonus || 0));
        }

        triggerNineSkyThunder(stone) {
            const params = stone.params;
            const bolts = (params.bolts || 2) + (stone.rank >= 3 ? 1 : 0) + (stone.rank >= 5 ? 1 : 0);
            this.addDamage((params.damage || 0) * bolts * this.targetCount, stone.id, "machine_nine_sky_thunder");
            if (stone.rank >= 3) this.addMeter("thunder", 100 * bolts * this.targetCount);
            if (stone.rank >= 5 && this.targetCount > 1) {
                this.addDamage((params.damage || 0) * bolts * (this.targetCount - 1), stone.id, "machine_nine_sky_thunder_copy");
            }
        }

        triggerThunderSpearDot(stone, hits) {
            if (stone.rank < 3) return;
            for (let second = 1; second <= 8; second += 1) {
                this.scheduleEvent(this.time + second, () => {
                    this.addDamage(95 * hits, stone.id, "machine_thunder_spear_dot");
                });
            }
        }

        triggerThunderShock(stone) {
            const params = stone.params;
            const interval = stone.rank >= 3 ? 0.5 : (params.interval || 1);
            const targets = Math.min(this.targetCount, stone.rank >= 3 ? 2 : 1);
            for (let delay = interval; delay <= (params.duration || 10) + 1e-9; delay += interval) {
                this.scheduleEvent(this.time + delay, () => {
                    this.addDamage((params.damage || 0) * targets, stone.id, "machine_thunder_shock");
                });
            }
            if (stone.rank >= 5) {
                this.scheduleEvent(this.time + (params.duration || 10), () => {
                    this.addDamage((params.burstDamage || 0) * this.targetCount, stone.id, "machine_thunder_shock_burst");
                    this.addMeter("thunder", 500 * this.targetCount);
                });
            }
        }

        scheduleThunderAmplifyTicks() {
            const shock = this.machineStoneMap.get("thunder-shock");
            if (shock) this.triggerThunderShock(shock);
            const thunder = this.machineStoneMap.get("nine-sky-thunder");
            if (thunder) this.triggerNineSkyThunder(thunder);
        }

        triggerFrostCrystalSpike(stone) {
            const params = stone.params;
            this.addDamage((params.damage || 0) * (params.spikeCount || 3), stone.id, "machine_frost_crystal_spike");
            if (stone.rank >= 3) this.notifyShatter();
        }

        grantFrostCrystalSpikeCharges(count) {
            const stone = this.machineStoneMap.get("frost-crystal-spike");
            if (!stone) return;
            stone.pendingCharges = (stone.pendingCharges || 0) + count;
        }

        consumeColdTideCharge() {
            const stone = this.machineStoneMap.get("cold-tide");
            if (!stone || !stone.pendingCharges) return false;
            stone.pendingCharges -= 1;
            this.addDamage((stone.params.damage || 0) * this.targetCount, stone.id, "machine_cold_tide");
            if (stone.rank >= 3 && stone.params.meterAtRank3) {
                this.addMeter("ice", stone.params.meterAtRank3 * this.targetCount);
            }
            return true;
        }

        handleMachineIceArrow(count) {
            const stone = this.machineStoneMap.get("frost-crystal-spike");
            if (!stone) return;
            stone.counter = (stone.counter || 0) + count;
            while (stone.counter >= (stone.params.arrowThreshold || 10)) {
                stone.counter -= stone.params.arrowThreshold || 10;
                this.grantFrostCrystalSpikeCharges(1);
            }
        }

        consumeFrostCrystalSpikeCharge() {
            const stone = this.machineStoneMap.get("frost-crystal-spike");
            if (!stone || !stone.pendingCharges) return;
            stone.pendingCharges -= 1;
            this.triggerFrostCrystalSpike(stone);
        }

        triggerScarletRing(stone) {
            const params = stone.params;
            const ticks = stone.rank >= 3 ? 2 : 1;
            for (let i = 0; i < ticks; i += 1) {
                this.addDamage((params.damage || 0) * this.targetCount, stone.id, "machine_fire_tick");
                if (this.random() < 0.20) {
                    const scarletAnt = this.getCard(CARD_IDS.SCARLET_ANT);
                    if (scarletAnt) this.applyBurn(0, scarletAnt, 1, true, true);
                }
            }
        }

        scheduleScarletRingTicks() {
            const stone = this.machineStoneMap.get("scarlet-ring");
            if (!stone) return;
            const interval = stone.rank >= 5 ? 1.5 : 2;
            const duration = stone.rank >= 5 ? 12 : 10;
            for (let delay = interval; delay <= duration + 1e-9; delay += interval) {
                this.scheduleEvent(this.time + delay, () => {
                    this.dispatchMachineStones(EVENTS.FIRE_AMPLIFY_TICK, { element: "fire" });
                });
            }
        }

        dispatchMachineStones(eventType, event = {}) {
            this.machineStones.forEach(stone => {
                const mechanics = stone.mechanics || [];
                const matches = (eventType === EVENTS.ELEMENT_AMPLIFY && mechanics.includes(`on_${event.element}_amplify`))
                    || (eventType === EVENTS.FIRE_AMPLIFY_TICK && mechanics.includes("during_fire_amplify"))
                    || (eventType === EVENTS.ICE_AMPLIFY_FREEZE && mechanics.includes("on_ice_freeze"))
                    || (eventType === EVENTS.ICE_ELEMENTAL_SUMMONED && mechanics.includes("on_ice_elemental"))
                    || (eventType === EVENTS.WOOD_BLOOM && mechanics.includes("on_wood_bloom"))
                    || (eventType === EVENTS.CHAIN_LIGHTNING_HIT && mechanics.includes("on_chain_hit"))
                    || (eventType === EVENTS.CRAFT_STONE_CAST_END && mechanics.includes("on_craft_fire_end") && event.stoneId === "blazing-skyfire")
                    || (eventType === EVENTS.CRAFT_STONE_CAST_END && stone.id === "thunder-guard" && event.stoneId === "thunder-aegis")
                    || (eventType === EVENTS.CRAFT_STONE_CAST_END && stone.id === "cold-tide" && event.stoneId === "frost-glory")
                    || (eventType === EVENTS.CRAFT_STONE_CAST_END && stone.id === "frost-rain" && event.stoneId === "frost-glory")
                    || (eventType === EVENTS.CRAFT_STONE_CAST_END && stone.id === "frost-shatter" && event.stoneId === "frost-glory")
                    || (eventType === EVENTS.ICE_ELEMENTAL_SUMMONED && stone.id === "frost-crystal-spike")
                    || (eventType === EVENTS.CRAFT_STONE_CAST_END && stone.id === "rotten-gale" && event.stoneId === "verdant-life")
                    || (eventType === EVENTS.CRAFT_STONE_CAST_END && stone.id === "earth-rift" && event.stoneId === "verdant-life")
                    || (eventType === EVENTS.CRAFT_STONE_CAST_END && stone.id === "wood-spirit" && event.stoneId === "verdant-life")
                    || (eventType === EVENTS.COMBUST && stone.id === "flame-body");
                if (!matches) return;
                const params = stone.params;
                let amount = params.damage || 0;
                if (eventType === EVENTS.FIRE_AMPLIFY_TICK && stone.id === "scarlet-ring") {
                    this.triggerScarletRing(stone);
                    return;
                }
                if (eventType === EVENTS.ELEMENT_AMPLIFY && event.element === "fire" && stone.id === "fire-meteor" && stone.rank < 5) {
                    return;
                }
                if (eventType === EVENTS.ELEMENT_AMPLIFY && event.element === "fire" && stone.id === "fire-meteor") {
                    this.triggerFireMeteor(stone, "machine_fire_meteor_amplify");
                    return;
                }
                if (eventType === EVENTS.ICE_ELEMENTAL_SUMMONED && stone.id === "frost-shatter") {
                    this.addDamage((params.damage || 0) * this.targetCount, stone.id, "machine_frost_shatter");
                    if (stone.rank >= 3) {
                        for (let delay = 1; delay <= (params.extraDuration || 6); delay += 1) {
                            this.scheduleEvent(this.time + delay, () => this.addDamage((params.extraDamage || 0) / (params.extraDuration || 6) * this.targetCount, stone.id, "machine_frost_shatter_dot"));
                        }
                    }
                    return;
                }
                if (eventType === EVENTS.ICE_AMPLIFY_FREEZE && stone.id === "frost-rain") {
                    this.addDamage((params.damage || 0) * this.targetCount, stone.id, "machine_frost_rain");
                    return;
                }
                if (eventType === EVENTS.ICE_ELEMENTAL_SUMMONED && stone.id === "frost-crystal-spike" && stone.rank >= 5) {
                    this.grantFrostCrystalSpikeCharges(2);
                    return;
                }
                if (eventType === EVENTS.ELEMENT_AMPLIFY && event.element === "ice" && stone.id === "frost-surge") {
                    this.addDamage((params.damage || 0) * this.targetCount, stone.id, "machine_ice_amplify");
                    return;
                }
                if (eventType === EVENTS.ELEMENT_AMPLIFY && event.element === "wood" && stone.id === "wood-spirit") {
                    this.triggerWoodSpirit(stone, stone.rank >= 5 ? 3 : 1);
                    return;
                }
                if (eventType === EVENTS.ELEMENT_AMPLIFY && event.element === "thunder") {
                    return;
                }
                if (eventType === EVENTS.CRAFT_STONE_CAST_END && stone.id === "blazing-land") {
                    for (let delay = 1; delay <= (params.duration || 8); delay += (params.interval || 1)) {
                        this.scheduleEvent(this.time + delay, () => {
                            this.addDamage((params.damage || 0) * this.targetCount, stone.id, "machine_blazing_land");
                            if (stone.rank >= 3) this.addMeter("fire", 1500 * this.targetCount);
                        });
                    }
                    return;
                }
                if (eventType === EVENTS.CRAFT_STONE_CAST_END && stone.id === "cold-tide" && stone.rank >= 5) {
                    this.triggerColdTideCraftWaves(stone);
                    return;
                }
                if (eventType === EVENTS.CRAFT_STONE_CAST_END && stone.id === "frost-rain" && stone.rank >= 3 && this.craftStone?.id === "frost-glory") {
                    this.scheduleEvent(this.time + 0.001, () => {
                        this.addDamage(this.craftStone.params.damage * 0.30 * this.targetCount, stone.id, "machine_frost_rain_craft_bonus");
                    });
                    return;
                }
                if (eventType === EVENTS.CRAFT_STONE_CAST_END && stone.id === "frost-shatter" && stone.rank >= 5) {
                    this.notifyIceElementalSummoned({ sourceCardId: stone.id });
                    return;
                }
                if (eventType === EVENTS.CRAFT_STONE_CAST_END && stone.id === "rotten-gale" && stone.rank >= 5) {
                    this.addMeter("wood", 10000 * Math.min(5, this.targetCount));
                    return;
                }
                if (eventType === EVENTS.CRAFT_STONE_CAST_END && stone.id === "earth-rift") {
                    this.triggerEarthRift(stone);
                    return;
                }
                if (eventType === EVENTS.CRAFT_STONE_CAST_END && stone.id === "wood-spirit" && stone.rank >= 5) {
                    this.triggerWoodSpirit(stone, 2);
                    return;
                }
                if (eventType === EVENTS.CRAFT_STONE_CAST_END && stone.id === "thunder-guard") {
                    const duration = params.duration || 10;
                    stone.guardExpiresAt = this.time + duration;
                    if (stone.rank >= 3 && this.externalSkillDps > 0) {
                        const total = this.externalSkillDps * duration * (params.externalSkillBonus || 0);
                        this.addDamage(total, stone.id, "machine_thunder_guard_external");
                    }
                    return;
                }
                if (eventType === EVENTS.CRAFT_STONE_CAST_END && stone.id === "flame-body" && event.stoneId === "blazing-skyfire" && stone.rank >= 5) {
                    this.triggerFlameBody(stone, 12, "machine_flame_body_craft");
                    return;
                }
                if (eventType === EVENTS.COMBUST && stone.id === "flame-body" && stone.rank >= 3) {
                    this.triggerFlameBody(stone, 2, "machine_flame_body_combust");
                    return;
                }
                if (eventType === EVENTS.CHAIN_LIGHTNING_HIT) {
                    amount *= event.targetsHit || 1;
                    const hits = stone.rank >= 5 ? 1 + (params.extraAtRank5 || 0) : 1;
                    for (let i = 0; i < hits; i++) {
                        this.addDamage(amount, stone.id, "machine_chain");
                    }
                    this.triggerThunderSpearDot(stone, hits);
                } else {
                    const count = eventType === EVENTS.ELEMENT_AMPLIFY && event.element === "fire" && stone.id === "fireburst" && stone.rank >= 5 ? 2 : 1;
                    this.addDamage(amount * this.targetCount * count, stone.id, "machine_link");
                }
                if (eventType === EVENTS.ICE_AMPLIFY_FREEZE && stone.rank >= 5 && params.freezeMeterAtRank5) {
                    this.addMeter("ice", this.effects.ice.freezeMeterBonus || params.freezeMeterAtRank5);
                }
            });
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
            this.dispatchMachineStones(EVENTS.COMBUST, { targetIndex });
        }

        // 发射冰箭；每一段命中后都向冰系联动广播事件。
        fireIceArrow(card, arrowCount, damagePerArrow, mechanic, maxTargets) {
            const targetsHit = Math.min(this.targetCount, maxTargets || this.targetCount);
            for (let i = 0; i < arrowCount; i++) {
                const totalDamage = damagePerArrow * targetsHit;
                this.addDamage(totalDamage, card.id, mechanic);
                const consumedColdTide = this.consumeColdTideCharge();
                this.handleMachineIceArrow(1);
                if (!consumedColdTide) this.consumeColdTideCharge();
                this.consumeFrostCrystalSpikeCharge();
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
            this.consumeColdTideCharge();
            this.consumeFrostCrystalSpikeCharge();
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
            const boostedBase = this.consumeWoodDiceBonus(base);
            const damage = boostedBase * this.targetCount * efficiency;
            this.addDamage(damage, card.id, mechanic);
            this.notifyPulseTriggered({
                card,
                efficiency,
                mechanic,
                damage
            });
            this.applyWoodDicePulseMeter();
            this.handleWoodDice();
        }

        // 触发一次雷链，并广播给神雷联动丹青。
        triggerChainLightning(card, efficiency, options = {}) {
            const targetsHit = Math.min(this.targetCount, card.params.maxEnemyTargets || 3);
            let damagePerTarget = this.getChainDamage(card.params.chainDamage, targetsHit) * efficiency;
            const thunderGuard = this.machineStoneMap.get("thunder-guard");
            if (thunderGuard && thunderGuard.guardExpiresAt && this.time <= thunderGuard.guardExpiresAt) {
                damagePerTarget *= 1 + (thunderGuard.params.chainBonus || 0);
            }
            this.addDamage(damagePerTarget * targetsHit, card.id, efficiency < 1 ? "chain_lightning_frenzy" : "chain_lightning");
            this.notifyChainLightningHit({
                sourceCardId: card.id,
                targetsHit,
                damagePerTarget,
                efficiency,
                skipPurpleDragonExtra: Boolean(options.skipPurpleDragonExtra),
                skipStaticOverload: Boolean(options.skipStaticOverload)
            });
            this.dispatchMachineStones(EVENTS.CHAIN_LIGHTNING_HIT, {
                sourceCardId: card.id,
                targetsHit,
                damagePerTarget,
                efficiency
            });
        }

        applyThunderGuardLinyinBonus() {
            const thunderGuard = this.machineStoneMap.get("thunder-guard");
            if (!thunderGuard || thunderGuard.rank < 5) return;
            if (!thunderGuard.guardExpiresAt || this.time > thunderGuard.guardExpiresAt) return;
            const total = 93805 * this.targetCount * (thunderGuard.params.allLinyinBonus || 0);
            this.addDamage(total, thunderGuard.id, "machine_thunder_guard_linyin");
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
            this.dispatchMachineStones(EVENTS.ELEMENT_AMPLIFY, { element });
            if (element === "fire") {
                this.scheduleScarletRingTicks();
            }
            if (element === "thunder") {
                this.scheduleThunderAmplifyTicks();
            }
            this.applyThunderGuardLinyinBonus();
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

        notifyIceAmplifyFreeze(event = {}) {
            this.emit(EVENTS.ICE_AMPLIFY_FREEZE, event);
            this.dispatchMachineStones(EVENTS.ICE_AMPLIFY_FREEZE, event);
        }

        notifyIceElementalSummoned(event = {}) {
            this.emit(EVENTS.ICE_ELEMENTAL_SUMMONED, event);
            this.dispatchMachineStones(EVENTS.ICE_ELEMENTAL_SUMMONED, event);
        }

        notifyWoodBloom(event = {}) {
            this.emit(EVENTS.WOOD_BLOOM, event);
            this.dispatchMachineStones(EVENTS.WOOD_BLOOM, event);
        }

        notifyCraftStoneCastEnd(event = {}) {
            this.emit(EVENTS.CRAFT_STONE_CAST_END, event);
            this.dispatchMachineStones(EVENTS.CRAFT_STONE_CAST_END, event);
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

        describeInactiveMachineStone(stone) {
            switch (stone.id) {
                case "wood-dice":
                    return `${stone.name} 未触发：脉冲次数不足 ${stone.params.pulseThreshold || 6} 次`;
                case "thunder-shock":
                case "nine-sky-thunder":
                    return `${stone.name} 未触发：本局未达成神雷激化`;
                case "frost-rain":
                    return `${stone.name} 未触发：本局未触发玄冰冻结`;
                case "frost-shatter":
                    return `${stone.name} 未触发：本局未出现冰霜元素`;
                case "frost-crystal-spike":
                    return `${stone.name} 未触发：冰箭数量不足 ${stone.params.arrowThreshold || 10} 枚，或未消费寒晶刺效果`;
                case "cold-tide":
                    return `${stone.name} 未触发：未产生可消耗的寒潮攻击机会`;
                case "rotten-gale":
                    return `${stone.name} 未触发：本局未触发苍木激化·绽放`;
                case "wood-spirit":
                    return `${stone.name} 未触发：本局未达成苍木激化`;
                case "earth-rift":
                    return `${stone.name} 未触发：本局未召唤苍木树人近似事件`;
                case "thunder-spear":
                    return `${stone.name} 未触发：本局连锁闪电命中次数不足`;
                case "thunder-guard":
                    return `${stone.name} 未单列伤害：当前作为连锁闪电增伤窗口生效`;
                default:
                    return `${stone.name} 未触发：当前组合缺少其前置触发条件或时长不足`;
            }
        }

        // 把内部累计结果整理成最终返回结构。
        finalize() {
            const inactiveMachineStones = this.machineStones
                .filter(stone => !stone.activated)
                .map(stone => this.describeInactiveMachineStone(stone));
            this.warnings.push(...inactiveMachineStones);
            const duration = Math.max(1, this.duration);
            const byCard = Object.entries(this.breakdown.byCard)
                .map(([cardId, damage]) => {
                    const card = this.getCard(cardId) || Data.getCardDefById(cardId) || Data.getMachineStoneDefById(cardId) || Data.getCraftStoneDefById(cardId) || { name: cardId };
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
                amplifyTimeline: {
                    fire: this.amplifyTimeline.fire.slice(),
                    ice: this.amplifyTimeline.ice.slice(),
                    wood: this.amplifyTimeline.wood.slice(),
                    thunder: this.amplifyTimeline.thunder.slice()
                },
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
