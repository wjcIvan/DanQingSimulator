/**
 * 丹青模拟器核心引擎 - JS/Python 逻辑完全同步版
 */

const EVENTS = {
    ICE: "ice", ICE_D: "ice_d",
    BURN: "burn", BURN_D: "burn_d",
    PULSE: "pulse", PULSE_D: "pulse_d",
    TIME: "time", SNOW_MAN: "qihao"
};

const BASE_CORE = [225, 449, 674, 898, 1123];
const INCREMENTS = [11, 22, 33, 44, 55];

const pyRound = (val) => Math.round(val * 10) / 10;

const ALL_CARD_CLASSES = [];

class Card {
    constructor(name, race, fee, level = 6) {
        this.name = name;
        this.race = race;
        this.fee = fee;
        this.level = level;
        this.core = BASE_CORE[fee - 1] + level * INCREMENTS[fee - 1];
        this.internal_timer = 0.0;
    }
    check(type) { return false; }
    trigger(engine, event_dmg = 0) { return 0; }
}

// --- 1. 人族 (Human) ---
class YanHong extends Card {
    constructor(lv) { super("燕虹", "Human", 1, lv); this.dmg_r = 0.28 + 0.02 * lv; this.internal_timer = 6.0; }
    check(t) { return t === EVENTS.TIME && this.internal_timer >= 6.0; }
    trigger(e) {
        this.internal_timer = 0.0;
        let dmg = e.baseAtk * this.dmg_r;
        e.cardTotalDmg += dmg * e.effectMod;
        e.addEvent(EVENTS.ICE, dmg);
    }
}

class WenMin extends Card {
    constructor(lv) { super("文敏", "Human", 2, lv); this.trigger_interval = 16.0 - (lv * 1.0); }
    check(t) { return t === EVENTS.TIME && this.internal_timer >= this.trigger_interval; }
    trigger(e) {
        this.internal_timer = 0;
        for (let i = 0; i < 3; i++) {
            let d = e.baseAtk * e.iceRate;
            e.cardTotalDmg += d * e.effectMod;
            e.addEvent(EVENTS.ICE, d);
        }
    }
}

class QiHao extends Card {
    constructor(lv) {
        super("齐昊", "Human", 5, lv);
        this.internal_timer = 60.0;
        this.dmg_r = 1.04 + 0.06 * lv;
    }

    check(t) {
        if (t === EVENTS.ICE || t === EVENTS.ICE_D) {
            this.internal_timer += 1.0;
            return false;
        }
        return t === EVENTS.TIME && this.internal_timer >= 60.0;
    }

    trigger(e) {
        let dmg = (e.baseAtk * this.dmg_r) * 10;
        e.cardTotalDmg += dmg * e.effectMod;
        e.addEvent(EVENTS.SNOW_MAN, dmg);
        this.internal_timer -= 60.0;
    }
}

class LinFeng extends Card {
    constructor(lv) {
        super("林峰", "Human", 3, lv);
        this.ice_r = 0.3 - 0.05 * lv;
        this.burn_r = 0.58 - 0.03 * lv;
        this.lastType = EVENTS.ICE;
    }
    check(t) {
        if (t === EVENTS.ICE) { this.lastType = EVENTS.ICE; return Math.random() >= this.ice_r; }
        if (t === EVENTS.BURN) { this.lastType = EVENTS.BURN; return Math.random() >= this.burn_r; }
        return false;
    }
    trigger(e, event_dmg) {
        if (this.lastType === EVENTS.ICE) {
            e.cardTotalDmg += event_dmg * e.effectMod;
            e.addEvent(EVENTS.ICE_D, event_dmg);
        } else {
            e.addBurnLayer(false);
            e.addEvent(EVENTS.BURN_D, 0);
        }
    }
}

class ShangGuanCe extends Card {
    constructor(lv) { super("上官策", "Human", 2, lv); this.burn_r = 0.62 - 0.02 * lv; }
    check(t) { return (t === EVENTS.ICE || t === EVENTS.ICE_D) && Math.random() >= this.burn_r; }
    trigger(e) {
        e.addBurnLayer(false);
        e.addEvent(EVENTS.BURN, 0);
    }
}

