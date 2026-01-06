import random

# Event constants
ICE = "ice"
ICE_D = "ice_d"
BURN = "burn"
BURN_D = "burn_d"
PULSE = "pulse"
PULSE_D = "pulse_d"
TIME = "time"
SNOW_MAN = "qihao"

BASE_CORE = [225, 449, 674, 898, 1123]
INCREAMENTS = [11, 22, 33, 44, 55]


class Card:
    def __init__(self, name, race, fee, level=6):
        self.name = name
        self.race = race
        self.fee = fee
        self.level = level
        self.core = BASE_CORE[fee - 1] + level * INCREAMENTS[fee - 1]
        self.internal_timer = 0.0
        self.explode_timer = 0.0

    def check(self, type):
        pass

    def trigger(self, engine, event_dmg):
        pass


class PassiveBoostCard(Card):
    """
        通用被动增益卡类。
        适用于：小环、海龟、风筝等仅提供被动数值加成的卡牌。
    """

    def __init__(self, name, race, fee, level=6):
        super().__init__(name, race, fee, level)
        self.mul = 0.0056 + 0.0004 * self.level

    def check(self, type):
        return False


class XiaoHuan(PassiveBoostCard):
    def __init__(self, level=6):
        super().__init__("小环", "Human", 1, level)


class YanHong(Card):
    def __init__(self, level=6):
        super().__init__("燕虹", "Human", 1, level)
        # 初始设为 6.0，确保进场即触发一次
        self.internal_timer = 6.0
        self.dmg_r = 0.28 + 0.02 * self.level

    def check(self, type):
        if type == TIME:
            return self.internal_timer >= 6.0
        return False

    def trigger(self, engine, _):
        self.internal_timer = 0.0  # 重置计时器
        dmg = engine.base_atk * self.dmg_r
        engine.card_total_dmg += dmg * engine.effect_mod
        engine.queue_event((ICE, dmg))


class WenMin(Card):
    def __init__(self, level=6):
        super().__init__("文敏", "Human", 2, level)
        self.trigger_interval = 16.0 - (self.level * 1.0)

    def check(self, type):
        if type != TIME:
            return False
        return self.internal_timer >= self.trigger_interval

    def trigger(self, engine, _):
        self.internal_timer = 0
        for _ in range(3):
            dmg = engine.base_atk * engine.ice_rate
            engine.card_total_dmg += dmg * engine.effect_mod
            engine.queue_event((ICE, dmg))


class QiHao(Card):
    def __init__(self, level=6):
        super().__init__("齐昊", "Human", 5, level)
        self.internal_timer = 60.0  # Starts ready or at 60s
        self.dmg_r = 1.04 + 0.06 * self.level

    def check(self, type):
        # Qi Hao triggers on TIME, but ICE events reduce his timer (CDR)
        if type == ICE or type == ICE_D:
            self.internal_timer += 1.0
            return False
        return self.internal_timer >= 60.0

    def trigger(self, engine, _):
        # Heavy burst: 10 hits
        dmg = (engine.base_atk * self.dmg_r) * 10
        engine.card_total_dmg += dmg * engine.effect_mod
        engine.queue_event((SNOW_MAN, dmg))

        self.internal_timer -= 60.0


class LinFeng(Card):
    def __init__(self, level=6):
        super().__init__("林峰", "Human", 3, level)
        self.last = ICE
        self.ice_r = 0.3 - 0.05 * self.level
        self.burn_r = 0.58 - 0.03 * self.level

    def check(self, type):
        if type == ICE:
            self.last = ICE
            return random.random() >= self.ice_r
        if type == BURN:
            self.last = BURN
            return random.random() >= self.burn_r
        return False

    def trigger(self, engine, event_dmg):
        if self.last == ICE:
            engine.card_total_dmg += event_dmg * engine.effect_mod
            engine.queue_event((ICE_D, event_dmg))
            return

        if engine.current_burn_layers < 12:
            engine.current_burn_layers += 1
        engine.queue_event((BURN_D, 0))


