(function (global) {
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

    const stat = (base, perStar = 0) => ({ base, perStar });

    const CARD_DEFS = [
        {
            id: "scarlet-ant",
            name: "猩红巨蚁",
            element: "fire",
            fee: 1,
            baseEffectText: "造成伤害时，引燃最多 3 名敌人，附加可叠层燃烧：每 3 秒造成 2209 天火伤害，持续 18 秒。燃烧最多 8 层，每额外 1 层基础伤害提高 5%。",
            upgradeText: "燃烧基础伤害每星 +160。",
            mechanics: ["burn_apply", "burn_tick"],
            notes: ["首版沿用旧版近似：猩红巨蚁按 8 秒一次的频率主动铺燃烧。"],
            params: {
                burnDamage: stat(2209, 160),
                burnDuration: 18,
                burnTickInterval: 3,
                burnMaxStacks: 8,
                extraLayerBonus: 0.05,
                maxTargets: 3,
                assumedApplyInterval: 8
            }
        },
        {
            id: "fierce-tiger",
            name: "猛虎",
            element: "fire",
            fee: 2,
            baseEffectText: "燃烧造成伤害时累加 98 天火值；触发爆燃时累加 532 天火值；天火值达到 10000 时触发天火激化。",
            upgradeText: "燃烧累积值每星 +7；爆燃累积值每星 +38。",
            mechanics: ["blaze_meter"],
            params: {
                burnMeterGain: stat(98, 7),
                combustMeterGain: stat(532, 38),
                triggerThreshold: 10000
            }
        },
        {
            id: "sui-shou",
            name: "岁兽",
            element: "fire",
            fee: 3,
            baseEffectText: "燃烧生效频率提高 20%；燃烧造成伤害时有 70% 概率额外叠加 1 层，且不会重置持续时间。",
            upgradeText: "燃烧生效频率每星再提高 10%；额外叠层概率每星 +5%。",
            mechanics: ["burn_haste", "burn_extra_stack"],
            params: {
                tickRateBonus: stat(0.20, 0.10),
                extraStackChance: stat(0.70, 0.05)
            }
        },
        {
            id: "two-tail-fox",
            name: "二尾妖狐",
            element: "fire",
            fee: 4,
            baseEffectText: "每次尝试添加或叠加燃烧时，立刻造成 3696 天火伤害。",
            upgradeText: "直伤每星 +264。",
            mechanics: ["burn_bonus_hit"],
            params: {
                procDamage: stat(3696, 264)
            }
        },
        {
            id: "six-tail-fox",
            name: "六尾魔狐",
            element: "fire",
            fee: 5,
            baseEffectText: "燃烧叠加至 6 层以上时，1.5 秒后触发爆燃：引爆额外燃烧层数并将燃烧重置为 1 层，每引爆 1 层造成 8055 天火伤害。",
            upgradeText: "每层爆燃伤害每星 +575。",
            mechanics: ["combust"],
            params: {
                threshold: 6,
                delay: 1.5,
                damagePerExtraLayer: stat(8055, 575)
            }
        },
        {
            id: "yan-hong",
            name: "燕虹",
            element: "ice",
            fee: 1,
            baseEffectText: "释放技能时发射 1 枚冰箭，造成 4830 玄冰伤害，每枚冰箭至多命中 2 名敌人（6 秒内置冷却）。",
            upgradeText: "冰箭伤害每星 +345。",
            mechanics: ["ice_arrow"],
            params: {
                arrowDamage: stat(4830, 345),
                arrowTargets: 2,
                cooldown: 6
            }
        },
        {
            id: "shangguan-ce",
            name: "上官策",
            element: "ice",
            fee: 2,
            baseEffectText: "冰箭命中累加 140 玄冰值；碎裂伤害对所有目标各累加 140；玄冰风暴总计累加 1400；达到 10000 时触发玄冰激化。",
            upgradeText: "冰箭/碎裂每星 +10，玄冰风暴每星 +100。",
            mechanics: ["ice_meter"],
            params: {
                arrowMeterGain: stat(140, 10),
                shatterMeterGain: stat(140, 10),
                stormMeterGain: stat(1400, 100),
                triggerThreshold: 10000
            }
        },
        {
            id: "wen-min",
            name: "文敏",
            element: "ice",
            fee: 3,
            baseEffectText: "冰箭伤害提高 28%；战斗中每经过 16 秒，召唤 3 枚冰箭攻击敌人，每枚至多命中 2 名敌人。",
            upgradeText: "冰箭伤害每星 +2%；触发间隔每星 -1 秒。",
            mechanics: ["ice_arrow_bonus", "ice_arrow_burst"],
            params: {
                arrowDamageBonus: stat(0.28, 0.02),
                volleyCooldown: stat(16, -1),
                volleyArrows: 3,
                arrowTargets: 2
            }
        },
        {
            id: "zuo-gui",
            name: "左归",
            element: "ice",
            fee: 4,
            baseEffectText: "冰箭和玄冰风暴伤害提高 14%，并在命中敌人时有 30% 概率碎裂，对目标及周围所有敌人造成 8484 玄冰伤害。",
            upgradeText: "冰箭/风暴伤害每星 +1%；碎裂伤害每星 +606。",
            mechanics: ["ice_damage_bonus", "shatter"],
            params: {
                damageBonus: stat(0.14, 0.01),
                shatterChance: 0.30,
                shatterDamage: stat(8484, 606)
            }
        },
        {
            id: "qi-hao",
            name: "齐昊",
            element: "ice",
            fee: 5,
            baseEffectText: "召唤冰霜元素施放玄冰风暴，造成 128000 玄冰伤害；冰箭造成伤害时，玄冰风暴冷却缩短 2 秒（60 秒内置冷却）。",
            upgradeText: "玄冰风暴伤害每星 +9334。",
            mechanics: ["ice_storm"],
            params: {
                stormDamage: stat(128000, 9334),
                cooldown: 60,
                cooldownReductionPerArrowHit: 2,
                burstHits: 20,
                burstDuration: 3
            }
        },
        {
            id: "folding-fan",
            name: "折扇",
            element: "wood",
            fee: 1,
            baseEffectText: "每 15 秒触发脉冲，对周围敌人造成 9792 苍木伤害。",
            upgradeText: "脉冲伤害每星 +700。",
            mechanics: ["pulse_damage"],
            params: {
                pulseDamage: stat(9792, 700),
                interval: 15
            }
        },
        {
            id: "cool-pearl",
            name: "清凉珠",
            element: "wood",
            fee: 2,
            baseEffectText: "脉冲命中敌人时累加 280 苍木值；达到 10000 时触发苍木激化。",
            upgradeText: "累积值每星 +20。",
            mechanics: ["wood_meter"],
            params: {
                meterGain: stat(280, 20),
                triggerThreshold: 10000
            }
        },
        {
            id: "sacred-wood-dice",
            name: "神木骰",
            element: "wood",
            fee: 3,
            baseEffectText: "脉冲造成伤害时，在 10 秒内额外造成 12005 苍木伤害；进入战斗的 6 秒内总计额外触发 3 次脉冲。",
            upgradeText: "额外伤害每星 +860。",
            mechanics: ["pulse_echo", "opening_pulse"],
            params: {
                echoDamage: stat(12005, 860),
                echoDuration: 10,
                openingPulseTimes: 3,
                openingPulseWindow: 6
            }
        },
        {
            id: "lin-feng",
            name: "林峰",
            element: "wood",
            fee: 4,
            baseEffectText: "脉冲伤害提高 56%，每额外命中 1 名敌人该增幅降低 11.2%。",
            upgradeText: "伤害增幅每星 +4%；每额外敌人降低值每星 +0.8%。",
            mechanics: ["pulse_bonus"],
            params: {
                damageBonus: stat(0.56, 0.04),
                reductionPerExtraEnemy: stat(0.112, 0.008)
            }
        },
        {
            id: "liu-he-mirror",
            name: "六合镜",
            element: "wood",
            fee: 5,
            baseEffectText: "折扇的脉冲间隔缩短 2 秒；脉冲触发时，2 秒内以 70% 效能额外触发 2 次脉冲。",
            upgradeText: "间隔缩短每星再 +0.5 秒；追加脉冲效能每星 +5%。",
            mechanics: ["pulse_haste", "pulse_echo_wave"],
            params: {
                intervalReduction: stat(2, 0.5),
                extraPulseCount: 2,
                extraPulseEfficiency: stat(0.70, 0.05),
                extraPulseSpacing: 1
            }
        },
        {
            id: "thunder-banner",
            name: "引雷幡",
            element: "thunder",
            fee: 1,
            baseEffectText: "造成伤害时触发连锁闪电，对最多 3 名敌人造成 9660 神雷伤害（12 秒内置冷却）。",
            upgradeText: "连锁闪电伤害每星 +690。",
            mechanics: ["chain_lightning_damage"],
            notes: ["首版按 12 秒一次的伤害连锁近似处理，不模拟治疗分支。"],
            params: {
                chainDamage: stat(9660, 690),
                cooldown: 12,
                maxEnemyTargets: 3
            }
        },
        {
            id: "zi-xiao-gourd",
            name: "紫霄葫",
            element: "thunder",
            fee: 2,
            baseEffectText: "连锁闪电命中敌人时累加 392 神雷值；达到 10000 时触发神雷激化。",
            upgradeText: "累积值每星 +28。",
            mechanics: ["thunder_meter"],
            params: {
                meterGain: stat(392, 28),
                triggerThreshold: 10000
            }
        },
        {
            id: "thunder-crystal",
            name: "雷魄晶",
            element: "thunder",
            fee: 3,
            baseEffectText: "连锁闪电使目标进入静电过载，8 秒内总计受到 16100 神雷伤害。",
            upgradeText: "总伤害每星 +1152。",
            mechanics: ["static_overload"],
            params: {
                totalDamage: stat(16100, 1152),
                duration: 8
            }
        },
        {
            id: "chain-lightning-wall",
            name: "连雷壁",
            element: "thunder",
            fee: 4,
            baseEffectText: "连锁闪电伤害提高 42%；每额外命中 1 名敌人，伤害再提高 14%。",
            upgradeText: "基础增伤每星 +3%；额外目标增伤每星 +1%。",
            mechanics: ["chain_lightning_bonus"],
            params: {
                damageBonus: stat(0.42, 0.03),
                extraEnemyBonus: stat(0.14, 0.01)
            }
        },
        {
            id: "purple-dragon",
            name: "紫电螭吻",
            element: "thunder",
            fee: 5,
            baseEffectText: "连锁闪电有 70% 概率额外触发 1 次；进入战斗及其后每 30 秒，连锁闪电转化为狂雷：以 60% 效能连续释放 3 次。",
            upgradeText: "额外触发概率每星 +5%；狂雷效能每星 +10%。",
            mechanics: ["chain_lightning_extra", "frenzy_chain"],
            params: {
                extraTriggerChance: stat(0.70, 0.05),
                frenzyEfficiency: stat(0.60, 0.10),
                frenzyCount: 3,
                frenzyInterval: 30,
                frenzyCanRepeat: false
            }
        }
    ];

    function resolveValue(value, starLevel) {
        if (value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "base") && Object.prototype.hasOwnProperty.call(value, "perStar")) {
            return value.base + value.perStar * starLevel;
        }
        if (Array.isArray(value)) {
            return value.map(item => resolveValue(item, starLevel));
        }
        if (value && typeof value === "object") {
            const out = {};
            Object.keys(value).forEach(key => {
                out[key] = resolveValue(value[key], starLevel);
            });
            return out;
        }
        return value;
    }

    function resolveCardParams(cardDef, starLevel) {
        const level = clamp(Number.isFinite(starLevel) ? starLevel : parseInt(starLevel || 0, 10), 0, 6);
        return resolveValue(cardDef.params, level);
    }

    function getCardDefById(id) {
        return CARD_DEFS.find(card => card.id === id) || null;
    }

    const api = {
        CARD_DEFS,
        resolveCardParams,
        getCardDefById
    };

    global.Data = api;
    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    }
})(typeof window !== "undefined" ? window : globalThis);