// --- 2. 兽族 (Beast) ---
class XueDiXiong extends Card {
    constructor(lv) { super("雪地熊", "Beast", 4, lv); this.buff_stacks = []; this.dmg_r = 0.00038 + 0.00002 * lv; }
    check(t) {
        if (t === EVENTS.ICE || t === EVENTS.ICE_D) return true;
        if (t === EVENTS.TIME && this.buff_stacks.length > 0) return true;
        return false;
    }
    trigger(e, event_dmg) {
        if (event_dmg > 0) {
            if (this.buff_stacks.length < 10) this.buff_stacks.push(pyRound(e.time + 10.0));
        } else {
            // 时间驱动清理：只清理当前时间已经到达或超过过期时间的 buff
            while (this.buff_stacks.length > 0 && this.buff_stacks[0] <= e.time) {
                this.buff_stacks.shift();
            }
        }
    }
    getCurrentRate() { return this.buff_stacks.length * this.dmg_r; }
}

class ScarletGiantAnt extends Card {
    constructor(lv) { super("猩红巨蚁", "Beast", 1, lv); this.internal_timer = 8.0; this.dmg_r = 0.014 + 0.001 * lv; }
    check(t) { return t === EVENTS.TIME && this.internal_timer >= 8.0; }
    trigger(e) {
        e.addBurnLayer(true);
        e.addEvent(EVENTS.BURN, 0);
        this.internal_timer = 0;
    }
}

class TwoTailedFox extends Card {
    constructor(lv) { super("二尾妖狐", "Beast", 2, lv); this.dmg_r = 0.28 + 0.02 * lv; }
    check(t) { return t === EVENTS.BURN || t === EVENTS.BURN_D; }
    trigger(e) { e.cardTotalDmg += (e.baseAtk * this.dmg_r); }
}

class YouMingQuan extends Card {
    constructor(lv) {
        super("幽冥犬", "Beast", 2, lv);
        this.trigger_interval = 10.0 - (lv * 1.0);
        this.internal_timer = this.trigger_interval;
    }
    check(t) {
        return t === EVENTS.TIME && this.internal_timer >= this.trigger_interval;
    }
    trigger(e) {
        e.addBurnLayer(true);
        e.addEvent(EVENTS.BURN, 0);
        this.internal_timer = 0;
    }
}

class SixTailedFox extends Card {
    constructor(lv) {
        super("六尾魔狐", "Beast", 5, lv);
        this.dmg_r = 0.5 + 0.03 * lv;
    }
    check(t) { return t === EVENTS.TIME; }
    trigger(e) {
        // 遍历每个目标，独立处理倒计时
        e.targets.forEach(target => {
            // 检查该目标是否达到8层
            if (target.burnLayers >= 8) {
                // 如果该目标还没有启动倒计时，启动它
                if (target.explodeTimer < 0) {
                    target.explodeTimer = 1.5;
                }

                // 倒计时
                target.explodeTimer = pyRound(target.explodeTimer - 0.1);

                // 倒计时结束，引爆该目标
                if (target.explodeTimer <= 0) {
                    // 引爆该目标的燃烧层数，对该目标和周围敌人造成伤害
                    const explodeDmg = target.burnLayers * this.dmg_r * e.baseAtk * e.targetCount;
                    e.cardTotalDmg += explodeDmg;
                    // 清空该目标的燃烧状态（包括重置计时器）
                    target.clearBurn();
                }
            } else {
                // 目标层数不足8层，重置该目标的倒计时
                target.explodeTimer = -1;
            }
        });
    }
}

class SuiShou extends Card {
    constructor(lv) { super("岁兽", "Beast", 3, lv); this.burn_r = 0.3 - 0.05 * lv; }
    check(t) { return t === EVENTS.PULSE && Math.random() >= this.burn_r; }
    trigger(e) {
        for (let i = 0; i < 3; i++) {
            e.addBurnLayer(true);
            e.addEvent(EVENTS.BURN, 0);
        }
    }
}

// --- 3. 器族 (Tool) ---
class MuJian extends Card {
    constructor(lv) {
        super("木剑", "Tool", 1, lv);
        this.mul = 0.0056 + 0.0004 * lv
    }
}