class ShangGuanCe(Card):
    def __init__(self, level=6):
        super().__init__("上官策", "Human", 2, level)
        self.burn_r = 0.62 - 0.02 * self.level

    def check(self, type):
        if type == ICE or type == ICE_D:
            return random.random() >= self.burn_r
        return False

    def trigger(self, engine, _):
        if not engine.is_burn_active or engine.current_burn_layers == 0:
            engine.current_burn_layers = 0
            engine.is_burn_active = True
        if engine.current_burn_layers < 12:
            engine.current_burn_layers += 1
        engine.queue_event((BURN, 0))


class HaiGui(PassiveBoostCard):
    def __init__(self, level=6):
        super().__init__("海龟", "Beast", 1, level)


class ScarletGiantAnt(Card):
    def __init__(self, level=6):
        # Passive card: sets the base burn rate and allows initial ignition.
        super().__init__("猩红巨蚁", "Beast", 1, level)
        self.internal_timer = 8.0
        self.dmg_r = 0.014 + 0.001 * self.level

    def check(self, type):
        if type != TIME:
            return False
        return self.internal_timer >= 8.0

    def trigger(self, engine, _):
        if not engine.is_burn_active or engine.current_burn_layers == 0:
            engine.current_burn_layers = 0
            engine.is_burn_active = True
        if engine.current_burn_layers < 12:
            engine.current_burn_layers += 1
        engine.queue_event((BURN, 0))
        self.internal_timer -= 8


class TwoTailedFox(Card):
    def __init__(self, level=6):
        # Triggers whenever a BURN event occurs (ignition or layer increase).
        super().__init__("二尾妖狐", "Beast", 2, level)
        self.dmg_r = 0.28 + 0.02 * self.level

    def check(self, type):
        return type == BURN or type == BURN_D

    def trigger(self, engine, _):
        # Two-Tail opening burst / response damage
        engine.card_total_dmg += (engine.base_atk * self.dmg_r)


class SixTailedFox(Card):
    def __init__(self, level=6):
        super().__init__("六尾魔狐", "Beast", 5, level)
        self.explode_timer = 1.5
        self.dmg_r = 0.5 + 0.03 * self.level

    def check(self, type):
        return type == TIME

    def trigger(self, engine, _):
        if engine.current_burn_layers < 8:
            return
        self.explode_timer -= 0.1
        if self.explode_timer <= 0:
            self.explode_timer = 1.5
            engine.card_total_dmg += (engine.current_burn_layers * self.dmg_r * engine.base_atk)
            engine.current_burn_layers = 0
            engine.burn_tick_timer = 0
            engine.is_burn_active = False


class ZuoGui(Card):
    def __init__(self, level=6):
        super().__init__("左归", "Human", 4, level)
        self.dmg_r = 1 + 0.28 + 0.02 * self.level

    def check(self, type):
        return False


class ZhouYiXian(Card):
    def __init__(self, level=6):
        super().__init__("周一仙", "Human", 2, level)
        self.mul = 0.0056 + 0.0004 * self.level

    def check(self, type):
        return False


class MengHu(Card):
    def __init__(self, level=6):
        super().__init__("猛虎", "Beast", 2, level)
        self.mul = 0.0056 + 0.0004 * self.level

    def check(self, type):
        return False


class XueDiXiong(Card):
    def __init__(self, level=6):
        super().__init__("雪地熊", "Beast", 4)
        # 存储每个 BUFF 的剩余时间：[10.0, 10.0, ...]
        self.buff_stacks = []
        self.dmg_r = 0.00038 + 0.00002 * self.level

    def check(self, type):
        # 1. 响应冰箭产生（ICE 或 ICE_D）
        if type == ICE or type == ICE_D:
            return True
        # 2. 响应时间流逝来清理过期 BUFF
        if type == TIME and self.buff_stacks:
            return True
        return False

    def trigger(self, engine, event_dmg):
        # 产生冰箭
        if event_dmg > 0:
            if len(self.buff_stacks) < 10:
                self.buff_stacks.append(engine.time + 10.0)  # 直接记下“过期时刻”

        # 时间驱动清理
        else:
            # 只在当前时间超过最老的 buff 过期时间时才清理
            # 这种写法避免了每帧去遍历修改整个列表
            while self.buff_stacks and self.buff_stacks[0] <= engine.time:
                self.buff_stacks.pop(0)

    def get_current_rate(self):
        """返回当前的伤害加成系数"""
        # 每层 0.05% -> 0.0005
        return len(self.buff_stacks) * self.dmg_r


