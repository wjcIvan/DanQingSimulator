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

    const MACHINE_STONE_DEFS = [
        {
            id: "frost-surge",
            name: "凛霜寒涌",
            element: "ice",
            fee: 1,
            baseEffectText: "玄冰激化激发凛霜寒涌：在目标处释放缓慢扩散的寒气，对触碰到的所有敌人造成 75540 玄冰伤害。",
            upgradeText: "伤害每提升一档+37.5%；\n\n3/5：玄冰激化基础伤害提高 30%；\n\n5/5：玄冰激化的冻结效果对命中敌人累加 3000 玄冰值。",
            mechanics: ["on_ice_amplify"],
            params: { damage: stat(75540, 75540 * 0.375), iceAmplifyBonusAtRank3: 0.30, freezeMeterAtRank5: 3000 }
        },
        {
            id: "frost-shatter",
            name: "霜寒破裂",
            element: "ice",
            fee: 2,
            baseEffectText: "冰霜元素出现时，在自身脚下引发霜寒破裂：对周围所有敌人造成 60632 玄冰伤害。",
            upgradeText: "伤害每提升一档+37.5%；\n\n3/5：霜寒爆破使敌人在 6 秒内额外承受 76692 玄冰伤害；\n\n5/5：凝冰霜华无视冷却召唤一只冰霜元素。",
            mechanics: ["on_ice_elemental"],
            params: { damage: stat(60632, 60632 * 0.375), extraDamage: 76692, extraDuration: 6 }
        },
        {
            id: "frost-rain",
            name: "霜刺寒雨",
            element: "ice",
            fee: 3,
            baseEffectText: "玄冰激化的冻结效果触发时释放霜刺寒雨：对目标和目标周围的敌人造成 81740 玄冰伤害。",
            upgradeText: "伤害每提升一档+37.5%；\n\n3/5：凝冰霜华基础伤害提高 30%；\n\n5/5：触发时获得 3 层洞察，下一次灵蕴技消耗所有洞察，每层使该次伤害提高 3%。",
            mechanics: ["on_ice_freeze"],
            params: { damage: stat(81740, 81740 * 0.375), craftBonusAtRank3: 0.30, insightStacks: 3, insightBonusPerStack: 0.03 }
        },
        {
            id: "frost-crystal-spike",
            name: "寒晶刺",
            element: "ice",
            fee: 4,
            baseEffectText: "每召唤 10 枚冰箭获得寒晶刺：下一次攻击召唤 3 枚寒晶刺，每枚对当前敌人造成 10992 伤害。",
            upgradeText: "伤害每提升一档+37.5%；\n\n3/5：每次造成伤害时有 100% 概率触发碎裂；\n\n5/5：召唤冰霜元素时获得 2 层寒晶刺。",
            mechanics: ["ice_arrow_counter"],
            params: { damage: stat(10992, 10992 * 0.375), arrowThreshold: 10, spikeCount: 3 }
        },
        {
            id: "cold-tide",
            name: "寒潮冰涌",
            element: "ice",
            fee: 5,
            baseEffectText: "进入战斗及之后每 30 秒获得寒潮冰涌：下一次攻击引发寒潮向敌人推进，对命中的所有敌人造成 38144 玄冰伤害。",
            upgradeText: "伤害每提升一档+37.5%；\n\n3/5：生效间隔缩短 10 秒，并对命中敌人累加 2000 玄冰值；\n\n5/5：凝冰霜华持续期间最多向前方释放 4 道寒潮。",
            mechanics: ["periodic_next_attack"],
            params: { damage: stat(38144, 38144 * 0.375), interval: 30, rank3Interval: 20, meterAtRank3: 2000 }
        },
        {
            id: "fire-meteor",
            name: "天火陨星",
            element: "fire",
            fee: 1,
            baseEffectText: "进入战斗时及之后每 20 秒获得天火陨星：下一次攻击投掷陨星，造成 26594 天火伤害和击飞，并累加 2000 天火值。",
            upgradeText: "伤害每提升一档+37.5%；\n\n3/5：命中时使目标在 10 秒内每 2 秒承受 5342 天火伤害并累加 200 天火值，最多叠加 2 层；\n\n5/5：天火激化触发时自身获得天火陨星。",
            mechanics: ["periodic_next_attack", "on_fire_amplify"],
            params: { damage: stat(26594, 26594 * 0.375), interval: 20, meter: 2000, burnDamage: 5342, burnDuration: 10 }
        },
        {
            id: "scarlet-ring",
            name: "赤焰天环",
            element: "fire",
            fee: 2,
            baseEffectText: "天火激化持续期间，在目标脚下生成赤焰天环：每 2 秒对目标和周围敌人造成 3080 天火伤害，有 20% 概率为主要目标添加 1 层燃烧。",
            upgradeText: "伤害每提升一档+37.5%；\n\n3/5：额外触发 1 次，造成 2 倍伤害并有 2 次添加燃烧的机会；\n\n5/5：赤焰天环和天火激化的生效间隔缩短 0.5 秒，持续时间延长 20%。",
            mechanics: ["during_fire_amplify"],
            params: { damage: stat(3080, 3080 * 0.375), interval: 2, extraTicksAtRank3: 1 }
        },
        {
            id: "blazing-land",
            name: "烈火燎原",
            element: "fire",
            fee: 3,
            baseEffectText: "灼灼天炎效果结束时生成持续 8 秒的烈焰之地：每 1 秒造成 29308 天火伤害。",
            upgradeText: "伤害每提升一档+37.5%；\n\n3/5：每次造成伤害时对命中敌人累加 1500 天火值；\n\n5/5：灼灼天炎使自身造成的所有灵蕴伤害提高 33%，持续 15 秒（自灼灼天炎释放瞬间起算）。",
            mechanics: ["on_craft_fire_end"],
            params: { damage: stat(29308, 29308 * 0.375), duration: 8, interval: 1, linyinBonus: 0.33, linyinDuration: 15 }
        },
        {
            id: "flame-body",
            name: "烈焰焚身",
            element: "fire",
            fee: 4,
            baseEffectText: "战斗中每 15 秒获得 3 层焚尽：攻击消耗 1 层焚尽，为至多 3 名敌人添加烈焰焚身，使目标在 12 秒内每 1 秒受到 1082 天火伤害。",
            upgradeText: "伤害每提升一档+37.5%；\n\n3/5：爆燃会为目标添加 2 层烈焰焚身；\n\n5/5：灼灼天炎持续期间对影响范围内所有敌人添加至多 12 层烈焰焚身。",
            mechanics: ["periodic_next_attack"],
            params: { damage: stat(1082, 1082 * 0.375), interval: 15, duration: 12 }
        },
        {
            id: "fireburst",
            name: "神火迸发",
            element: "fire",
            fee: 5,
            baseEffectText: "受到天火激化影响的目标体内喷发数枚陨星，砸向目标周围区域造成 65290 伤害。",
            upgradeText: "伤害每提升一档+37.5%；\n\n3/5：天火激化基础伤害提高 20%；\n\n5/5：在短暂延迟后额外造成 1 次伤害。",
            mechanics: ["on_fire_amplify"],
            params: { damage: stat(65290, 65290 * 0.375), extraAtRank5: 1, amplifyBonusAtRank3: 0.20 }
        },
        {
            id: "rotten-gale",
            name: "腐木瘴风",
            element: "wood",
            fee: 1,
            baseEffectText: "苍木激化触发苍木激化·绽放时，额外触发腐木瘴风：对周围敌方造成 25042 苍木伤害。",
            upgradeText: "伤害每提升一档+37.5%；\n\n3/5：腐木瘴风和苍木激化造成的伤害提高 40%；\n\n5/5：青芜浮生释放后对攻击范围内敌方添加 10000 苍木值（最多对 5 名敌方生效）。",
            mechanics: ["on_wood_bloom"],
            params: { damage: stat(25042, 25042 * 0.375), amplifyBonusAtRank3: 0.40 }
        },
        {
            id: "paper-forest",
            name: "苍林浮生",
            element: "wood",
            fee: 2,
            baseEffectText: "战斗状态下每 20 秒召唤小纸人：存在 10 秒，每 2 秒攻击一次共 6 次，每次造成 10022 苍木伤害。",
            upgradeText: "伤害每提升一档+12.5%；\n\n3/5：召唤后前 4 秒释放纸人风暴，对周围敌人造成 11 次 4513 苍木伤害，后 6 秒进行 3 次本体普攻；\n\n5/5：苍林箭和纸人风暴每次命中增加目标 80 苍木值。",
            mechanics: ["periodic_summon"],
            params: { damage: stat(10022, 10022 * 0.125), interval: 20, attacks: 6, attackInterval: 2, upgradedAttacks: 3, stormDamage: stat(4513, 4513 * 0.125), stormHits: 11, stormDuration: 4 }
        },
        {
            id: "wood-dice",
            name: "神木骰",
            element: "wood",
            fee: 3,
            baseEffectText: "累积触发 6 次脉冲后，神木骰根据投掷点数获得 1~3 层六六大顺：脉冲消耗 1 层，使造成的伤害增加 40%。",
            upgradeText: "增幅每提升一档+0.375 倍；\n\n3/5：获得的层数根据点数增加至 1~6 层，脉冲使命中目标额外获得 200 苍木值；\n\n5/5：触发神木骰时立刻为周围敌人造成 114514 苍木伤害。",
            mechanics: ["pulse_counter"],
            params: { pulseThreshold: 6, damageBonus: stat(0.40, 0.40 * 0.375), burstDamage: 114514 }
        },
        {
            id: "wood-spirit",
            name: "木引青灵",
            element: "wood",
            fee: 4,
            baseEffectText: "自身的苍木激化触发时召唤 1 只木引青灵：持续 30 秒，每 2 秒攻击一次共 14 次，每次造成 5992 苍木伤害。",
            upgradeText: "伤害每提升一档+12.5%；\n\n3/5：木引青灵攻击时青芜浮生的冷却时间减少1秒；\n\n5/5：青芜浮生同时召唤 2 只木引青灵。",
            mechanics: ["on_wood_amplify"],
            params: { damage: stat(5992, 5992 * 0.125), duration: 30, attackInterval: 2, attacks: 14 }
        },
        {
            id: "earth-rift",
            name: "裂地崩",
            element: "wood",
            fee: 5,
            baseEffectText: "苍木树人召唤后使用一次裂地崩：对前方直线区域的所有敌人造成 207708 苍木伤害。",
            upgradeText: "伤害每提升一档+37.5%；\n\n3/5：命中的敌方受到裂地崩·回响，在 30 秒内每 1 秒受到 2887 苍木伤害；\n\n5/5：小纸人、木引青灵、苍木树人攻击带有裂地崩·回响的敌方时，立即触发一次回响。",
            mechanics: ["on_wood_summon"],
            params: { damage: stat(207708, 207708 * 0.375), echoDamage: 2887, echoDuration: 30 }
        },
        {
            id: "thunder-spear",
            name: "惊雷戟",
            element: "thunder",
            fee: 1,
            baseEffectText: "向连锁闪电命中的敌人发射惊雷戟，造成 1816 神雷伤害。",
            upgradeText: "伤害每提升一档+37.5%；\n\n3/5：惊雷戟在 8 秒内每秒造成额外神雷伤害（层数×95），可多次叠加；\n\n5/5：惊雷戟额外发射 2 次。",
            mechanics: ["on_chain_hit"],
            params: { damage: stat(1816, 1816 * 0.375), extraAtRank5: 2 }
        },
        {
            id: "thunder-shock",
            name: "雷霆震击",
            element: "thunder",
            fee: 2,
            baseEffectText: "神雷激化（敌方）生效时，每 1 秒对目标和目标周围的 1 名目标造成 1302 神雷伤害。",
            upgradeText: "伤害每提升一档+37.5%；\n\n3/5：静电震击生效频率提高 100%，并额外命中 1 名敌人；\n\n5/5：静电震击结束时发生爆炸，造成 142055 范围神雷伤害并累积 500 神雷值。",
            mechanics: ["on_thunder_amplify"],
            params: { damage: stat(1302, 1302 * 0.375), duration: 10, interval: 1, burstDamage: 142055 }
        },
        {
            id: "five-thunder-orb",
            name: "五雷珠",
            element: "thunder",
            fee: 3,
            baseEffectText: "每 20 秒向敌人发射一枚五雷珠：对路径上所有敌人造成 10832 神雷伤害。",
            upgradeText: "伤害每提升一档+37.5%；\n\n3/5：五雷珠抵达目标位置后引爆，造成 64900 神雷伤害；\n\n5/5：五雷珠释放时触发 80% 效能的狂雷（此效果无法触发静电过载）。",
            mechanics: ["periodic_attack"],
            params: { damage: stat(10832, 10832 * 0.375), interval: 20, burstDamage: 64900 }
        },
        {
            id: "thunder-guard",
            name: "天雷护佑",
            element: "thunder",
            fee: 4,
            baseEffectText: "雷佑灵光开始时，一道天雷从天而降，使自身在其持续期间（10 秒）获得天雷护佑：连锁闪电基础伤害提升 8%。",
            upgradeText: "连锁闪电伤害每提升一档+8%；\n\n3/5：持续期间职业和法宝技能造成的伤害提高5%；\n\n5/5：持续期间所有灵蕴伤害提高 70%。",
            mechanics: ["during_craft_thunder"],
            params: { chainBonus: stat(0.08, 0.08), duration: 10, externalSkillBonus: 0.05, allLinyinBonus: 0.70 }
        },
        {
            id: "nine-sky-thunder",
            name: "九霄雷动",
            element: "thunder",
            fee: 5,
            baseEffectText: "神雷激化触发时获得九霄雷动：在其后 2 秒内额外召唤 2 道雷电打击目标，每道造成 27506 神雷伤害。",
            upgradeText: "伤害每提升一档+37.5%；\n\n3/5：额外召唤 1 道雷电，并累积 100 神雷值；\n\n5/5：额外召唤 1 道雷电，且会被引雷针复制。",
            mechanics: ["on_thunder_amplify"],
            params: { damage: stat(27506, 27506 * 0.375), bolts: 2 }
        }
    ];

    const CRAFT_STONE_DEFS = [
        { id: "blazing-skyfire", name: "灼灼天炎", element: "fire", fee: 1, castTime: 5, cooldown: 120, baseEffectText: "施放 5 秒，冷却 120 秒，造成 693014 天火范围伤害。", params: { damage: 693014 } },
        { id: "frost-glory", name: "凝冰霜华", element: "ice", fee: 1, castTime: 4, cooldown: 90, baseEffectText: "施法 4 秒，冷却 90 秒，引导霜冻射线造成 495005 玄冰伤害。", params: { damage: 495005 } },
        { id: "verdant-life", name: "青芜浮生", element: "wood", fee: 1, castTime: 2, cooldown: 120, baseEffectText: "施法 2 秒，冷却 120 秒；召唤苍木树人，2.5 秒后释放冲击波造成 279561 苍木伤害，随后每 2.5 秒攻击一次，共 6 次，每次 36667 苍木伤害。", params: { damage: 279561, attackDamage: 36667, duration: 20, attackInterval: 2.5, attacks: 6 } },
        { id: "thunder-aegis", name: "雷佑灵光", element: "thunder", fee: 1, castTime: 1.3, cooldown: 60, baseEffectText: "施法 1.3 秒，造成 187960 神雷伤害；随后 10 秒内每 2 秒触发一次连锁闪电。", params: { damage: 187960, chainDuration: 10, chainInterval: 2 } }
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

    function resolveMachineStoneParams(stoneDef, rank) {
        const level = clamp(parseInt(rank, 10) || 1, 1, 5);
        return resolveValue(stoneDef.params || {}, level - 1);
    }

    function getCardDefById(id) {
        return CARD_DEFS.find(card => card.id === id) || null;
    }

    function getMachineStoneDefById(id) {
        return MACHINE_STONE_DEFS.find(stone => stone.id === id) || null;
    }

    function getCraftStoneDefById(id) {
        return CRAFT_STONE_DEFS.find(stone => stone.id === id) || null;
    }

    const api = {
        CARD_DEFS,
        MACHINE_STONE_DEFS,
        CRAFT_STONE_DEFS,
        resolveCardParams,
        resolveMachineStoneParams,
        getCardDefById,
        getMachineStoneDefById,
        getCraftStoneDefById
    };

    global.Data = api;
    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    }
})(typeof window !== "undefined" ? window : globalThis);