class ZheShan extends Card {
    constructor(lv) { super("折扇", "Tool", 1, lv); this.dmg_r = 0.4 + 0.02 * lv; }
    check(t) { return t === EVENTS.TIME && this.internal_timer >= 15.0; }
    trigger(e) {
        this.internal_timer = 0;
        let dmg = e.baseAtk * this.dmg_r;
        e.cardTotalDmg += dmg * e.effectMod * e.targetCount;
        e.addEvent(EVENTS.PULSE, dmg);
    }
}

class HanBingJian extends Card {
    constructor(lv) { super("寒冰箭", "Tool", 3, lv); this.arrow_count = 0; this.threshold = 16 - lv; }
    check(t) { return t === EVENTS.ICE || t === EVENTS.ICE_D; }
    trigger(e) {
        this.arrow_count++;
        if (this.arrow_count >= this.threshold) {
            this.arrow_count = 0;
            let d = e.baseAtk * e.pulseRate;
            e.cardTotalDmg += d * e.effectMod;
            e.addEvent(EVENTS.PULSE, d);
        }
    }
}

class ShenMuTou extends Card {
    constructor(lv) { super("神木骰", "Tool", 2, lv); this.is_active = false; this.duration_timer = 0.0; this.first_tick = true; this.dmg_r = 0.007 + 0.0005 * lv; }
    check(t) {
        if (t === EVENTS.TIME && (this.first_tick || this.is_active)) return true;
        if (t === EVENTS.PULSE) return true;
        return false;
    }
    trigger(e, event_dmg) {
        if (this.first_tick) {
            this.first_tick = false;
            for (let i = 0; i < 3; i++) {
                let d = e.baseAtk * e.pulseRate;
                e.cardTotalDmg += d * e.effectMod * e.targetCount;
                e.addEvent(EVENTS.PULSE, d);
            }
            return;
        }
        if (event_dmg > 0) {
            this.is_active = true;
            this.duration_timer = 10.0;
        } else if (this.is_active) {
            e.cardTotalDmg += e.baseAtk * this.dmg_r;
            this.duration_timer = pyRound(this.duration_timer - 0.1);
            if (this.duration_timer <= 0) {
                this.is_active = false;
                this.duration_timer = 0.0;
            }
        }
    }
}

class LiuHeJing extends Card {
    constructor(lv) { super("六合镜", "Tool", 5, lv); this.is_active = false; this.timer = 0.0; this.shots_fired = 0; this.dmg_r = 0.7 + 0.05 * lv; }
    check(t) { return (t === EVENTS.PULSE && !this.is_active) || (t === EVENTS.TIME && this.is_active); }
    trigger(e) {
        if (!this.is_active) {
            this.is_active = true; this.timer = 0.0; this.shots_fired = 0;
            this.fire(e);
        } else {
            this.timer = pyRound(this.timer + 0.1);
            if (this.shots_fired < 6 && this.timer >= 1.0) {
                this.fire(e);
                this.timer = 0.0;
            }
            if (this.shots_fired >= 6) this.is_active = false;
        }
    }
    fire(e) {
        let d = e.baseAtk * e.pulseRate * this.dmg_r;
        e.cardTotalDmg += d * e.targetCount;
        e.addEvent(EVENTS.PULSE_D, d);
        this.shots_fired++;
    }
}

const QingLiangZhu = class extends Card {
    constructor(lv) { super("清凉珠", "Tool", 3, lv); }
};

// --- 被动类 ---
class PassiveBoostCard extends Card {
    constructor(name, race, fee, level) {
        super(name, race, fee, level);
        this.mul = 0.0056 + 0.0004 * level;
    }
}

const XiaoHuan = class extends PassiveBoostCard { constructor(lv) { super("小环", "Human", 1, lv); } };
const HaiGui = class extends PassiveBoostCard { constructor(lv) { super("海龟", "Beast", 1, lv); } };
const FengZheng = class extends PassiveBoostCard { constructor(lv) { super("风筝", "Tool", 1, lv); } };

const ZhouYiXian = class extends PassiveBoostCard { constructor(lv) { super("周一仙", "Human", 2, lv); } };
const MengHu = class extends PassiveBoostCard { constructor(lv) { super("猛虎", "Beast", 2, lv); } };
const XianRenBuFan = class extends PassiveBoostCard { constructor(lv) { super("仙人布幡", "Tool", 2, lv); } };