class SuiShou(Card):
    def __init__(self, level=6):
        super().__init__("岁兽", "Beast", 3, level)
        self.burn_r = 0.3 - 0.05 * self.level

    def check(self, type):
        # 岁兽只响应脉冲命中事件
        return type == PULSE and random.random() >= self.burn_r

    def trigger(self, engine, _):
        # 脉冲命中后，100% 添加 3 层燃烧
        for _ in range(3):
            if engine.current_burn_layers < 12:
                engine.current_burn_layers += 1

            # 标记燃烧激活
            if not engine.is_burn_active:
                engine.is_burn_active = True

            # 投递 BURN 事件，触发二尾妖狐等卡牌的联动
            engine.queue_event((BURN, 0))


class FengZheng(PassiveBoostCard):
    def __init__(self, level=6):
        super().__init__("风筝", "Tool", 1, level)


class XianRenBuFan(Card):
    def __init__(self, level=6):
        super().__init__("仙人布幡", "Tool", 2, level)
        self.mul = 0.0056 + 0.0004 * self.level

    def check(self, type):
        return False


class MuJian(Card):
    def __init__(self, level=6):
        super().__init__("木剑", "Tool", 1, level)
        self.mul = 0.0056 + 0.0004 * self.level

    def check(self, type):
        return False


class ZheShan(Card):
    def __init__(self, level=6):
        super().__init__("折扇", "Tool", 1, level)
        self.dmg_r = 0.4 + 0.02 * self.level

    def check(self, type):
        if type != TIME:
            return False
        return self.internal_timer >= 15.0

    def trigger(self, engine, _):
        self.internal_timer = 0
        dmg = engine.base_atk * self.dmg_r
        engine.card_total_dmg += dmg * engine.effect_mod
        engine.queue_event((PULSE, dmg))


class ShenMuTou(Card):
    def __init__(self, level=6):
        super().__init__("神木骰", "Tool", 2, level)
        self.is_active = False
        self.duration_timer = 0.0  # 状态剩余时间
        self.first_tick = True
        self.dmg_r = 0.007 + 0.0005 * self.level

    def check(self, type):
        # 1. 响应开场第一次时间信号（用于开场3次脉冲）
        if type == TIME and self.first_tick:
            return True
        # 2. 响应脉冲信号（用于刷新状态）
        if type == PULSE:
            return True
        # 3. 响应时间信号（用于持续性掉血逻辑）
        if type == TIME and self.is_active:
            return True
        return False

    def trigger(self, engine, event_dmg):
        # 情况 A: 开场立刻触发 3 次脉冲
        if self.first_tick:
            self.first_tick = False
            for _ in range(3):
                # 投递脉冲事件，这会通过下面的 情况 B 激活/刷新神木骰状态
                dmg = engine.base_atk * engine.pulse_rate
                engine.card_total_dmg += dmg * engine.effect_mod
                engine.queue_event((PULSE, dmg))
            return

        # 情况 B: 收到脉冲信号，激活或刷新状态
        # 只要有脉冲产生，无论来源（神木骰开场、寒冰箭脉冲等），都刷新为 10 秒
        if event_dmg > 0 and (not self.is_active or self.duration_timer < 10.0):
            # 如果脉冲是由其他逻辑(如 while 循环)传来的
            # 我们通过 event_dmg 或者 engine 当前状态判定，这里简化处理：
            # 在 Engine 的 while 循环中处理 PULSE 触发时，会进入这里
            if self.duration_timer >= 0:  # 实际上是任意脉冲
                self.is_active = True
                self.duration_timer = 10.0

        # 情况 C: 时间驱动逻辑（每 0.1s 执行一次）
        elif event_dmg <= 0:
            if self.is_active:
                # 1. 结算每 0.1s 的固定伤害：0.7% 攻击力
                # 按照 100% 攻击力在 10s 内摊薄，这里直接使用 0.007 (0.7%)
                dmg = engine.base_atk * self.dmg_r
                engine.card_total_dmg += dmg

                # 2. 倒计时
                self.duration_timer = round(self.duration_timer - 0.1, 1)
                if self.duration_timer <= 0:
                    self.is_active = False
                    self.duration_timer = 0.0


