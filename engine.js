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
        WOOD_GIANT_SUMMONED: "wood_giant_summoned",
        THUNDER_AMPLIFY_TICK: "thunder_amplify_tick",
        CRAFT_STONE_CAST_START: "craft_stone_cast_start",
        CRAFT_STONE_CAST_END: "craft_stone_cast_end"
    };
    const ICE_AMPLIFY_FINAL_DELAY = 2;
    const WOOD_AMPLIFY_INTERVAL = 1;
    const WOOD_AMPLIFY_DURATION = 9;
    const OPENING_PULSE_SCHEDULE = [0, 2, 4];
    const STATIC_OVERLOAD_TICKS = 4;
    // 静电过载：可无限叠层，持续时间来自雷魄晶，同一目标共用一条结算节奏。
    const STATIC_OVERLOAD_MAX_STACKS = 0;
    const STATIC_OVERLOAD_DEFAULT_DURATION = 8;
    const THUNDER_SPEAR_DURATION = 8;
    const THUNDER_SPEAR_TICK_INTERVAL = 1;
    const FLAME_BODY_MAX_STACKS = 12;
    const FLAME_BODY_DURATION = 12;
    const FLAME_BODY_TICK_INTERVAL = 1;
    const OPENING_PRECAST_SECONDS_BY_CRAFT = Object.freeze({
        "verdant-life": 2,
        "thunder-aegis": 1.3
    });
    const ELEMENT_TRIGGER_THRESHOLD = 10000;
    // 四系激化的伤害参数。激化是内置逻辑，不依赖具体丹青是否在编，
    // 因此伤害统一归到内置来源，不再计入任何丹青的贡献。
    const AMPLIFY_DAMAGE = {
        fire: { sourceId: "fire-amplify", tickDamage: 39181, interval: 2, duration: 10 },
        ice: { sourceId: "ice-amplify", initialDamage: 43534, finalDamage: 85327 },
        wood: { sourceId: "wood-amplify", tickDamage: 24916, bloomDamage: 72108, bloomEvery: 3 },
        thunder: { sourceId: "thunder-amplify", damage: 93805 }
    };

    // 内置激化来源的展示名。
    const AMPLIFY_SOURCE_LABELS = {
        "fire-amplify": "天火激化",
        "ice-amplify": "玄冰激化",
        "wood-amplify": "苍木激化",
        "thunder-amplify": "神雷激化"
    };

    // 机制名的中文展示。日志和拆解列表都用它，避免界面里混入内部 id。
    const MECHANIC_LABELS = {
        // 天火
        burn_tick: "燃烧",
        ignite: "引燃",
        combust: "爆燃",
        fire_amplify: "天火激化",
        // 玄冰
        ice_arrow: "冰箭",
        ice_arrow_volley: "冰箭齐射",
        ice_storm: "玄冰风暴",
        ice_storm_frenzy: "玄冰风暴",
        ice_storm_extra: "玄冰风暴·额外召唤",
        shatter: "碎裂",
        ice_amplify: "玄冰激化",
        // 苍木
        pulse: "脉冲",
        opening_pulse: "开局脉冲",
        pulse_followup: "追加脉冲",
        pulse_echo: "震荡",
        wood_amplify: "苍木激化",
        wood_bloom: "苍木激化·绽放",
        // 神雷
        chain_lightning: "连锁闪电",
        chain_lightning_extra: "连锁闪电·额外",
        chain_lightning_frenzy: "连锁闪电·雷暴",
        static_overload: "静电过载",
        thunder_amplify: "神雷激化",
        // 匠心石
        craft_stone: "匠心石",
        craft_stone_attack: "匠心石·普攻",
        // 机巧石·天火
        machine_periodic: "周期触发",
        machine_fire_meteor_burn: "陨星灼烧",
        machine_fire_meteor_amplify: "激化陨星",
        machine_fire_tick: "赤焰天环",
        machine_blazing_land: "烈焰之地",
        machine_flame_body: "烈焰焚身",
        craft_burnheart: "焚心",
        machine_link: "机巧联动",
        // 机巧石·玄冰
        machine_ice_amplify: "凛霜寒涌",
        machine_frost_shatter: "霜寒破裂",
        machine_frost_shatter_dot: "霜寒破裂·持续",
        machine_frost_rain: "霜刺寒雨",
        machine_frost_crystal_spike: "寒晶刺",
        machine_frost_crystal_shatter: "寒晶刺·碎裂",
        machine_cold_tide: "寒潮冰涌",
        // 机巧石·苍木
        machine_rotten_gale: "腐木瘴风",
        machine_paper_forest: "小纸人",
        machine_paper_storm: "纸人风暴",
        machine_wood_spirit: "木引青灵",
        machine_wood_dice_burst: "神木骰·爆发",
        machine_earth_rift: "裂地崩",
        machine_earth_rift_echo: "裂地崩·回响",
        machine_earth_rift_echo_followup: "裂地崩·回响追击",
        // 机巧石·神雷
        machine_chain: "惊雷戟",
        machine_thunder_spear_dot: "惊雷戟·持续",
        machine_thunder_shock: "雷霆震击",
        machine_thunder_shock_burst: "雷霆震击·爆炸",
        machine_nine_sky_thunder: "九霄雷动",
        machine_nine_sky_thunder_copy: "九霄雷动·复制",
        machine_thunder_orb: "五雷珠",
        machine_thunder_orb_burst: "五雷珠·爆发",
        machine_thunder_guard_external: "天雷护佑·职业技能/法宝",
        craft_thunder_storm: "雷暴",
        // 状态计数（只计次不计伤害）
        machine_fire_meteor_apply: "陨星·首次附加",
        machine_fire_meteor_stack: "陨星·叠层",
        machine_fire_meteor_refresh: "陨星·刷新",
        machine_fire_meteor_stacks: "陨星·层数累计",
        pulse_echo_apply: "震荡·首次附加",
        pulse_echo_stack: "震荡·叠层",
        pulse_echo_stacks: "震荡·层数累计"
    };

    function getMechanicLabel(mechanic) {
        return MECHANIC_LABELS[mechanic] || mechanic;
    }
    // 天火陨星持续效果：最多 2 层，每层 10 秒，每 2 秒结算一次。
    const FIRE_METEOR_MAX_STACKS = 2;
    const FIRE_METEOR_TICK_INTERVAL = 2;
    const FIRE_METEOR_DURATION = 10;
    // 震荡：可无限叠层，每层 10 秒，同一目标共用每 2 秒一次的结算节奏。
    const WOOD_ECHO_MAX_STACKS = 0;
    const WOOD_ECHO_TICK_INTERVAL = 2;
    const WOOD_ECHO_DURATION = 10;

    // 通用目标 buff 层数机制：每层独立计时，可叠层；达到上限后移除最早一层，再叠上新的一层。
    // maxStacks 传 0 表示没有层数上限；每层按 duration / tickInterval 结算固定次数，避免浮点边界漏跳或多跳。
    class StackBuff {
        constructor(maxStacks, duration, tickInterval = 0) {
            this.maxStacks = maxStacks > 0 ? maxStacks : Infinity;
            this.duration = duration;
            this.tickInterval = tickInterval;
            this.tickAt = 0;
            // layers 保存每层的 { expireAt, weight, ticksLeft }，始终按到期时间升序排列。
            this.layers = [];
        }

        // 清掉已到期的层，返回当前存活层数。
        prune(now) {
            if (this.layers.length > 0) {
                this.layers = this.layers.filter(layer => now <= layer.expireAt + 1e-9 && layer.ticksLeft !== 0);
            }
            if (this.layers.length === 0) this.tickAt = 0;
            return this.layers.length;
        }

        // 叠加一层；已达上限时先移除最早一层，再叠上新的一层。
        apply(now, duration, weight = 1, meta = null) {
            const life = Number.isFinite(duration) ? duration : this.duration;
            const hadLayers = this.prune(now) > 0;
            if (this.layers.length >= this.maxStacks) {
                this.layers.shift();
            }
            this.layers.push({
                expireAt: now + life,
                weight,
                meta,
                // tickInterval 为 0 表示纯状态层，不做周期结算，用 -1 表示不受次数约束。
                ticksLeft: this.tickInterval > 0 ? Math.max(1, Math.round(life / this.tickInterval)) : -1
            });
            this.layers.sort((a, b) => a.expireAt - b.expireAt);
            // 结算节奏在效果第一次出现时起表，之后只要还有层就一直走，不被新层打断。
            if (this.tickInterval > 0 && !hadLayers) {
                this.tickAt = now + this.tickInterval;
            }
            return this.layers.length;
        }

        get stacks() {
            return this.layers.length;
        }

        // 所有存活层的效能之和，用于按层数倍乘伤害。
        get weight() {
            return this.layers.reduce((sum, layer) => sum + layer.weight, 0);
        }

        // 消费一次结算：返回参与本次结算的效能总和，并扣掉各层剩余次数。
        consumeTick(now) {
            const total = this.prune(now) > 0 ? this.weight : 0;
            this.layers.forEach(layer => {
                if (layer.ticksLeft > 0) layer.ticksLeft -= 1;
            });
            this.prune(now);
            return total;
        }

        // 消费一次结算并按 meta 分组返回效能，用于需要区分伤害归属的持续效果。
        consumeTickByMeta(now) {
            const grouped = new Map();
            if (this.prune(now) > 0) {
                this.layers.forEach(layer => {
                    const key = layer.meta;
                    grouped.set(key, (grouped.get(key) || 0) + layer.weight);
                });
            }
            this.layers.forEach(layer => {
                if (layer.ticksLeft > 0) layer.ticksLeft -= 1;
            });
            this.prune(now);
            return grouped;
        }

        // 最后一层的到期时间，用于判断持续伤害是否还该继续。
        get lastExpireAt() {
            return this.layers.length > 0 ? this.layers[this.layers.length - 1].expireAt : 0;
        }

        clear() {
            this.layers = [];
            this.tickAt = 0;
        }
    }

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
                amplifyDamageBonus: 0,
                triggerThreshold: null
            },
            ice: {
                arrowDamageMultiplier: 1,
                shatterChance: 0,
                shatterDamage: 0,
                amplifyDamageBonus: 0,
                freezeMeterBonus: 0,
                arrowMeterGain: 0,
                shatterMeterGain: 0,
                stormMeterGain: 0,
                craftStoneDamageBonus: 0,
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
                amplifyDamageBonus: 0,
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

            // 天火陨星持续状态
            this.fireMeteor = new StackBuff(FIRE_METEOR_MAX_STACKS, FIRE_METEOR_DURATION, FIRE_METEOR_TICK_INTERVAL);

            // 烈焰焚身持续状态：可叠层，每层独立计时，每秒结算一次。
            this.flameBody = new StackBuff(FLAME_BODY_MAX_STACKS, FLAME_BODY_DURATION, FLAME_BODY_TICK_INTERVAL);

            // 震荡持续状态：无层数上限
            this.woodEcho = new StackBuff(WOOD_ECHO_MAX_STACKS, WOOD_ECHO_DURATION, WOOD_ECHO_TICK_INTERVAL);

            // 裂地崩·回响的到期时刻。裂地崩 3/5 命中时写入，5/5 的「回响追击」
            // 必须据此判断目标身上到底有没有回响 —— 原文：「攻击带有裂地崩·回响的敌方时」。
            this.earthRiftEchoExpireAt = 0;

            // 静电过载持续状态：无层数上限，结算间隔按持续时间均分
            this.staticOverload = new StackBuff(
                STATIC_OVERLOAD_MAX_STACKS,
                STATIC_OVERLOAD_DEFAULT_DURATION,
                STATIC_OVERLOAD_DEFAULT_DURATION / STATIC_OVERLOAD_TICKS
            );
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
            [EVENTS.COMBUST]: "onCombust"
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
            engine.addLog("event", this.id, `目标 ${event.targetIndex + 1} 爆燃：引爆 ${target.burnStacks}-1 层燃烧`, {
                targetIndex: event.targetIndex,
                stacks: target.burnStacks
            });
            engine.addDamage((target.burnStacks-1) * this.params.damagePerExtraLayer, this.id, "combust");
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
            [EVENTS.ICE_STORM_HIT]: "onIceStormHit"
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
    }

    class WenMin extends Card {
        static handlers = {
            [EVENTS.TIME]: "onTick"
        };

        static cardId = CARD_IDS.WEN_MIN;

        applyPassive(engine) {
            engine.effects.ice.arrowDamageMultiplier *= 1 + this.params.arrowDamageBonus;
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
            engine.effects.ice.arrowDamageMultiplier *= 1 + this.params.damageBonus;
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
                engine.addDamage(engine.getIceShatterDamage() * engine.targetCount, this.id, "shatter");
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
            [EVENTS.PULSE_TRIGGERED]: "onPulseTriggered"
        };

        static cardId = CARD_IDS.COOL_PEARL;

        applyPassive(engine) {
            engine.effects.wood.triggerThreshold = this.params.triggerThreshold;
        }

        onPulseTriggered(engine) {
            engine.addMeter("wood", this.params.meterGain * engine.targetCount);
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
            // 震荡是可无限叠层的目标状态：每次脉冲叠一层，层间共用 2 秒结算节奏。
            engine.applyWoodEcho(event.efficiency);
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
                if (delay <= 1e-9) {
                    engine.triggerPulse(event.card, this.params.extraPulseEfficiency, "pulse_followup");
                    continue;
                }
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
            [EVENTS.CHAIN_LIGHTNING_HIT]: "onChainLightningHit"
        };

        static cardId = CARD_IDS.ZI_XIAO_GOURD;

        applyPassive(engine) {
            engine.effects.thunder.triggerThreshold = this.params.triggerThreshold;
        }

        onChainLightningHit(engine, event) {
            engine.addMeter("thunder", this.params.meterGain * event.targetsHit);
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
                crystal.onChainLightningHit(engine, {
                    targetsHit: event.targetsHit,
                    sourceCardId: this.id,
                    skipStaticOverload: event.skipStaticOverload
                });
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
        // 激化伤害已内置到引擎，丹青不再监听该事件；保留空表以便后续有卡需要响应。
        [EVENTS.ELEMENT_AMPLIFY]: []
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
            this.pendingAmplifyCounts = { fire: 0, ice: 0, wood: 0, thunder: 0 };
            this.timeline = [];
            this.totalDamage = 0;
            this.lastSecondSample = 0;
            this.nextThunderFrenzyAt = Infinity;
            this.fireAmplifyState = null;
            this.woodAmplifyState = null;
            this.thunderSpearState = new StackBuff(0, THUNDER_SPEAR_DURATION, THUNDER_SPEAR_TICK_INTERVAL);
            // 雷霆震击是可刷新的单一状态；generation 用于让刷新前已排入队列的 tick/结束事件失效。
            this.thunderShockState = null;
            this.thunderShockGeneration = 0;
            this.thunderAegisExtraCastExpiresAt = 0;
            this.frostCrystalSpikeArrowCount = 0;
            this.thunderAegisSpearHitCount = 0;
            this.woodSummonExpiresAt = { giant: 0, paper: 0, spirit: 0 };
            // 洞察层数：由机巧石授予，下一次匠心石（灵蕴技）伤害时一次性消耗掉全部层数。
            this.insightStacks = 0;
            this.insightBonusPerStack = 0;
            // 模拟日志：仅在显式开启时记录，避免高级推演的批量模拟产生额外开销。
            this.logEnabled = Boolean(options.collectLog);
            this.logLimit = Math.max(1, Number(options.logLimit) || 5000);
            this.log = [];
            this.logTruncated = false;
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
            const requestedId = stoneConfig.id || stoneConfig;
            let def = Data.getCraftStoneDefById(requestedId);
            if (!def) {
                def = Data.CRAFT_STONE_DEFS.find(stone => stone.baseStoneId === requestedId) || null;
            }
            if (!def) throw new Error(`Unknown craft stone id: ${requestedId}`);
            const runtimeId = def.baseStoneId || def.id;
            const parsedLevel = parseInt(stoneConfig.level, 10);
            const level = Number.isFinite(parsedLevel) ? Math.max(0, Math.min(3, parsedLevel)) : 0;
            return { ...def, id: runtimeId, selectedVariantId: def.id, level, params: { ...def.params } };
        }

        hasCraftVariantActive(variantId, minLevel = 1) {
            return this.craftStone?.selectedVariantId === variantId && (this.craftStone?.level || 0) >= minLevel;
        }

        isBlazingSkyfireSpiritActive(minLevel = 1) {
            return this.hasCraftVariantActive("blazing-skyfire-spirit", minLevel);
        }

        isBlazingSkyfireTrueformActive(minLevel = 1) {
            return this.hasCraftVariantActive("blazing-skyfire-trueform", minLevel);
        }

        isFrostGlorySpiritActive(minLevel = 1) {
            return this.hasCraftVariantActive("frost-glory-spirit", minLevel);
        }

        isFrostGloryTrueformActive(minLevel = 1) {
            return this.hasCraftVariantActive("frost-glory-trueform", minLevel);
        }

        isVerdantLifeSpiritActive(minLevel = 1) {
            return this.hasCraftVariantActive("verdant-life-spirit", minLevel);
        }

        isVerdantLifeTrueformActive(minLevel = 1) {
            return this.hasCraftVariantActive("verdant-life-trueform", minLevel);
        }

        isThunderAegisSpiritActive(minLevel = 1) {
            return this.hasCraftVariantActive("thunder-aegis-spirit", minLevel);
        }

        isThunderAegisTrueformActive(minLevel = 1) {
            return this.hasCraftVariantActive("thunder-aegis-trueform", minLevel);
        }

        grantInsight(stacks, sourceId) {
            if (stacks <= 0) return;
            const before = this.insightStacks;
            this.insightStacks += stacks;
            this.addLog("buff", sourceId, `洞察 ${before} → ${this.insightStacks} 层`, {
                buff: "insight",
                beforeStacks: before,
                afterStacks: this.insightStacks
            });
        }

        consumeInsight() {
            const stacks = this.insightStacks;
            if (stacks <= 0) return { multiplier: 1, stacks: 0, bonus: 0 };
            const bonus = stacks * this.insightBonusPerStack;
            this.insightStacks = 0;
            return { multiplier: 1 + bonus, stacks, bonus };
        }

        tryTriggerBurnheart(triggerMechanic) {
            const stone = this.craftStone;
            if (!stone || !this.isBlazingSkyfireSpiritActive()) return;
            const params = stone.params || {};
            if (!params.burnheartChance || !params.burnheartDamage) return;
            if (this.random() >= params.burnheartChance) return;
            this.addDamage(params.burnheartDamage, stone.id, "craft_burnheart");
            this.countMechanic(`burnheart_from_${triggerMechanic}`);
            this.addLog("craft", stone.selectedVariantId || stone.id, `焚心触发（来源：${getMechanicLabel(triggerMechanic)}）`, {
                mechanic: triggerMechanic,
                proc: "burnheart"
            });
            if (params.insightStacksOnBurnheart) {
                this.grantInsight(params.insightStacksOnBurnheart, stone.selectedVariantId || stone.id);
            }
        }

        initializeMachineStoneState() {
            this.machineStones.forEach(stone => {
                stone.nextAt = stone.id === "flame-body"
                    ? (stone.params.interval || 15)
                    : 0;
                stone.nextTriggerAt = 0;
                stone.counter = 0;
                stone.pendingCharges = 0;
                stone.activated = false;
                if (stone.id === "frost-surge" && stone.rank >= 3) {
                    this.effects.ice.amplifyDamageBonus += stone.params.iceAmplifyBonusAtRank3 || 0;
                }
                if (stone.id === "frost-surge" && stone.rank >= 5) {
                    this.effects.ice.freezeMeterBonus += stone.params.freezeMeterAtRank5 || 0;
                }
                if (stone.id === "rotten-gale" && stone.rank >= 3) {
                    this.effects.wood.amplifyDamageBonus += stone.params.amplifyBonusAtRank3 || 0;
                }
                if (stone.id === "fireburst" && stone.rank >= 3) {
                    this.effects.fire.amplifyDamageBonus += stone.params.amplifyBonusAtRank3 || 0;
                }
                // 霜刺寒雨 3/5 抬高的是凝冰霜华本体伤害，作为常驻加成生效。
                if (stone.id === "frost-rain" && stone.rank >= 3) {
                    this.effects.ice.craftStoneDamageBonus += stone.params.craftBonusAtRank3 || 0;
                }
                if (stone.id === "frost-rain" && stone.rank >= 5) {
                    this.insightBonusPerStack = stone.params.insightBonusPerStack || 0;
                }
            });
            if (this.craftStone) {
                this.craftStone.nextCastAt = 0;
                this.craftStone.openingPrecastSeconds = this.getOpeningCraftPrecastSeconds(this.craftStone);
                this.warnings.push(...(this.craftStone.notes || []));
                if (this.isBlazingSkyfireSpiritActive(3)) {
                    this.insightBonusPerStack = this.craftStone.params.insightBonusPerStack || 0;
                    this.grantInsight(this.craftStone.params.openingInsightStacks || 0, this.craftStone.selectedVariantId || this.craftStone.id);
                }
            }
        }

        getOpeningCraftPrecastSeconds(stone) {
            if (!stone) return 0;
            const requested = Math.max(0, Number(OPENING_PRECAST_SECONDS_BY_CRAFT[stone.id]) || 0);
            if (requested <= 0) return 0;
            const firstImpactDelay = stone.id === "verdant-life"
                ? (stone.params.attackInterval || 2.5)
                : (stone.castTime || 0);
            return Math.min(requested, Math.max(0, firstImpactDelay));
        }

        shouldDelayVerdantLifeCast() {
            const stone = this.craftStone;
            if (!stone || stone.id !== "verdant-life") return false;
            const woodSpirit = this.machineStoneMap.get("wood-spirit");
            const rottenGale = this.machineStoneMap.get("rotten-gale");
            if (!woodSpirit || !rottenGale || rottenGale.rank < 5) return false;
            const woodAmplifyActive = Boolean(this.woodAmplifyState && this.time <= this.woodAmplifyState.activeUntilAt + 1e-9);
            const woodAmplifyPending = (this.pendingAmplifyCounts.wood || 0) > 0;
            return woodAmplifyActive || woodAmplifyPending;
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

        // 记录一条模拟日志。kind 用于前端分类过滤，tags 支持一条日志归入多个筛选，
        // detail 保留结构化字段。
        addLog(kind, sourceId, message, detail = null, tags = null) {
            if (!this.logEnabled) return;
            if (this.log.length >= this.logLimit) {
                this.logTruncated = true;
                return;
            }
            this.log.push({
                time: Number(this.time.toFixed(1)),
                kind,
                tags: tags && tags.length ? tags.slice() : null,
                sourceId: sourceId || null,
                name: this.resolveSourceName(sourceId),
                message,
                detail
            });
        }

        // 把卡牌/机巧石/匠心石 id 解析成展示名。
        resolveSourceName(sourceId) {
            if (!sourceId) return "";
            const card = this.getCard(sourceId);
            if (card) return card.name;
            const def = Data.getCardDefById(sourceId)
                || Data.getMachineStoneDefById(sourceId)
                || Data.getCraftStoneDefById(sourceId)
                || Data.CRAFT_STONE_DEFS.find(stone => stone.baseStoneId === sourceId);
            if (def) return def.name;
            return AMPLIFY_SOURCE_LABELS[sourceId] || sourceId;
        }

        // 统一累计总伤、分卡伤害和机制伤害。
        // countAsTrigger 传 false 时只累加伤害不计次，用于一次触发拆成多笔归属的场景。
        addDamage(amount, cardId, mechanic, countAsTrigger = true, applyLinyinMultiplier = true, customMessage = null) {
            const multiplier = applyLinyinMultiplier ? this.getLinyinMultiplier() : 1;
            const dmg = Math.max(0, amount || 0) * multiplier;
            if (dmg <= 0) return;
            const machineStone = this.machineStoneMap ? this.machineStoneMap.get(cardId) : null;
            if (machineStone) machineStone.activated = true;
            const displaySourceId = this.craftStone && cardId === this.craftStone.id && this.craftStone.selectedVariantId
                ? this.craftStone.selectedVariantId
                : cardId;
            this.totalDamage += dmg;
            this.breakdown.byCard[displaySourceId] = (this.breakdown.byCard[displaySourceId] || 0) + dmg;
            this.breakdown.byMechanic[mechanic] = (this.breakdown.byMechanic[mechanic] || 0) + dmg;
            if (countAsTrigger) {
                this.breakdown.byMechanicCount[mechanic] = (this.breakdown.byMechanicCount[mechanic] || 0) + 1;
            }
            const mechanicLabel = getMechanicLabel(mechanic);
            const sourceName = this.resolveSourceName(displaySourceId);
            const message = typeof customMessage === "function"
                ? customMessage(Math.round(dmg), sourceName, mechanicLabel)
                : (customMessage || (sourceName === mechanicLabel
                    ? `造成 ${Math.round(dmg)} 伤害`
                    : `${mechanicLabel} 造成 ${Math.round(dmg)} 伤害`));
            this.addLog("damage", displaySourceId, message, {
                cardId,
                displaySourceId,
                mechanic,
                mechanicLabel,
                damage: Math.round(dmg)
            });
        }

        // 仅记录触发次数，不计入伤害，用于展示层数/刷新等状态统计。
        countMechanic(mechanic, amount = 1) {
            this.breakdown.byMechanicCount[mechanic] = (this.breakdown.byMechanicCount[mechanic] || 0) + amount;
        }

        // 全局灵蕴增伤乘区。所有 addDamage 都会乘上它，因此「所有丹青伤害提高 X%」
        // 这类效果都应挂在这里，而不是给某一发伤害单独补一笔。
        getLinyinMultiplier() {
            let multiplier = 1;
            const blazingLand = this.machineStoneMap ? this.machineStoneMap.get("blazing-land") : null;
            if (blazingLand && blazingLand.linyinExpiresAt && this.time <= blazingLand.linyinExpiresAt) {
                multiplier *= 1 + (blazingLand.params.linyinBonus || 0);
            }
            if (this.isBlazingSkyfireTrueformActive(3)) {
                const stone = this.craftStone;
                if (stone && stone.trueformLinyinExpiresAt && this.time <= stone.trueformLinyinExpiresAt + 1e-9) {
                    multiplier *= 1 + (stone.params.linyinBonus || 0);
                }
            }
            if (this.isThunderAegisTrueformActive(1)) {
                const stone = this.craftStone;
                if (stone && stone.thunderLinyinExpiresAt && this.time <= stone.thunderLinyinExpiresAt + 1e-9) {
                    multiplier *= 1 + (stone.params.thunderLinyinBonus || 0);
                }
            }
            // 天雷护佑 5/5：持续期间所有丹青伤害提高 70%。
            const thunderGuard = this.machineStoneMap ? this.machineStoneMap.get("thunder-guard") : null;
            if (thunderGuard && thunderGuard.rank >= 5
                && thunderGuard.guardExpiresAt
                && this.time <= thunderGuard.guardExpiresAt + 1e-9) {
                multiplier *= 1 + (thunderGuard.params.allLinyinBonus || 0);
            }
            return multiplier;
        }

        // 累加元素计量；达到阈值时把激化效果排到下一拍执行。
        addMeter(element, amount, sourceId = null) {
            if (!amount) return;
            let adjustedAmount = amount;
            if (element === "ice" && this.isFrostGloryTrueformActive(3)) {
                const expiresAt = this.craftStone?.meterBuffExpiresAt || 0;
                if (this.time <= expiresAt + 1e-9) {
                    adjustedAmount *= 1 + (this.craftStone?.params?.iceMeterBonus || 0);
                }
            }
            if (sourceId && this.craftStone && sourceId === this.craftStone.selectedVariantId) {
                const params = this.craftStone.params || {};
                if (sourceId === "blazing-skyfire-trueform" && element === "fire") adjustedAmount *= 1 + (params.fireMeterBonus || 0);
                if (sourceId === "verdant-life-trueform" && element === "wood") adjustedAmount *= 1 + (params.woodMeterBonus || 0);
            }
            this.meters[element] += adjustedAmount;
            const sourceName = this.resolveSourceName(sourceId);
            const prefix = sourceName ? `${sourceName} ` : "";
            this.addLog("meter", sourceId, `${prefix}${ELEMENT_LABELS[element]}值 +${Math.round(adjustedAmount)}（当前 ${Math.round(this.meters[element])}）`, {
                element,
                amount: Math.round(adjustedAmount),
                total: Math.round(this.meters[element]),
                sourceId: sourceId || null
            });
            const threshold = this.getElementThreshold(element);
            if (!threshold) return;
            while (this.meters[element] >= threshold) {
                this.meters[element] -= threshold;
                this.pendingAmplifyCounts[element] = (this.pendingAmplifyCounts[element] || 0) + 1;
                // 激化效果在下一拍入队，保持与旧实现相同的触发时机。
                this.scheduleEvent(this.time + TICK_SECONDS, () => {
                    this.pendingAmplifyCounts[element] = Math.max(0, (this.pendingAmplifyCounts[element] || 0) - 1);
                    this.amplifyTriggers[element] += 1;
                    this.amplifyTimeline[element].push(Number(this.time.toFixed(1)));
                    this.addLog("amplify", null, `${ELEMENT_LABELS[element]}激化触发（第 ${this.amplifyTriggers[element]} 次）`, {
                        element,
                        index: this.amplifyTriggers[element]
                    });
                    this.triggerAmplify(element);
                });
            }
        }

        // 读取当前元素对应的激化阈值。
        getElementThreshold() {
            return ELEMENT_TRIGGER_THRESHOLD;
        }

        // 主模拟循环：推进时间、执行时间事件、更新目标状态并结算队列。
        simulate() {
            this.runOpeningCraftPrecast();
            while (this.time < this.duration) {
                this.time = Number((this.time + TICK_SECONDS).toFixed(4));
                this.tickCraftStone();
                this.tickCards.forEach(card => {
                    if (card.check(EVENTS.TIME)) {
                        card.trigger(this, EVENTS.TIME);
                    }
                });
                this.tickMachineStones();
                this.updateTargets();
                this.flushQueue();
                this.sampleTimeline();
            }
            return this.finalize();
        }

        runOpeningCraftPrecast() {
            if (!this.craftStone) return;
            if ((this.craftStone.openingPrecastSeconds || 0) <= 0) return;
            this.time = Number((this.time + TICK_SECONDS).toFixed(4));
            this.tickCraftStone();
            this.flushImmediateEvents();
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
            if (this.shouldDelayVerdantLifeCast()) return;
            const stone = this.craftStone;
            const openingPrecast = Math.max(0, Number(stone.openingPrecastSeconds) || 0);
            stone.openingPrecastSeconds = 0;
            const openingPrecastText = openingPrecast > 0 ? `，首轮预读 ${openingPrecast.toFixed(1)}s` : "";
            const insight = this.consumeInsight();
            const stoneLogName = stone.name || this.resolveSourceName(stone.selectedVariantId || stone.id);
            this.addLog("craft", stone.selectedVariantId || stone.id, insight.stacks > 0
                ? `${stoneLogName} 开始施法（${stone.castTime}s）${openingPrecastText}，消耗 ${insight.stacks} 层洞察，本次伤害提高 ${Math.round(insight.bonus * 100)}%`
                : `${stoneLogName} 开始施法（${stone.castTime}s）${openingPrecastText}`, {
                stoneId: stone.id,
                selectedVariantId: stone.selectedVariantId || stone.id,
                castTime: stone.castTime,
                openingPrecastSeconds: openingPrecast,
                insightStacks: insight.stacks,
                insightBonus: insight.bonus
            });
            this.emit(EVENTS.CRAFT_STONE_CAST_START, { stoneId: stone.id });
            this.dispatchMachineStones(EVENTS.CRAFT_STONE_CAST_START, { stoneId: stone.id });
            if (stone.id === "frost-glory" && this.isFrostGlorySpiritActive(1)) {
                this.grantFrostCrystalSpikeCharges(
                    stone.params.openingFrostCrystalCharges || 0,
                    stone.selectedVariantId || stone.id
                );
            }
            const castEndAt = this.time + Math.max(0, stone.castTime - openingPrecast);
            if (castEndAt <= this.duration) {
                if (stone.id === "frost-glory") {
                    if (this.isFrostGloryTrueformActive(3)) {
                        stone.meterBuffExpiresAt = this.time + (stone.params.meterBuffDuration || 60);
                        this.addLog("buff", stone.selectedVariantId || stone.id, `灵韵值累加效率提高 ${Math.round((stone.params.iceMeterBonus || 0) * 100)}%，持续 ${stone.params.meterBuffDuration || 60}s`, {
                            buff: "ice_meter_bonus",
                            bonus: stone.params.iceMeterBonus || 0,
                            expireAt: Number(stone.meterBuffExpiresAt.toFixed(1))
                        });
                    }
                    const tickCount = Math.max(1, Math.round(stone.castTime));
                    const bonus = this.isFrostGlorySpiritActive(2) ? (stone.params.frostCrystalDamageBonus || 0) : 0;
                    const perTick = stone.params.damage * (1 + bonus) / tickCount;
                    for (let i = 1; i <= tickCount; i += 1) {
                        this.scheduleEvent(this.time + i, () => {
                            this.addDamage(perTick * this.targetCount * insight.multiplier, stone.id, "craft_stone");
                            this.consumeColdTideCharge();
                            this.consumeFrostCrystalSpikeCharge(stone.id);
                        });
                    }
                    this.scheduleEvent(castEndAt, () => {
                        this.notifyCraftStoneCastEnd({ stoneId: stone.id });
                    });
                } else if (stone.id === "verdant-life") {
                    this.scheduleEvent(castEndAt, () => {
                        this.notifyCraftStoneCastEnd({ stoneId: stone.id });
                        this.summonVerdantGiant(stone, insight.multiplier);
                        if (this.isVerdantLifeTrueformActive(3)) {
                            for (let i = 0; i < (stone.params.openingWoodDiceTriggers || 0); i += 1) this.handleWoodDice();
                        }
                    });
                    stone.nextCastAt += stone.cooldown - openingPrecast;
                    return;
                } else if (stone.id === "blazing-skyfire") {
                    const segmentCount = 6;
                    const spiritBonus = this.isBlazingSkyfireSpiritActive(2) ? (stone.params.spiritCraftDamageBonus || 0) : 0;
                    const perSegmentDamage = stone.params.damage * (1 + spiritBonus) / segmentCount;
                    const flameBody = this.machineStoneMap.get("flame-body");
                    for (let i = 0; i < segmentCount; i += 1) {
                        const delay = segmentCount === 1 ? 0 : (stone.castTime * i / (segmentCount - 1));
                        this.scheduleEvent(this.time + delay, () => {
                            this.addDamage(perSegmentDamage * this.targetCount * insight.multiplier, stone.id, "craft_stone");
                            if (this.isBlazingSkyfireTrueformActive()) {
                                this.addMeter("fire", (stone.params.fireMeterPerSegment || 0) * this.targetCount, stone.selectedVariantId || stone.id);
                            }
                            if (flameBody && flameBody.rank >= 5) {
                                this.triggerFlameBody(flameBody, 2, "machine_flame_body");
                            }
                        });
                    }
                    this.scheduleEvent(castEndAt, () => {
                        this.notifyCraftStoneCastEnd({ stoneId: stone.id });
                    });
                } else if (stone.id === "thunder-aegis") {
                    if (this.isThunderAegisSpiritActive(3)) {
                        this.thunderAegisExtraCastExpiresAt = Math.max(
                            this.thunderAegisExtraCastExpiresAt,
                            this.time + (stone.params.chainDuration || 10)
                        );
                    }
                    const spiritBonus = this.isThunderAegisSpiritActive(2) ? (stone.params.craftDamageBonus || 0) : 0;
                    const baseDamage = stone.params.damage * (1 + spiritBonus);
                    this.scheduleEvent(castEndAt, () => {
                        this.notifyCraftStoneCastEnd({ stoneId: stone.id });
                        this.addDamage(baseDamage * this.targetCount * insight.multiplier, stone.id, "craft_stone");
                        this.scheduleThunderAegisChains(stone, insight.multiplier);
                    });
                } else {
                    this.scheduleEvent(castEndAt, () => {
                        this.notifyCraftStoneCastEnd({ stoneId: stone.id });
                        this.addDamage(stone.params.damage * this.targetCount * insight.multiplier, stone.id, "craft_stone");
                    });
                }
            }
            stone.nextCastAt += stone.cooldown - openingPrecast;
        }

        // 授予洞察层数。洞察没有持续时间，只等下一次灵蕴技消耗。
        grantInsight(stacks, sourceId) {
            if (stacks <= 0) return;
            const before = this.insightStacks;
            this.insightStacks += stacks;
            this.addLog("buff", sourceId, `洞察 ${before} → ${this.insightStacks} 层`, {
                buff: "insight",
                beforeStacks: before,
                afterStacks: this.insightStacks
            });
        }

        // 消耗全部洞察，返回 { multiplier, stacks, bonus }。
        // 不自己写日志，由调用方并进灵蕴技的释放日志，避免同一时刻出现两条。
        consumeInsight() {
            const stacks = this.insightStacks;
            if (stacks <= 0) return { multiplier: 1, stacks: 0, bonus: 0 };
            const bonus = stacks * this.insightBonusPerStack;
            this.insightStacks = 0;
            return { multiplier: 1 + bonus, stacks, bonus };
        }

        scheduleThunderAegisChains(stone, insightMultiplier = 1) {
            const duration = stone.params.chainDuration || 10;
            const interval = stone.params.chainInterval || 2;
            const sourceCard = this.getCard(CARD_IDS.THUNDER_BANNER) || {
                id: stone.id,
                params: { chainDamage: 9660, maxEnemyTargets: 3 }
            };
            for (let delay = interval; delay <= duration + 1e-9; delay += interval) {
                this.scheduleEvent(this.time + delay, () => {
                    // 雷佑灵光的连锁闪电仍累积神雷值并触发紫电螭吻，但不触发静电过载。
                    this.triggerChainLightning(sourceCard, insightMultiplier, { skipStaticOverload: true });
                });
            }
        }

        triggerExtraThunderSpear(sourceCard, efficiency = 1) {
            const spear = this.machineStoneMap.get("thunder-spear");
            if (!spear) return;
            const targetsHit = Math.min(this.targetCount, sourceCard.params.maxEnemyTargets || 3);
            const hits = spear.rank >= 5 ? 1 + (spear.params.extraAtRank5 || 0) : 1;
            const amount = (spear.params.damage || 0) * targetsHit * efficiency;
            for (let i = 0; i < hits; i += 1) {
                this.addDamage(amount, spear.id, "machine_chain");
            }
            this.triggerThunderSpearDot(spear, hits);
            this.recordThunderAegisSpearHits(hits * targetsHit);
        }

        triggerFireMeteor(stone, mechanic) {
            const params = stone.params;
            this.addDamage((params.damage || 0) * this.targetCount, stone.id, mechanic);
            this.addMeter("fire", params.meter || 0, stone.id);
            if (stone.rank >= 3 && params.burnDamage) {
                this.targets.forEach((target, targetIndex) => {
                    const beforeStacks = target.fireMeteor.prune(this.time);
                    const afterStacks = target.fireMeteor.apply(this.time, params.burnDuration || FIRE_METEOR_DURATION);
                    if (beforeStacks === 0) {
                        this.countMechanic("machine_fire_meteor_apply");
                    } else if (afterStacks > beforeStacks) {
                        this.countMechanic("machine_fire_meteor_stack");
                    } else {
                        this.countMechanic("machine_fire_meteor_refresh");
                    }
                    if (targetIndex === 0) {
                        this.countMechanic("machine_fire_meteor_stacks", afterStacks);
                        this.addLog("buff", stone.id, `目标 1 天火陨星持续效果 ${beforeStacks} → ${afterStacks} 层`, {
                            buff: "fire_meteor",
                            targetIndex,
                            beforeStacks,
                            afterStacks
                        });
                    }
                });
            }
        }

        triggerFlameBody(stone, stacks, mechanic) {
            const params = stone.params;
            const duration = params.duration || FLAME_BODY_DURATION;
            const targetsHit = Math.min(3, this.targetCount);
            for (let targetIndex = 0; targetIndex < targetsHit; targetIndex += 1) {
                const target = this.targets[targetIndex];
                if (!target) continue;
                const beforeStacks = target.flameBody.prune(this.time);
                let afterStacks = beforeStacks;
                for (let stack = 0; stack < stacks; stack += 1) {
                    afterStacks = target.flameBody.apply(this.time, duration, 1, mechanic);
                }
                if (targetIndex === 0) {
                    this.addLog("buff", stone.id, `目标 1 烈焰焚身 ${beforeStacks} → ${afterStacks} 层`, {
                        buff: "flame_body",
                        targetIndex,
                        beforeStacks,
                        afterStacks,
                        mechanic
                    });
                }
            }
        }

        triggerPaperForest(stone) {
            const params = stone.params;
            const hasStorm = stone.rank >= 3;
            const attackInterval = params.attackInterval || 2;
            const baseDuration = 10;
            const durationMultiplier = this.getWoodSummonDurationMultiplier();
            const baseAttackCount = hasStorm ? (params.upgradedAttacks || 3) : (params.attacks || 6);
            const attackCount = baseAttackCount + Math.floor(baseDuration * (durationMultiplier - 1) / attackInterval);
            const stormDuration = params.stormDuration || 4;
            this.woodSummonExpiresAt.paper = Math.max(this.woodSummonExpiresAt.paper, this.time + baseDuration * durationMultiplier);
            // 3/5 起：前 4 秒被纸人风暴占满，本体普攻改在剩余 6 秒里进行。
            const attackStartAt = hasStorm ? stormDuration : 0;
            const attackDelay = index => (hasStorm
                ? attackStartAt + attackInterval * (index + 1)
                : attackInterval * index);
            for (let i = 0; i < attackCount; i += 1) {
                this.scheduleEvent(this.time + attackDelay(i), () => {
                    this.addDamage((params.damage || 0) * this.targetCount, stone.id, "machine_paper_forest");
                    // 5/5 的苍木值只由苍林箭和纸人风暴提供，本体普攻不加。
                    this.applyEarthRiftFollowup();
                });
            }
            if (hasStorm) {
                const stormInterval = stormDuration / ((params.stormHits || 11) - 1);
                for (let i = 0; i < (params.stormHits || 11); i += 1) {
                    this.scheduleEvent(this.time + i * stormInterval, () => {
                        this.addDamage((params.stormDamage || 4513) * this.targetCount, stone.id, "machine_paper_storm");
                        if (stone.rank >= 5) this.addMeter("wood", 80 * this.targetCount);
                        this.applyEarthRiftFollowup();
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
                const frenzyEfficiency = (params.frenzyEfficiency || 0.8)
                    * (hasPurpleDragon ? this.effects.thunder.frenzyEfficiency : 1);
                for (let i = 0; i < chainCount; i += 1) {
                    this.triggerChainLightning(thunderBanner, frenzyEfficiency, {
                        skipPurpleDragonExtra: true,
                        skipStaticOverload: true
                    });
                }
            }
        }

        triggerWoodSpirit(stone, count) {
            const params = stone.params;
            const attackInterval = params.attackInterval || 2;
            const baseDuration = params.duration || 30;
            const durationMultiplier = this.getWoodSummonDurationMultiplier();
            const attackCount = Math.ceil((params.attacks || 14) * durationMultiplier);
            this.woodSummonExpiresAt.spirit = Math.max(this.woodSummonExpiresAt.spirit, this.time + baseDuration * durationMultiplier);
            for (let summon = 0; summon < count; summon += 1) {
                for (let i = 1; i <= attackCount; i += 1) {
                    this.scheduleEvent(this.time + i * attackInterval, () => {
                        this.addDamage((params.damage || 0) * this.targetCount, stone.id, "machine_wood_spirit");
                        if (stone.rank >= 3 && this.craftStone && this.craftStone.id === "verdant-life") {
                            this.craftStone.nextCastAt = Math.max(this.time, this.craftStone.nextCastAt - 1);
                        }
                        this.applyEarthRiftFollowup();
                    });
                }
            }
        }

        countActiveWoodSummonTypes() {
            return Object.values(this.woodSummonExpiresAt)
                .filter(expiresAt => this.time <= expiresAt + 1e-9)
                .length;
        }

        getWoodSummonDurationMultiplier() {
            return this.isVerdantLifeSpiritActive(1)
                ? 1 + (this.craftStone?.params?.summonDurationBonus || 0)
                : 1;
        }

        getEarthRiftEchoMultiplier() {
            if (!this.isVerdantLifeSpiritActive(3)) return 1;
            return 1 + (this.craftStone?.params?.earthRiftEchoBonus || 0) * this.countActiveWoodSummonTypes();
        }

        getVerdantGiantSkillMultiplier() {
            return this.isVerdantLifeSpiritActive(2)
                ? 1 + (this.craftStone?.params?.summonDamageBonus || 0)
                : 1;
        }

        summonVerdantGiant(stone, insightMultiplier = 1) {
            const interval = stone.params.attackInterval || 2.5;
            const hasEarthRift = this.machineStoneMap.has("earth-rift");
            let attackCount = hasEarthRift
                ? Math.max(0, (stone.params.attacks || 6) - 1)
                : (stone.params.attacks || 6);
            const attackStartIndex = hasEarthRift ? 2 : 1;
            const giantDuration = (stone.params.duration || 20) * this.getWoodSummonDurationMultiplier();
            attackCount = Math.ceil(attackCount * this.getWoodSummonDurationMultiplier());
            this.woodSummonExpiresAt.giant = Math.max(this.woodSummonExpiresAt.giant, this.time + giantDuration);
            this.notifyWoodGiantSummoned({ stoneId: stone.id });
            this.scheduleEvent(this.time + interval, () => {
                this.addDamage((stone.params.damage || 0) * this.getVerdantGiantSkillMultiplier() * this.targetCount * insightMultiplier, stone.id, "craft_stone");
                if (this.isVerdantLifeTrueformActive(3)) this.handleWoodDice();
                this.applyEarthRiftFollowup();
            });
            for (let i = 0; i < attackCount; i += 1) {
                const delay = interval * (attackStartIndex + i + 1);
                this.scheduleEvent(this.time + delay, () => {
                    this.addDamage((stone.params.attackDamage || 0) * this.getVerdantGiantSkillMultiplier() * this.targetCount * insightMultiplier, stone.id, "craft_stone_attack");
                    this.applyEarthRiftFollowup();
                });
            }
        }

        triggerEarthRift(stone) {
            const params = stone.params;
            this.addDamage((params.damage || 0) * this.getVerdantGiantSkillMultiplier() * this.targetCount, stone.id, "machine_earth_rift");
            if (stone.rank >= 3) {
                const duration = (params.echoDuration || 30) + (this.isVerdantLifeSpiritActive(3) ? 5 : 0);
                // 记录回响的到期时刻，供 5/5 的回响追击判断前置条件。
                this.targets.forEach(target => {
                    target.earthRiftEchoExpireAt = this.time + duration;
                });
                this.addLog("buff", stone.id, `目标附加裂地崩·回响，持续 ${duration}s`, {
                    buff: "earth_rift_echo",
                    expireAt: Number((this.time + duration).toFixed(1))
                });
                for (let delay = 1; delay <= duration; delay += 1) {
                    this.scheduleEvent(this.time + delay, () => {
                        this.addDamage((params.echoDamage || 0) * this.getEarthRiftEchoMultiplier() * this.targetCount, stone.id, "machine_earth_rift_echo");
                    });
                }
            }
        }

        // 裂地崩 5/5：小纸人 / 木引青灵 / 苍木树人攻击「带有回响的敌方」时立即触发一次回响。
        // 前置条件必须校验：回响不在目标身上时不触发，否则从 0s 起就会凭空追击。
        applyEarthRiftFollowup() {
            const earthRift = this.machineStoneMap.get("earth-rift");
            if (!earthRift || earthRift.rank < 5) return;
            const target = this.targets[0];
            if (!target || this.time > target.earthRiftEchoExpireAt) return;
            this.addDamage((earthRift.params.echoDamage || 0) * this.getEarthRiftEchoMultiplier() * this.targetCount, earthRift.id, "machine_earth_rift_echo_followup");
        }

        handleWoodDice() {
            const stone = this.machineStoneMap.get("wood-dice");
            if (!stone) return;
            stone.counter = (stone.counter || 0) + 1;
            const threshold = stone.params.pulseThreshold || 6;
            if (stone.counter < threshold) return;
            stone.activated = true;
            stone.counter = 0;
            const maxStacks = stone.rank >= 3 ? 6 : 3;
            const rolled = 1 + Math.floor(this.random() * maxStacks);
            const beforeStacks = this.effects.wood.luckStacks;
            this.effects.wood.luckStacks += rolled;
            this.addLog("buff", stone.id, `六六大顺摇出 ${rolled} 层（${beforeStacks} → ${this.effects.wood.luckStacks}）`, {
                buff: "wood_dice_luck",
                rolled,
                beforeStacks,
                afterStacks: this.effects.wood.luckStacks
            });
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
            const beforeStacks = this.effects.wood.luckStacks;
            this.effects.wood.luckStacks -= 1;
            this.addLog("buff", stone.id, `消耗1层六六大顺（${beforeStacks} → ${this.effects.wood.luckStacks}）`, {
                buff: "wood_dice_luck_consume",
                consumed: 1,
                beforeStacks,
                afterStacks: this.effects.wood.luckStacks
            });
            return damage * (1 + (stone.params.damageBonus || 0));
        }

        triggerNineSkyThunder(stone) {
            const params = stone.params;
            const bolts = (params.bolts || 2) + (stone.rank >= 3 ? 1 : 0) + (stone.rank >= 5 ? 1 : 0);
            this.addDamage((params.damage || 0) * bolts * this.targetCount, stone.id, "machine_nine_sky_thunder");
            if (stone.rank >= 3) {
                // 3/5 的神雷值按每道雷电 +100 结算，本真 3 再提高 100% 累积效率。
                this.addMeter("thunder", 100 * bolts * this.getThunderMeterEfficiency(), stone.id);
            }
            if (stone.rank >= 5 && this.targetCount > 1) {
                this.addDamage((params.damage || 0) * bolts * (this.targetCount - 1), stone.id, "machine_nine_sky_thunder_copy");
            }
        }

        triggerThunderSpearDot(stone, hits) {
            if (stone.rank < 3) return;
            if (!this.thunderSpearState) {
                this.thunderSpearState = new StackBuff(0, THUNDER_SPEAR_DURATION, THUNDER_SPEAR_TICK_INTERVAL);
        this.frostCrystalSpikeArrowCount = 0;
            }
            for (let hit = 0; hit < hits; hit += 1) {
                this.thunderSpearState.apply(this.time, THUNDER_SPEAR_DURATION, 1, stone.id);
            }
        }

        getThunderMeterEfficiency() {
            return this.isThunderAegisTrueformActive(3)
                ? 1 + (this.craftStone?.params?.thunderMeterPerHitBonus || 0)
                : 1;
        }

        recordThunderAegisSpearHits(hits) {
            if (!this.isThunderAegisSpiritActive(1) || hits <= 0) return;
            const params = this.craftStone?.params || {};
            const threshold = params.thunderStormHitThreshold || 50;
            this.thunderAegisSpearHitCount += hits;
            while (this.thunderAegisSpearHitCount >= threshold) {
                this.thunderAegisSpearHitCount -= threshold;
                this.addDamage((params.thunderStormDamage || 0), this.craftStone.id, "craft_thunder_storm");
            }
        }

        settleThunderShock(stone, generation, reason = "expire") {
            const state = this.thunderShockState;
            if (!state || !state.active || state.generation !== generation) return;
            state.active = false;
            if (stone.rank < 5) return;
            const params = stone.params;
            this.addDamage((params.burstDamage || 0) * this.targetCount, stone.id, "machine_thunder_shock_burst");
            this.addMeter("thunder", 500 * this.targetCount * this.getThunderMeterEfficiency(), stone.id);
            this.addLog("event", stone.id, reason === "refresh"
                ? "神雷激化再次触发：旧静电震击提前结束并立即爆炸"
                : "静电震击结束并发生爆炸", {
                event: "thunder_shock_end",
                reason,
                generation
            });
        }

        triggerThunderShock(stone) {
            const params = stone.params;
            // 再次触发神雷激化时，旧静电震击先结束；5/5 立即结算结束爆炸。
            if (this.thunderShockState?.active) {
                this.settleThunderShock(stone, this.thunderShockState.generation, "refresh");
            }
            // 静电震击寄生在神雷激化上；刷新后重新开始完整持续时间。
            const duration = params.duration || 30;
            const interval = stone.rank >= 3 ? 0.5 : (params.interval || 1);
            const generation = ++this.thunderShockGeneration;
            this.thunderShockState = {
                active: true,
                generation,
                startedAt: this.time,
                expiresAt: this.time + duration
            };
            // 1/5 就打「目标 + 周围 1 名」，3/5 再额外命中 1 名。
            const targets = Math.min(this.targetCount, stone.rank >= 3 ? 3 : 2);
            for (let delay = interval; delay <= duration + 1e-9; delay += interval) {
                this.scheduleEvent(this.time + delay, () => {
                    if (!this.thunderShockState?.active
                        || this.thunderShockState.generation !== generation) return;
                    this.addDamage((params.damage || 0) * targets, stone.id, "machine_thunder_shock");
                });
            }
            this.scheduleEvent(this.time + duration, () => {
                this.settleThunderShock(stone, generation, "expire");
            });
        }

        scheduleThunderAmplifyTicks() {
            const shock = this.machineStoneMap.get("thunder-shock");
            if (shock) this.triggerThunderShock(shock);
            const thunder = this.machineStoneMap.get("nine-sky-thunder");
            if (thunder) this.triggerNineSkyThunder(thunder);
        }

        getFrostCrystalSpikeStone() {
            const equipped = this.machineStoneMap.get("frost-crystal-spike");
            if (equipped) return equipped;
            if (!this.isFrostGlorySpiritActive(1)) return null;
            if (!this.syntheticFrostCrystalSpikeStone) {
                const def = Data.getMachineStoneDefById("frost-crystal-spike");
                if (!def) return null;
                this.syntheticFrostCrystalSpikeStone = {
                    ...def,
                    rank: 1,
                    params: Data.resolveMachineStoneParams(def, 1),
                    synthetic: true
                };
            }
            return this.syntheticFrostCrystalSpikeStone;
        }

        triggerFrostCrystalSpike(stone, beforeCharges = null, afterCharges = null) {
            const params = stone.params;
            const spikes = params.spikeCount || 3;
            const bonus = this.isFrostGlorySpiritActive(2)
                ? (this.craftStone?.params?.frostCrystalDamageBonus || 0)
                : 0;
            const settleSpike = (index) => {
                const customMessage = beforeCharges !== null && afterCharges !== null
                    ? (damage) => `寒晶刺第 ${index + 1}/${spikes} 枚造成 ${damage} 伤害（${beforeCharges} → ${afterCharges}）`
                    : null;
                this.addDamage((params.damage || 0) * (1 + bonus), stone.id, "machine_frost_crystal_spike", true, true, customMessage);
                if (this.isFrostGlorySpiritActive(3) && this.craftStone) {
                    const cooldownReduction = this.craftStone.params?.cooldownReductionPerHit || 0;
                    if (cooldownReduction > 0) {
                        this.craftStone.nextCastAt = Math.max(this.time, this.craftStone.nextCastAt - cooldownReduction);
                    }
                }
                if (stone.rank >= 3) {
                    const shatterDamage = this.getIceShatterDamage();
                    if (shatterDamage > 0) {
                        this.addDamage(shatterDamage * this.targetCount, stone.id, "machine_frost_crystal_shatter");
                    }
                    this.notifyShatter();
                }
            };
            for (let index = 0; index < spikes; index += 1) {
                if (index === 0) {
                    settleSpike(index);
                } else {
                    const triggerAt = Number((this.time + TICK_SECONDS * index).toFixed(4));
                    this.scheduleEvent(triggerAt, () => settleSpike(index));
                }
            }
        }

        grantFrostCrystalSpikeCharges(count, sourceId = null) {
            const stone = this.getFrostCrystalSpikeStone();
            if (!stone || count <= 0) return;
            stone.pendingCharges = (stone.pendingCharges || 0) + count;
            if (sourceId) {
                this.addLog("event", sourceId, `${this.resolveSourceName(sourceId)} 获得 ${count} 层寒晶刺`, {
                    sourceId,
                    added: count,
                    pendingCharges: stone.pendingCharges
                });
            }
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

        handleMachineIceArrow(count, sourceId = null) {
            const stone = this.getFrostCrystalSpikeStone();
            if (!stone) return;
            this.frostCrystalSpikeArrowCount = (this.frostCrystalSpikeArrowCount || 0) + count;
            while (this.frostCrystalSpikeArrowCount >= (stone.params.arrowThreshold || 10)) {
                this.frostCrystalSpikeArrowCount -= stone.params.arrowThreshold || 10;
                this.grantFrostCrystalSpikeCharges(1, sourceId);
            }
        }

        consumeFrostCrystalSpikeCharge(triggerSource = null) {
            const stone = this.getFrostCrystalSpikeStone();
            if (!stone || !stone.pendingCharges) return;
            const before = stone.pendingCharges;
            stone.pendingCharges -= 1;
            this.addLog("craft", triggerSource || stone.id, `消耗 1 层寒晶刺效果（${before} → ${stone.pendingCharges}）`, {
                buff: "frost_crystal_spike_consume",
                beforeCharges: before,
                afterCharges: stone.pendingCharges,
                triggerSource: triggerSource || null
            });
            this.scheduleEvent(this.time + TICK_SECONDS, () => this.triggerFrostCrystalSpike(stone, before, stone.pendingCharges));
        }

        triggerScarletRing(stone) {
            const params = stone.params;
            const hits = stone.rank >= 3 ? 1 + (params.extraTicksAtRank3 || 1) : 1;
            for (let i = 0; i < hits; i += 1) {
                this.addDamage((params.damage || 0) * this.targetCount, stone.id, "machine_fire_tick");
                this.tryTriggerBurnheart("machine_fire_tick");
                if (this.random() < 0.20) {
                    const scarletAnt = this.getCard(CARD_IDS.SCARLET_ANT);
                    if (scarletAnt) this.applyBurn(0, scarletAnt, 1, true, true);
                }
            }
        }

        scheduleFireAmplifyTicks() {
            const ring = this.machineStoneMap.get("scarlet-ring");
            const speedUp = Boolean(ring && ring.rank >= 5);
            const interval = speedUp ? 1.5 : 2;
            const duration = speedUp ? 12 : 10;
            const activeUntilAt = this.time + duration;
            const config = AMPLIFY_DAMAGE.fire;
            const bonus = 1 + this.effects.fire.amplifyDamageBonus;
            if (!this.fireAmplifyState) {
                this.fireAmplifyState = {
                    interval,
                    activeUntilAt,
                    nextTickAt: this.time + interval,
                    damagePerTick: config.tickDamage * bonus,
                    damageHostId: config.sourceId
                };
                return;
            }
            this.fireAmplifyState.interval = interval;
            this.fireAmplifyState.activeUntilAt = Math.max(this.fireAmplifyState.activeUntilAt, activeUntilAt);
            this.fireAmplifyState.damagePerTick = config.tickDamage * bonus;
            this.fireAmplifyState.damageHostId = config.sourceId;
        }

        scheduleWoodAmplifyTicks() {
            const config = AMPLIFY_DAMAGE.wood;
            const bonus = 1 + this.effects.wood.amplifyDamageBonus;
            const activeUntilAt = this.time + WOOD_AMPLIFY_DURATION;
                const bloomBonus = this.isVerdantLifeTrueformActive(2) ? (this.craftStone?.params?.woodBloomBonus || 0) : 0;
            if (!this.woodAmplifyState) {
                this.woodAmplifyState = {
                    interval: WOOD_AMPLIFY_INTERVAL,
                    bloomEvery: config.bloomEvery,
                    activeUntilAt,
                    nextTickAt: this.time + WOOD_AMPLIFY_INTERVAL,
                    damagePerTick: config.tickDamage * bonus,
                    bloomDamage: config.bloomDamage * bonus * (1 + bloomBonus),
                    damageHostId: config.sourceId,
                    ticksDone: 0
                };
                return;
            }
            this.woodAmplifyState.activeUntilAt = Math.max(this.woodAmplifyState.activeUntilAt, activeUntilAt);
            this.woodAmplifyState.damagePerTick = config.tickDamage * bonus;
            this.woodAmplifyState.bloomDamage = config.bloomDamage * bonus * (1 + bloomBonus);
            this.woodAmplifyState.damageHostId = config.sourceId;
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
                    || (eventType === EVENTS.CRAFT_STONE_CAST_START && stone.id === "blazing-land" && event.stoneId === "blazing-skyfire")
                    || (eventType === EVENTS.CRAFT_STONE_CAST_END && stone.id === "thunder-guard" && event.stoneId === "thunder-aegis")
                    || (eventType === EVENTS.CRAFT_STONE_CAST_END && stone.id === "cold-tide" && event.stoneId === "frost-glory")
                    || (eventType === EVENTS.CRAFT_STONE_CAST_START && stone.id === "frost-shatter" && event.stoneId === "frost-glory")
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
                    const bonus = this.isFrostGloryTrueformActive(2) ? (params.insightBonusPerStack || 0) : 0;
                    this.addDamage((params.damage || 0) * (1 + bonus) * this.targetCount, stone.id, "machine_frost_rain");
                    if (stone.rank >= 5) {
                        this.grantInsight(params.insightStacks || 3, stone.id);
                    }
                    return;
                }
                if (eventType === EVENTS.ICE_ELEMENTAL_SUMMONED && stone.id === "frost-crystal-spike") {
                    if (stone.rank >= 5) this.grantFrostCrystalSpikeCharges(2);
                    return;
                }
                if (eventType === EVENTS.CRAFT_STONE_CAST_END && stone.id === "cold-tide") {
                    if (stone.rank >= 5) this.triggerColdTideCraftWaves(stone);
                    return;
                }
                if (eventType === EVENTS.CRAFT_STONE_CAST_START && stone.id === "frost-shatter") {
                    // 5/5 无视冷却额外召唤一只冰霜元素，凝冰霜华一开始读条就召唤出来。
                    if (stone.rank >= 5) this.summonIceElemental(stone.id);
                    return;
                }
                if (eventType === EVENTS.CRAFT_STONE_CAST_END && stone.id === "rotten-gale") {
                    if (stone.rank >= 5) this.addMeter("wood", 10000 * Math.min(5, this.targetCount), stone.id);
                    return;
                }
                if (eventType === EVENTS.CRAFT_STONE_CAST_END && stone.id === "wood-spirit") {
                    if (stone.rank >= 5) this.triggerWoodSpirit(stone, 2);
                    return;
                }
                if (eventType === EVENTS.COMBUST && stone.id === "flame-body") {
                    if (stone.rank >= 3) this.triggerFlameBody(stone, 2, "machine_flame_body");
                    return;
                }
                if (eventType === EVENTS.ELEMENT_AMPLIFY && event.element === "ice" && stone.id === "frost-surge") {
                    this.addDamage((params.damage || 0) * this.targetCount, stone.id, "machine_ice_amplify");
                    return;
                }
                if (eventType === EVENTS.ELEMENT_AMPLIFY && event.element === "wood" && stone.id === "wood-spirit") {
                    if (this.time < (stone.nextTriggerAt || 0)) return;
                    stone.nextTriggerAt = this.time + (stone.params.internalCooldown || 10);
                    this.triggerWoodSpirit(stone, 1);
                    return;
                }
                if (eventType === EVENTS.ELEMENT_AMPLIFY && event.element === "thunder") {
                    return;
                }
                if (eventType === EVENTS.WOOD_BLOOM && stone.id === "rotten-gale") {
                    const bonus = 1 + this.effects.wood.amplifyDamageBonus;
                    this.addDamage((params.damage || 0) * this.targetCount * bonus, stone.id, "machine_rotten_gale");
                    return;
                }
                if (eventType === EVENTS.CRAFT_STONE_CAST_START && stone.id === "blazing-land") {
                    // 5/5 的灵蕴增伤从灼灼天炎释放瞬间起算，读条 5 秒本身就吃掉窗口的三分之一。
                    if (stone.rank >= 5) {
                        stone.linyinExpiresAt = this.time + (params.linyinDuration || 15);
                        this.addLog("buff", stone.id, `灵蕴伤害提高 ${Math.round((params.linyinBonus || 0) * 100)}%，持续 ${params.linyinDuration || 15}s`, {
                            buff: "linyin_bonus",
                            bonus: params.linyinBonus || 0,
                            expireAt: Number(stone.linyinExpiresAt.toFixed(1))
                        });
                    }
                    return;
                }
                if (eventType === EVENTS.CRAFT_STONE_CAST_START && stone.id === "blazing-skyfire") {
                    if (this.isBlazingSkyfireTrueformActive()) {
                        const craft = this.craftStone;
                        craft.trueformLinyinExpiresAt = this.time + (craft.params.linyinDuration || 8);
                        this.addLog("buff", craft.selectedVariantId || craft.id, `灵蕴伤害提高 ${Math.round((craft.params.linyinBonus || 0) * 100)}%，持续 ${craft.params.linyinDuration || 8}s`, {
                            buff: "trueform_linyin_bonus",
                            bonus: craft.params.linyinBonus || 0,
                            expireAt: Number(craft.trueformLinyinExpiresAt.toFixed(1))
                        });
                    }
                    return;
                }
                if (eventType === EVENTS.CRAFT_STONE_CAST_END && stone.id === "blazing-land") {
                    for (let delay = 1; delay <= (params.duration || 8); delay += (params.interval || 1)) {
                        this.scheduleEvent(this.time + delay, () => {
                            this.addDamage((params.damage || 0) * this.targetCount, stone.id, "machine_blazing_land");
                            this.tryTriggerBurnheart("machine_blazing_land");
                            this.addMeter("fire", 1500 * this.targetCount, stone.id);
                        });
                    }
                    return;
                }
                if (eventType === EVENTS.CRAFT_STONE_CAST_END && stone.id === "earth-rift") {
                    // 树人在冲击波后再读条 2.5 秒才放出裂地崩。
                    const interval = this.craftStone?.params?.attackInterval || 2.5;
                    const delay = interval * 2;
                    this.scheduleEvent(this.time + delay, () => this.triggerEarthRift(stone));
                    return;
                }
                if (eventType === EVENTS.CRAFT_STONE_CAST_END && stone.id === "thunder-guard") {
                    const duration = params.duration || 10;
                    stone.guardExpiresAt = this.time + duration;
                    // 5/5 的「所有丹青伤害 +70%」走 getLinyinMultiplier() 全局乘区，
                    // 这里只记窗口，便于在日志里看出增伤区间。
                    if (stone.rank >= 5) {
                        this.addLog("buff", stone.id, `天雷护佑：所有丹青伤害提高 ${Math.round((params.allLinyinBonus || 0) * 100)}%，持续 ${duration}s`, {
                            buff: "thunder_guard_linyin",
                            bonus: params.allLinyinBonus || 0,
                            expireAt: Number(stone.guardExpiresAt.toFixed(1))
                        });
                    }
                    if (stone.rank >= 3 && this.externalSkillDps > 0) {
                        const perTick = this.externalSkillDps * (params.externalSkillBonus || 0);
                        // 这笔是对外部职业/法宝技能的增伤折算，不属于灵蕴伤害乘区。
                        for (let second = 1; second <= duration; second += 1) {
                            this.scheduleEvent(this.time + second, () => {
                                this.addDamage(perTick, stone.id, "machine_thunder_guard_external", true, false);
                            });
                        }
                    }
                    return;
                }
                if (eventType === EVENTS.CHAIN_LIGHTNING_HIT) {
                    amount *= event.targetsHit || 1;
                    const hits = stone.rank >= 5 ? 1 + (params.extraAtRank5 || 0) : 1;
                    for (let i = 0; i < hits; i++) {
                        this.addDamage(amount, stone.id, "machine_chain");
                    }
                    this.triggerThunderSpearDot(stone, hits);
                    if (stone.id === "thunder-spear") {
                        this.recordThunderAegisSpearHits(hits * (event.targetsHit || 1));
                    }
                    if (stone.id === "thunder-aegis") {
                        return;
                    }
                    return;
                }
                const count = eventType === EVENTS.ELEMENT_AMPLIFY && event.element === "fire" && stone.id === "fireburst" && stone.rank >= 5 ? 2 : 1;
                this.addDamage(amount * this.targetCount * count, stone.id, "machine_link");
            });
        }

        // 处理目标身上的持续状态，如燃烧、爆燃和静电过载。
        updateTargets() {
            this.targets.forEach((target, index) => {
                const meteorStacks = target.fireMeteor.prune(this.time);
                if (meteorStacks > 0
                    && this.time < this.duration
                    && target.fireMeteor.tickAt
                    && this.time >= target.fireMeteor.tickAt
                    && target.fireMeteor.tickAt <= target.fireMeteor.lastExpireAt + 1e-9) {
                    this.queueEvent({ type: "FIRE_METEOR_TICK", targetIndex: index });
                    target.fireMeteor.tickAt += target.fireMeteor.tickInterval;
                }
                const echoStacks = target.woodEcho.prune(this.time);
                if (echoStacks > 0
                    && this.time < this.duration
                    && target.woodEcho.tickAt
                    && this.time >= target.woodEcho.tickAt
                    && target.woodEcho.tickAt <= target.woodEcho.lastExpireAt + 1e-9) {
                    this.queueEvent({ type: "WOOD_ECHO_TICK", targetIndex: index });
                    target.woodEcho.tickAt += target.woodEcho.tickInterval;
                }
                const flameBodyStacks = target.flameBody.prune(this.time);
                if (flameBodyStacks > 0
                    && this.time < this.duration
                    && target.flameBody.tickAt
                    && this.time >= target.flameBody.tickAt
                    && target.flameBody.tickAt <= target.flameBody.lastExpireAt + 1e-9) {
                    this.queueEvent({ type: "FLAME_BODY_TICK", targetIndex: index });
                    target.flameBody.tickAt += target.flameBody.tickInterval;
                }
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
                const overloadStacks = target.staticOverload.prune(this.time);
                if (overloadStacks > 0
                    && target.staticOverload.tickAt
                    && this.time >= target.staticOverload.tickAt
                    && target.staticOverload.tickAt <= target.staticOverload.lastExpireAt + 1e-9) {
                    this.queueEvent({ type: "STATIC_OVERLOAD_TICK", targetIndex: index });
                    target.staticOverload.tickAt += target.staticOverload.tickInterval;
                }
            });
            if (this.fireAmplifyState) {
                while (this.fireAmplifyState.nextTickAt <= this.time + 1e-9
                    && this.fireAmplifyState.nextTickAt <= this.fireAmplifyState.activeUntilAt + 1e-9) {
                    let damagePerTick = this.fireAmplifyState.damagePerTick;
                    if (this.isBlazingSkyfireTrueformActive()) {
                        damagePerTick *= 1 + (this.craftStone?.params?.amplifyDamageBonus || 0);
                    }
                    this.addDamage(damagePerTick, this.fireAmplifyState.damageHostId, "fire_amplify");
                    this.tryTriggerBurnheart("fire_amplify");
                    this.dispatchMachineStones(EVENTS.FIRE_AMPLIFY_TICK, { element: "fire" });
                    this.fireAmplifyState.nextTickAt += this.fireAmplifyState.interval;
                }
                if (this.time > this.fireAmplifyState.activeUntilAt + 1e-9
                    && this.fireAmplifyState.nextTickAt > this.fireAmplifyState.activeUntilAt + 1e-9) {
                    this.fireAmplifyState = null;
                }
            }
            if (this.woodAmplifyState) {
                while (this.woodAmplifyState.nextTickAt <= this.time + 1e-9
                    && this.woodAmplifyState.nextTickAt <= this.woodAmplifyState.activeUntilAt + 1e-9) {
                    this.addDamage(this.woodAmplifyState.damagePerTick, this.woodAmplifyState.damageHostId, "wood_amplify");
                    this.woodAmplifyState.ticksDone += 1;
                    if (this.woodAmplifyState.ticksDone % this.woodAmplifyState.bloomEvery === 0) {
                        this.addDamage(this.woodAmplifyState.bloomDamage, this.woodAmplifyState.damageHostId, "wood_bloom");
                        this.notifyWoodBloom({ element: "wood" });
                    }
                    this.woodAmplifyState.nextTickAt += this.woodAmplifyState.interval;
                }
                if (this.time > this.woodAmplifyState.activeUntilAt + 1e-9
                    && this.woodAmplifyState.nextTickAt > this.woodAmplifyState.activeUntilAt + 1e-9) {
                    this.woodAmplifyState = null;
                }
            }
            if (this.thunderSpearState) {
                const thunderSpearStacks = this.thunderSpearState.prune(this.time);
                if (thunderSpearStacks > 0
                    && this.time < this.duration
                    && this.thunderSpearState.tickAt
                    && this.time >= this.thunderSpearState.tickAt
                    && this.thunderSpearState.tickAt <= this.thunderSpearState.lastExpireAt + 1e-9) {
                    const stacks = this.thunderSpearState.consumeTick(this.time);
                    this.addDamage(95 * stacks, "thunder-spear", "machine_thunder_spear_dot");
                    this.thunderSpearState.tickAt += this.thunderSpearState.tickInterval;
                }
                if (this.time > this.thunderSpearState.lastExpireAt + 1e-9
                    && this.thunderSpearState.tickAt > this.thunderSpearState.lastExpireAt + 1e-9) {
                    this.thunderSpearState = null;
                }
            }
            this.flushDelayedEvents();
        }

        // 执行当前拍到时的所有延迟事件。
        flushDelayedEvents() {
            this.getReadyDelayedEvents().forEach(event => event.handler());
        }

        flushImmediateEvents() {
            while (true) {
                const readyEvents = this.getReadyDelayedEvents();
                const hasQueue = this.queue.length > 0;
                if (readyEvents.length === 0 && !hasQueue) break;
                readyEvents.forEach(event => event.handler());
                if (this.queue.length > 0) {
                    this.flushQueue();
                }
            }
        }

        // 处理主事件队列里的单个事件。
        processQueueEvent(event) {
            switch (event.type) {
                case "BURN_TICK":
                    this.handleBurnTick(event.targetIndex);
                    break;
                case "FIRE_METEOR_TICK":
                    this.handleFireMeteorTick(event.targetIndex);
                    break;
                case "WOOD_ECHO_TICK":
                    this.handleWoodEchoTick(event.targetIndex);
                    break;
                case "FLAME_BODY_TICK":
                    this.handleFlameBodyTick(event.targetIndex);
                    break;
                case "STATIC_OVERLOAD_TICK":
                    this.handleStaticOverloadTick(event.targetIndex);
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
            return baseDamage * this.effects.ice.arrowDamageMultiplier;
        }

        getIceShatterDamage() {
            const bonus = this.isFrostGlorySpiritActive(2)
                ? (this.craftStone?.params?.shatterDamageBonus || 0)
                : 0;
            return this.effects.ice.shatterDamage * (1 + bonus);
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
            this.addLog("buff", sourceCard.id, `目标 ${targetIndex + 1} 燃烧 ${beforeStacks} → ${target.burnStacks} 层${refreshDuration ? "（刷新持续时间）" : "（不刷新持续时间）"}`, {
                buff: "burn",
                targetIndex,
                beforeStacks,
                afterStacks: target.burnStacks,
                refreshDuration: Boolean(refreshDuration)
            });
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
            this.tryTriggerBurnheart("burn_tick");
            this.notifyBurnTick({ targetIndex, damage });
        }

        handleFireMeteorTick(targetIndex) {
            const target = this.targets[targetIndex];
            const stone = this.machineStoneMap.get("fire-meteor");
            if (!target || !stone) return;
            const stacks = target.fireMeteor.consumeTick(this.time);
            if (stacks <= 0) return;
            this.addDamage(stone.params.burnDamage * stacks, stone.id, "machine_fire_meteor_burn");
            this.addMeter("fire", 200 * stacks);
            this.tryTriggerBurnheart("machine_fire_meteor_burn");
        }

        // 给所有目标叠一层震荡；层数无上限，伤害按层数效能倍乘。
        applyWoodEcho(efficiency = 1) {
            const dice = this.getCard(CARD_IDS.SACRED_WOOD_DICE);
            if (!dice) return;
            this.targets.forEach((target, targetIndex) => {
                const beforeStacks = target.woodEcho.prune(this.time);
                const afterStacks = target.woodEcho.apply(this.time, dice.params.echoDuration || WOOD_ECHO_DURATION, efficiency);
                if (targetIndex !== 0) return;
                this.countMechanic(beforeStacks === 0 ? "pulse_echo_apply" : "pulse_echo_stack");
                this.countMechanic("pulse_echo_stacks", afterStacks);
                this.addLog("buff", dice.id, `目标 1 震荡 ${beforeStacks} → ${afterStacks} 层（本层效能 ${Math.round(efficiency * 100)}%）`, {
                    buff: "wood_echo",
                    targetIndex,
                    beforeStacks,
                    afterStacks,
                    efficiency
                });
            });
        }

        // 结算一次震荡：单次伤害按当前存活层的效能之和倍乘。
        handleWoodEchoTick(targetIndex) {
            const target = this.targets[targetIndex];
            const dice = this.getCard(CARD_IDS.SACRED_WOOD_DICE);
            if (!target || !dice) return;
            const ticks = (dice.params.echoDuration || WOOD_ECHO_DURATION) / WOOD_ECHO_TICK_INTERVAL;
            const perTick = dice.params.echoDamage / ticks;
            const weight = target.woodEcho.consumeTick(this.time);
            if (weight <= 0) return;
            this.addDamage(perTick * weight, dice.id, "pulse_echo");
        }

        handleFlameBodyTick(targetIndex) {
            const stone = this.machineStoneMap.get("flame-body");
            if (targetIndex !== 0 || !stone) return;
            const perTick = stone.params.damage || 0;
            if (perTick <= 0) return;
            const totals = new Map();
            const counts = new Map();
            this.targets.forEach(target => {
                target.flameBody.consumeTickByMeta(this.time).forEach((weight, mechanic) => {
                    if (weight <= 0) return;
                    totals.set(mechanic, (totals.get(mechanic) || 0) + weight);
                    counts.set(mechanic, Math.max(counts.get(mechanic) || 0, weight));
                });
            });
            totals.forEach((weight, mechanic) => {
                this.addDamage(perTick * weight, stone.id, mechanic, false);
                this.countMechanic(mechanic, counts.get(mechanic) || 0);
                if (mechanic === "machine_flame_body") {
                    this.tryTriggerBurnheart(mechanic);
                }
            });
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
                this.handleMachineIceArrow(1, card.id);
                if (!consumedColdTide) this.consumeColdTideCharge();
                this.consumeFrostCrystalSpikeCharge(card.id);
                this.notifyIceArrowHit({
                    card,
                    targetsHit,
                    damagePerArrow,
                    totalDamage
                });
            }
        }

        // 结算一次玄冰风暴命中。ownerId 用于把额外召唤的元素归属到召唤者。
        castIceStorm(card, efficiency, shouldAddStormMeter, ownerId = null) {
            const zuoGui = this.getCard(CARD_IDS.ZUO_GUI);
            // 左归对风暴只提供自身那部分伤害加成，避免重复叠加冰箭增伤。
            const stormOnlyBonus = zuoGui ? zuoGui.params.damageBonus : 0;
            const damage = card.params.stormDamage * (1 + stormOnlyBonus) * efficiency;
            const mechanic = ownerId
                ? "ice_storm_extra"
                : (efficiency < 1 ? "ice_storm_frenzy" : "ice_storm");
            this.addDamage(damage, ownerId || card.id, mechanic);
            this.consumeColdTideCharge();
            this.consumeFrostCrystalSpikeCharge(ownerId || card.id);
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
            const rottenGale = this.machineStoneMap.get("rotten-gale");
            if (this.isVerdantLifeTrueformActive(1)
                && rottenGale
                && this.random() < (this.craftStone?.params?.pulseProcChance || 0)) {
                const amplifyBonus = 1 + this.effects.wood.amplifyDamageBonus;
                this.addDamage((rottenGale.params.damage || 0) * this.targetCount * amplifyBonus, rottenGale.id, "machine_rotten_gale");
            }
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
            if (this.isThunderAegisSpiritActive(3)
                && this.thunderAegisExtraCastExpiresAt > 0
                && this.time <= this.thunderAegisExtraCastExpiresAt + 1e-9) {
                const chainExtraCast = this.craftStone?.params?.chainExtraCast || 0;
                for (let i = 0; i < chainExtraCast; i += 1) {
                    this.triggerExtraThunderSpear(card, efficiency);
                }
            }
        }

        // 给目标叠一层静电过载；层数无上限，单次结算按层数效能倍乘。
        applyStaticOverload(cardId, targetsHit, efficiency) {
            const duration = this.effects.thunder.staticOverloadDuration || STATIC_OVERLOAD_DEFAULT_DURATION;
            // 引雷幡触发的静电过载归因到雷魄晶，其余额外雷链则保留来源卡。
            const ownerId = cardId === CARD_IDS.THUNDER_BANNER ? CARD_IDS.THUNDER_CRYSTAL : cardId;
            for (let targetIndex = 0; targetIndex < targetsHit; targetIndex++) {
                const target = this.targets[targetIndex];
                if (!target) continue;
                target.staticOverload.tickInterval = duration / STATIC_OVERLOAD_TICKS;
                const beforeStacks = target.staticOverload.stacks;
                const afterStacks = target.staticOverload.apply(this.time, duration, efficiency, ownerId);
                if (targetIndex === 0) {
                    this.addLog("buff", ownerId, `目标 1 静电过载 ${beforeStacks} → ${afterStacks} 层`, {
                        buff: "static_overload",
                        targetIndex,
                        beforeStacks,
                        afterStacks,
                        efficiency
                    });
                }
            }
        }

        // 结算一次静电过载：按来源分摊，单次伤害随存活层数倍乘。
        handleStaticOverloadTick(targetIndex) {
            const target = this.targets[targetIndex];
            if (!target) return;
            const perTick = this.effects.thunder.staticOverloadDamage / STATIC_OVERLOAD_TICKS;
            if (perTick <= 0) return;
            let settled = false;
            // 一次结算可能拆成多笔来源归属，次数只按结算本身记一次。
            target.staticOverload.consumeTickByMeta(this.time).forEach((weight, ownerId) => {
                if (weight <= 0) return;
                this.addDamage(perTick * weight, ownerId, "static_overload", false);
                settled = true;
            });
            if (settled) this.countMechanic("static_overload");
        }

        // 判断当前拍是否轮到紫电螭吻的雷暴阶段。
        shouldTriggerThunderFrenzy() {
            return this.time >= this.nextThunderFrenzyAt;
        }

        // 触发对应元素的激化效果。激化伤害为内置逻辑，与丹青是否在编无关。
        triggerAmplify(element) {
            this.emit(EVENTS.ELEMENT_AMPLIFY, { element });
            this.dispatchMachineStones(EVENTS.ELEMENT_AMPLIFY, { element });
            if (element === "fire") {
                if (this.isBlazingSkyfireTrueformActive()) {
                    const stone = this.craftStone;
                    stone.trueformLinyinExpiresAt = this.time + (stone.params.linyinDuration || 8);
                    this.addLog("buff", stone.selectedVariantId || stone.id, `灵蕴伤害提高 ${Math.round((stone.params.linyinBonus || 0) * 100)}%，持续 ${stone.params.linyinDuration || 8}s`, {
                        buff: "trueform_linyin_bonus",
                        bonus: stone.params.linyinBonus || 0,
                        expireAt: Number(stone.trueformLinyinExpiresAt.toFixed(1))
                    });
                }
                this.scheduleFireAmplifyTicks();
                return;
            }
            this.applyAmplifyDamage(element);
            if (element === "thunder") {
                this.scheduleThunderAmplifyTicks();
            }
        }

        // 结算内置激化伤害。伤害统一归到内置激化来源，与丹青编成无关。
        applyAmplifyDamage(element) {
            const config = AMPLIFY_DAMAGE[element];
            if (!config) return;
            const hostId = config.sourceId;

            if (element === "ice") {
                const machineMultiplier = 1 + (this.effects.ice.amplifyDamageBonus || 0);
                const craftMultiplier = this.isFrostGloryTrueformActive(2)
                    ? 1 + (this.craftStone?.params?.iceAmplifyBonus || 0)
                    : 1;
                const damageMultiplier = machineMultiplier * craftMultiplier;
                this.addDamage(config.initialDamage * damageMultiplier, hostId, "ice_amplify");
                this.scheduleEvent(this.time + ICE_AMPLIFY_FINAL_DELAY, () => {
                    this.addDamage(config.finalDamage * damageMultiplier, hostId, "ice_amplify");
                    this.notifyIceAmplifyFreeze({ element: "ice" });
                });
                return;
            }

            if (element === "wood") {
                this.scheduleWoodAmplifyTicks();
                return;
            }

            if (element === "thunder") {
                if (this.isThunderAegisTrueformActive(1)) {
                    const stone = this.craftStone;
                    stone.thunderLinyinExpiresAt = this.time + (stone.params.thunderLinyinDuration || 5);
                    this.addLog("buff", stone.selectedVariantId || stone.id, `灵蕴伤害提高 ${Math.round((stone.params.thunderLinyinBonus || 0) * 100)}%，持续 ${stone.params.thunderLinyinDuration || 5}s`, {
                        buff: "thunder_linyin_bonus",
                        bonus: stone.params.thunderLinyinBonus || 0,
                        expireAt: Number(stone.thunderLinyinExpiresAt.toFixed(1))
                    });
                }
                const bonus = this.isThunderAegisTrueformActive(2)
                    ? (this.craftStone?.params?.thunderAmplifyBonus || 0)
                    : 0;
                this.addDamage(config.damage * this.targetCount * (1 + bonus), hostId, "thunder_amplify");
                return;
            }
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
            // 凛霜寒涌 5/5：冻结效果对命中的敌人累加 3000 玄冰值。
            const freezeMeter = this.effects.ice.freezeMeterBonus;
            if (this.isFrostGloryTrueformActive(3)) {
                this.addMeter("ice", freezeMeter * this.targetCount, this.craftStone?.selectedVariantId || this.craftStone?.id);
            } else if (freezeMeter > 0) {
                this.addMeter("ice", freezeMeter * this.targetCount);
            }
                if (this.isFrostGloryTrueformActive(1)) {
                    const params = this.craftStone?.params || {};
                    const total = params.frostCrushDamage || 0;
                    const duration = params.frostCrushDuration || 3;
                    if (total > 0) {
                        const perTick = total / duration;
                        for (let i = 1; i <= duration; i += 1) {
                            this.scheduleEvent(this.time + i, () => this.addDamage(perTick * this.targetCount, this.craftStone.selectedVariantId || this.craftStone.id, "craft_stone"));
                        }
                    }
                }
            this.emit(EVENTS.ICE_AMPLIFY_FREEZE, event);
            this.dispatchMachineStones(EVENTS.ICE_AMPLIFY_FREEZE, event);
        }

        notifyIceElementalSummoned(event = {}) {
            const source = this.resolveSourceName(event.sourceCardId);
            // 每只冰霜元素的出现都记一条，便于对照 5/5 的额外召唤。
            this.addLog("event", event.sourceCardId, `${source} 召唤冰霜元素${event.extra ? "（无视冷却）" : ""}`, {
                sourceCardId: event.sourceCardId || null,
                extra: Boolean(event.extra)
            });
            this.emit(EVENTS.ICE_ELEMENTAL_SUMMONED, event);
            this.dispatchMachineStones(EVENTS.ICE_ELEMENTAL_SUMMONED, event);
        }

        // 召唤一只冰霜元素：广播出现事件，并放出一轮玄冰风暴。
        // 冰霜元素本身就是玄冰风暴的载体，不带齐昊时按其 0 星定义取风暴参数。
        summonIceElemental(sourceId) {
            this.notifyIceElementalSummoned({ sourceCardId: sourceId, extra: true });
            const qiHao = this.getCard(CARD_IDS.QI_HAO);
            const def = Data.getCardDefById(CARD_IDS.QI_HAO);
            const params = qiHao ? qiHao.params : (def ? Data.resolveCardParams(def, 0) : null);
            if (!params) return;
            const hits = params.burstHits;
            const interval = params.burstDuration / hits;
            for (let i = 0; i < hits; i += 1) {
                this.scheduleEvent(this.time + interval * i, () => {
                    this.castIceStorm({ id: sourceId, params }, 1 / hits, i === 0, sourceId);
                });
            }
        }

        notifyWoodBloom(event = {}) {
            this.emit(EVENTS.WOOD_BLOOM, event);
            this.dispatchMachineStones(EVENTS.WOOD_BLOOM, event);
        }

        notifyWoodGiantSummoned(event = {}) {
            const source = this.resolveSourceName(event.stoneId);
            this.addLog("event", event.stoneId, `${source} 召唤苍木巨人`, {
                stoneId: event.stoneId || null
            });
            this.emit(EVENTS.WOOD_GIANT_SUMMONED, event);
        }

        notifyCraftStoneCastEnd(event = {}) {
            const displayId = this.craftStone?.selectedVariantId || event.stoneId;
            const name = this.resolveSourceName(displayId);
            this.addLog("craft", displayId, `${name} 施法结束，联动生效`, {
                stoneId: event.stoneId,
                selectedVariantId: displayId || null
            });
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
                    return `${stone.name} 未触发：当前仅累计 ${(stone.counter || 0)}/${stone.params.pulseThreshold || 6} 次脉冲`;
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
                .map(([cardId, damage]) => ({
                    id: cardId,
                    name: this.resolveSourceName(cardId) || cardId,
                    damage: Math.round(damage),
                    dps: Number((damage / duration).toFixed(2))
                }))
                .sort((a, b) => b.damage - a.damage);

            const byMechanic = Object.entries(this.breakdown.byMechanic)
                .map(([mechanic, damage]) => ({
                    mechanic,
                    name: getMechanicLabel(mechanic),
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
                log: this.log.slice(),
                logTruncated: this.logTruncated,
                seed: this.seed
            };
        }
    }

    const api = {
        CombatEngine,
        ELEMENT_LABELS,
        MECHANIC_LABELS,
        getMechanicLabel
    };

    global.Engine = api;
    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    }
})(typeof window !== "undefined" ? window : globalThis);