// --- Target 类：每个目标的独立状态 ---
class Target {
    constructor(index) {
        this.index = index; // 0 = 主目标, 1+ = 副目标
        this.isBurnActive = false;
        this.burnLayers = 0;
        this.burnTickTimer = 0.0;
        this.explodeTimer = -1; // 六尾爆炸计时器，-1表示未激活
    }

    addBurnLayer() {
        this.isBurnActive = true;
        if (this.burnLayers < 12) this.burnLayers++;
    }

    clearBurn() {
        this.isBurnActive = false;
        this.burnLayers = 0;
        this.burnTickTimer = 0.0;
        this.explodeTimer = -1; // 清空时也重置爆炸计时器
    }
}

class ZuoGui extends Card {
    constructor(lv) {
        super("左归", "Human", 4, lv);
        this.dmg_r = 1.0 + 0.28 + 0.02 * lv;
    }
}

class RaceCombatEngine {
    constructor(deckConfig, baseAtk = 8000, baseDps = 35000, targetCount = 1) {
        this.baseAtk = baseAtk;
        this.baseDps = baseDps;
        this.targetCount = targetCount;
        this.time = 0.0;
        this.cardTotalDmg = 0.0;
        this.eventQueue = [];

        // 创建目标数组，每个目标独立状态
        this.targets = [];
        for (let i = 0; i < targetCount; i++) {
            this.targets.push(new Target(i));
        }

        this.deck = deckConfig;
        this.initModifiers();
    }

    initModifiers() {
        const getC = (n) => this.deck.find(c => c.name === n);
        const zuo = getC("左归");
        this.effectMod = zuo ? zuo.dmg_r : 1.0;

        const mu = getC("木剑");
        this.muMod = mu ? (1 + mu.mul) : 1.0;

        // 识别所有 PassiveBoostCard
        this.passiveMod = 1.0;
        this.deck.forEach(c => {
            if (c instanceof PassiveBoostCard || ["小环", "海龟", "风筝"].includes(c.name)) {
                this.passiveMod += c.mul;
            }
        });

        const counts = { Human: 0, Beast: 0, Tool: 0 };
        this.deck.forEach(c => counts[c.race]++);

        this.atkMul = 1.0;
        const zyx = getC("周一仙"); if (zyx) this.atkMul += counts.Human * zyx.mul;
        const tiger = getC("猛虎"); if (tiger) this.atkMul += counts.Beast * tiger.mul;
        const fan = getC("仙人布幡"); if (fan) this.atkMul += counts.Tool * fan.mul;

        const yan = getC("燕虹"); this.iceRate = yan ? yan.dmg_r : 0.26;
        const ant = getC("猩红巨蚁"); this.burnRate = ant ? ant.dmg_r : 0.013;
        const shan = getC("折扇"); this.pulseRate = shan ? shan.dmg_r : 0.38;

        // 【优化】筛选活动卡
        this.activeCards = this.deck.filter(c => {
            return c.check !== Card.prototype.check || (c instanceof XueDiXiong);
        });

        // 【优化】缓存雪地熊引用
        this.xdxRef = this.deck.find(c => c instanceof XueDiXiong);
    }

    // 辅助方法：增加燃烧层数
    addBurnLayer(isAOE) {
        if (isAOE) {
            for (let i = 0; i < this.targets.length; i++) this.targets[i].addBurnLayer();
        } else {
            this.targets[0].addBurnLayer();
        }
    }

    addEvent(type, dmg) { this.eventQueue.push({ type, dmg }); }