class LiuHeJing(Card):
    def __init__(self, level=6):
        super().__init__("六合镜", "Tool", 5, level)
        self.is_active = False  # 是否处于4秒释放期
        self.timer = 0.0  # 倒计时计时器
        self.shots_fired = 0  # 已释放次数
        self.dmg_r = 0.7 + 0.05 * self.level

    def check(self, type):
        if type == PULSE and not self.is_active:
            return True
            # return random.random() >= 0.5

        return type == TIME and self.is_active

    def trigger(self, engine, _):
        # 情况 A: 刚刚由 PULSE 触发启动
        if not self.is_active:
            self.is_active = True
            self.timer = 0.0
            self.shots_fired = 0
            # 立即触发第 1 次
            self.fire_shot(engine)

        # 情况 B: 已经在 4 秒释放期内，由 TIME 驱动
        else:
            self.timer = round(self.timer + 0.1, 1)
            if self.shots_fired < 4 and self.timer >= 1:
                self.fire_shot(engine)
                self.timer = 0.0  # 重置间隔计时

            # 4秒时间到或4次射击完成，关闭状态
            if self.shots_fired >= 4:
                self.is_active = False

    def fire_shot(self, engine):
        """执行单次伤害结算"""
        # 此处 实际倍率为2倍
        dmg = engine.base_atk * engine.pulse_rate * self.dmg_r
        engine.card_total_dmg += dmg
        engine.queue_event((PULSE_D, dmg))
        self.shots_fired += 1


class HanBingJian(Card):
    def __init__(self, level=6):
        super().__init__("寒冰箭", "Tool", 3, level)
        self.arrow_count = 0
        self.threshold = 16 - self.level

    def check(self, type):
        # 寒冰箭通常由 ICE 事件或特定冰系事件驱动
        # 假设只要产生 ICE 伤害，就视为发射了一根寒冰箭
        return type == ICE or type == ICE_D

    def trigger(self, engine, _):
        self.arrow_count += 1

        # 当累积到 10 根时
        if self.arrow_count >= self.threshold:
            self.arrow_count = 0  # 计数清零
            dmg = engine.base_atk * engine.pulse_rate
            engine.card_total_dmg += dmg * engine.effect_mod
            engine.queue_event((PULSE, dmg))


# --- The Refactored Engine ---0

