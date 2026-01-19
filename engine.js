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
    constructor(lv) { super("燕虹", "Human", 1, lv); this.dmg_r = 0.28 + 0.02 * lv; this.internal_timer = 6.0;}
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
        for(let i=0; i<3; i++) {
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
            if (e.burnLayers < 12) e.burnLayers++;
            e.addEvent(EVENTS.BURN_D, 0);
        }
    }
}

class ShangGuanCe extends Card {
    constructor(lv) { super("上官策", "Human", 2, lv); this.burn_r = 0.62 - 0.02 * lv; }
    check(t) { return (t === EVENTS.ICE || t === EVENTS.ICE_D) && Math.random() >= this.burn_r; }
    trigger(e) {
        if (!e.isBurnActive || e.burnLayers === 0) { e.burnLayers = 0; e.isBurnActive = true; }
        if (e.burnLayers < 12) e.burnLayers++;
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
        if (!e.isBurnActive || e.burnLayers === 0) { e.burnLayers = 0; e.isBurnActive = true; }
        if (e.burnLayers < 12) e.burnLayers++;
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
        if (!e.isBurnActive || e.burnLayers === 0) { e.burnLayers = 0; e.isBurnActive = true; }
        if (e.burnLayers < 12) e.burnLayers++;
        e.addEvent(EVENTS.BURN, 0);
        this.internal_timer = 0;
    }
}

class SixTailedFox extends Card {
    constructor(lv) { super("六尾魔狐", "Beast", 5, lv); this.explode_timer = 1.5; this.dmg_r = 0.5 + 0.03 * lv; }
    check(t) { return t === EVENTS.TIME; }
    trigger(e) {
        if (e.burnLayers < 8) return;
        this.explode_timer = pyRound(this.explode_timer - 0.1);
        if (this.explode_timer <= 0) {
            this.explode_timer = 1.5;
            e.cardTotalDmg += (e.burnLayers * this.dmg_r * e.baseAtk);
            e.burnLayers = 0; e.isBurnActive = false; e.burnTickTimer = 0;
        }
    }
}

class SuiShou extends Card {
    constructor(lv) { super("岁兽", "Beast", 3, lv); this.burn_r = 0.3 - 0.05 * lv; }
    check(t) { return t === EVENTS.PULSE && Math.random() >= this.burn_r; }
    trigger(e) {
        for(let i=0; i<3; i++) {
            if (e.burnLayers < 12) e.burnLayers++;
            e.isBurnActive = true;
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
        e.cardTotalDmg += dmg * e.effectMod;
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
            for(let i=0; i<3; i++) {
                let d = e.baseAtk * e.pulseRate;
                e.cardTotalDmg += d * e.effectMod;
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
            if (this.shots_fired < 4 && this.timer >= 1.0) {
                this.fire(e);
                this.timer = 0.0;
            }
            if (this.shots_fired >= 4) this.is_active = false;
        }
    }
    fire(e) {
        let d = e.baseAtk * e.pulseRate * this.dmg_r;
        e.cardTotalDmg += d;
        e.addEvent(EVENTS.PULSE_D, d);
        this.shots_fired++;
    }
}

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


class ZuoGui extends Card {
    constructor(lv) {
        super("左归", "Human", 4, lv);
        this.dmg_r = 1.0 + 0.28 + 0.02 * lv;
    }
}

class RaceCombatEngine {
    constructor(deckConfig, baseAtk = 8000, baseDps = 35000) {
        this.baseAtk = baseAtk;
        this.baseDps = baseDps;
        this.time = 0.0;
        this.cardTotalDmg = 0.0;
        this.eventQueue = [];
        this.isBurnActive = false;
        this.burnLayers = 0;
        this.burnTickTimer = 0.0;

        const mapping = {
            "木剑": MuJian, "小环": XiaoHuan, "燕虹": YanHong, "周一仙": ZhouYiXian, "文敏": WenMin,
            "林峰": LinFeng, "上官策": ShangGuanCe, "左归": ZuoGui, "齐昊": QiHao,
            "猩红巨蚁": ScarletGiantAnt, "海龟": HaiGui, "猛虎": MengHu, "二尾妖狐": TwoTailedFox,
            "幽冥犬": YouMingQuan, "岁兽": SuiShou,"雪地熊": XueDiXiong, "六尾魔狐": SixTailedFox,
            "风筝": FengZheng, "折扇": ZheShan, "神木骰": ShenMuTou, "仙人布幡": XianRenBuFan,
            "寒冰箭": HanBingJian, "六合镜": LiuHeJing
        };
        this.deck = deckConfig.map(c => new (mapping[c.name] || Card)(c.level));
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
    }

    addEvent(type, dmg) { this.eventQueue.push({ type, dmg }); }

    simulate(duration) {
        let dynamicBaseBoost = 0.0;
        const steps = Math.round(duration / 0.1);

        let dpsHistory = [];

        for (let i = 0; i <= steps; i++) {
            this.time = pyRound(i * 0.1);

            // 1. 物理时间流动
            this.deck.forEach(c => c.internal_timer = pyRound(c.internal_timer + 0.1));

            let dmgBefore = this.cardTotalDmg;

            // 2. 时间触发
            this.deck.forEach(c => { if (c.check(EVENTS.TIME)) c.trigger(this, 0); });

            // 3. 链式反应
            while (this.eventQueue.length > 0) {
                const currentEvents = [...this.eventQueue];
                this.eventQueue = [];
                currentEvents.forEach(e => {
                    this.deck.forEach(c => { if (e.type !== EVENTS.TIME && c.check(e.type)) c.trigger(this, e.dmg); });
                });
            }

            // 4. 系统燃烧逻辑
            if (this.isBurnActive) {
                this.burnTickTimer = pyRound(this.burnTickTimer + 0.1);
                if (this.burnTickTimer >= 3.0) {
                    this.cardTotalDmg += (this.baseAtk * (this.burnLayers * this.burnRate)) * this.effectMod;
                    this.burnTickTimer = 0;
                }
            }

            // 5. 雪地熊动态加成 (对齐 Python 逻辑：基础 DPS 受其加成，卡牌增量也受其加成)
            const xdx = this.deck.find(c => c instanceof XueDiXiong);
            const xdxRate = xdx ? xdx.getCurrentRate() : 0;

            dynamicBaseBoost += (this.baseDps * this.passiveMod / 10 * xdxRate);
            let dmgAdd = this.cardTotalDmg - dmgBefore;
            this.cardTotalDmg += (dmgAdd * xdxRate);

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
    FengZheng, MuJian, ZheShan, HanBingJian, ShenMuTou, XianRenBuFan, LiuHeJing
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