    simulate(duration) {
        let dynamicBaseBoost = 0.0;
        const steps = Math.round(duration / 0.1);
        const dpsHistory = [];

        for (let i = 0; i <= steps; i++) {
            this.time = pyRound(i * 0.1);
            let dmgBefore = this.cardTotalDmg;

            // 1. 系统时间驱动 + 计时器更新
            for (let j = 0; j < this.activeCards.length; j++) {
                const c = this.activeCards[j];
                c.internal_timer = pyRound(c.internal_timer + 0.1);
                if (c.check(EVENTS.TIME)) c.trigger(this, 0);
            }

            // 2. 消费事件队列
            while (this.eventQueue.length > 0) {
                const e = this.eventQueue.shift();
                if (e.type === EVENTS.TIME) continue;
                for (let j = 0; j < this.activeCards.length; j++) {
                    const c = this.activeCards[j];
                    if (c.check(e.type)) c.trigger(this, e.dmg);
                }
            }

            // 3. 系统燃烧逻辑
            for (let j = 0; j < this.targets.length; j++) {
                const target = this.targets[j];
                if (target.isBurnActive) {
                    target.burnTickTimer = pyRound(target.burnTickTimer + 0.1);
                    if (target.burnTickTimer >= 3.0) {
                        this.cardTotalDmg += (target.burnLayers * this.baseAtk * this.burnRate * this.effectMod);
                        target.burnTickTimer = 0;
                    }
                }
            }

            // 4. 雪地熊动态加成 (逻辑对齐：由于雪地熊是活动卡，其 Buff 状态已在 activeCards 循环中更新)
            if (this.xdxRef) {
                const xdxRate = this.xdxRef.getCurrentRate();
                dynamicBaseBoost += (this.baseDps * this.passiveMod / 10 * xdxRate);
                let dmgAdd = this.cardTotalDmg - dmgBefore;
                this.cardTotalDmg += (dmgAdd * xdxRate);
            }

            if (i % 10 === 0 && i > 0) {
                const currentRes = this.finalize(this.time, dynamicBaseBoost);
                dpsHistory.push(currentRes.total);
            }
        }

        const finalRes = this.finalize(duration, dynamicBaseBoost);
        finalRes.dpsHistory = dpsHistory;
        return finalRes;
    }

    finalize(duration, dynamicBaseBoost) {
        const totalCore = this.deck.reduce((s, c) => s + c.core, 0);
        const coreIncPct = (totalCore * 1.04) / 5.0 / this.baseAtk;
        const totalMulMod = this.muMod * this.atkMul;

        const absoluteRawTotal = this.baseDps * duration;
        const passiveCardInc = absoluteRawTotal * (this.passiveMod - 1.0);

        const baseWithPassiveAndDynamic = absoluteRawTotal + passiveCardInc + dynamicBaseBoost;
        const coreIncOnBase = baseWithPassiveAndDynamic * coreIncPct;
        const mulIncOnBase = (baseWithPassiveAndDynamic + coreIncOnBase) * (totalMulMod - 1.0);

        const skillFinal = this.cardTotalDmg * (1 + coreIncPct) * totalMulMod;

        const finalTotalDmg = (baseWithPassiveAndDynamic + coreIncOnBase + mulIncOnBase + skillFinal);

        return {
            total: Math.round((finalTotalDmg / duration) * 100) / 100,
            card_dps: Math.round((skillFinal / duration) * 100) / 100,
            boost_dps: Math.round(((finalTotalDmg - absoluteRawTotal - skillFinal) / duration) * 100) / 100,
            raw_base_dps: this.baseDps
        };
    }

}

ALL_CARD_CLASSES.push(
    XiaoHuan, YanHong, WenMin, ZhouYiXian, ZuoGui, QiHao, LinFeng, ShangGuanCe,
    HaiGui, MengHu, XueDiXiong, ScarletGiantAnt, TwoTailedFox, YouMingQuan, SixTailedFox, SuiShou,
    FengZheng, MuJian, ZheShan, HanBingJian, ShenMuTou, XianRenBuFan, QingLiangZhu, LiuHeJing
);

/**
 * 自动转换类引用为 UI 所需的元数据，并排序
 */
function getSortedCardDatabase() {
    return ALL_CARD_CLASSES.map(Cls => {
        const sample = new Cls(6); // 实例化一个样本获取元数据
        return {
            className: Cls.name,
            name: sample.name,
            fee: sample.fee,
            race: sample.race,
            classRef: Cls
        };
    }).sort((a, b) => a.fee - b.fee || a.name.localeCompare(a.name));
}

// 导出全局供 HTML 使用
window.CARD_DATABASE = getSortedCardDatabase();

window.CARD_NAME_MAP = Object.fromEntries(
    window.CARD_DATABASE.map(c => [c.className, c.name])
);