class RaceCombatEngine:
    def __init__(self, deck, base_atk=8000.0, base_dps=35000.0):
        self.deck = deck
        self.total_core = sum(c.core for c in deck)
        self.base_atk = base_atk
        self.base_dps = base_dps
        self.card_total_dmg = 0.0
        self.time = 0.0

        # State Variables
        self.burn_tick_timer = 0
        self.is_burn_active = False
        self.current_burn_layers = 0

        # Buff/Mod Pre-calc
        yan = self.get_card("燕虹")
        zuo = self.get_card("左归")
        mu = self.get_card("木剑")
        yi = self.get_card("猩红巨蚁")
        shan = self.get_card("折扇")

        self.effect_mod = 1.0 if not zuo else zuo.dmg_r
        self.core_mod = 1.0 if not mu else 1 + mu.mul

        self.passive_mod = 1.0
        # 遍历所有被动卡累加 mul (包含小环、海龟、风筝)
        for card in self.deck:
            if isinstance(card, PassiveBoostCard):
                self.passive_mod += card.mul

        self.ice_rate = 0.26 if not yan else yan.dmg_r
        self.burn_rate = 0.013 if not yi else yi.dmg_r
        self.pulse_rate = 0.38 if not shan else shan.dmg_r

        h_count = sum(1 for c in deck if c.race == "Human")
        b_count = sum(1 for c in deck if c.race == "Beast")
        t_count = sum(1 for c in deck if c.race == "Tool")

        self.atk_mul = 1.0
        # 兼容旧代码种族判定
        for card_name, race_cnt in [("周一仙", h_count), ("猛虎", b_count), ("仙人布幡", t_count)]:
            c = self.get_card(card_name)
            if c: self.atk_mul += race_cnt * c.mul

        self.event_queue = []

    def has_card(self, name):
        return any(c.name == name for c in self.deck)

    def get_card(self, name):
        for c in self.deck:
            if c.name == name:
                return c
        return None

    def queue_event(self, event):
        self.event_queue.append(event)

    def get_dynamic_rate(self):
        xdx_rate = 0.0
        for c in self.deck:
            if isinstance(c, XueDiXiong):
                xdx_rate += c.get_current_rate()
                break
        return xdx_rate

    def run_tick(self):
        # 1. 每一帧物理时间流动
        for card in self.deck:
            # 只有那些在 check(TIME) 里判定计时器的卡才需要在此累加
            card.internal_timer = round(card.internal_timer + 0.1, 1)

        # 2. 核心：处理时间触发 (只扫一遍，不进队列)
        for card in self.deck:
            if card.check(TIME):
                card.trigger(self, 0)

        # 3. 核心：处理链式反应 (ICE -> BURN 等)
        while len(self.event_queue) > 0:
            current_events = self.event_queue[:]
            self.event_queue = []  # 立即清空，用于接收下一级触发

            for e_type, e_dmg in current_events:
                for card in self.deck:
                    if e_type != TIME and card.check(e_type):
                        card.trigger(self, e_dmg)

        self.process_system_logic()

    def process_system_logic(self):
        # Handle Natural Burn Growth & Ticks (simplified for brevity)
        if self.is_burn_active:
            self.burn_tick_timer = round(self.burn_tick_timer + 0.1, 1)
            if self.burn_tick_timer >= 3.0:
                self.card_total_dmg += ((self.base_atk * (
                        self.current_burn_layers * self.burn_rate)) * self.effect_mod)
                self.burn_tick_timer = 0

    def simulate(self, time_limit):
        while self.time <= time_limit:
            dmg_before = self.card_total_dmg
            self.run_tick()
            self.time = round(self.time + 0.1, 1)
            # 每0.1s的 丹青伤害 和 秒伤 乘以雪地熊系数
            dmg_add = self.card_total_dmg - dmg_before
            xdx_rate = self.get_dynamic_rate()
            self.card_total_dmg += (dmg_add * xdx_rate) + (self.base_dps * self.passive_mod / 10 * xdx_rate)

        # PassiveBoostCard的加成 作用于基础秒伤
        base_atk_dmg = self.base_dps * self.time * self.passive_mod
        core_inc_benefit = (base_atk_dmg + self.card_total_dmg) * (self.total_core / 5.0 / self.base_atk)
        mul_benefit = (base_atk_dmg + self.card_total_dmg + core_inc_benefit) * (self.core_mod * self.atk_mul - 1)
        return self.card_total_dmg + core_inc_benefit + mul_benefit


if __name__ == "__main__":
    my_deck = [
        # ScarletGiantAnt(),
        YanHong(),
        WenMin(),
        # LinFeng(3),
        # ZhouYiXian(5),
        # ShangGuanCe(),
        # TwoTailedFox(),
        # SixTailedFox(),
        # XueDiXiong(),
        QiHao(1),
        # ZheShan(),
        # LiuHeJing(),
        # ShenMuTou(),
    ]

    # Initialize the new Reactive Engine
    engine = RaceCombatEngine(my_deck)
    TIME_LIMIT = 180.0

    total_dmg = engine.simulate(TIME_LIMIT)
    print(f"Total Damage: {total_dmg}")
    print(f"Actual DPS: {total_dmg / TIME_LIMIT}")
