import streamlit as st
from card_engine_v2 import *

# ======================================================
# 1. 页面配置与全局样式
# ======================================================
st.set_page_config(page_title="丹青模拟器", layout="wide")

st.markdown("""
<style>
/* --- 卡牌按钮样式 --- */
.stButton > button {
    width: 100%;
    height: 65px;
    border-radius: 8px;
    border: 2px solid #eee;
    background-color: #fff;
    font-weight: 600;
    margin-bottom: 0px;
}

/* --- 进度条区域留白与伪装 --- */
/* 强制隐藏 Slider 的所有原生 UI 元素，只留下轨道 */
div[data-testid="stSlider"] > label { display: none; } /* 隐藏标题 */
div[data-testid="stSlider"] [data-testid="stTickBar"] { display: none; } /* 隐藏刻度 */
div[data-testid="stSlider"] [data-baseweb="slider"] { 
    padding: 0 5px; 
    height: 20px; 
}

/* 修改轨道样式 */
div[data-testid="stSlider"] [data-testid="stSliderTickBar"] { display: none; }
div[data-testid="stSlider"] [role="slider"] { 
    width: 12px; 
    height: 12px; 
    background-color: #ff4b4b; 
    border: 2px solid white;
    box-shadow: 0 0 2px rgba(0,0,0,0.2);
}

/* 进度条文字 */
.star-hint {
    font-size: 11px;
    color: #ff4b4b;
    font-weight: 700;
    text-align: right;
    margin-top: -12px;
    padding-right: 5px;
}

/* 留白容器 */
.spacer-box {
    height: 52px;
    width: 100%;
}

/* --- 自定义“开始模拟”按钮样式 --- */
/* 锁定 type="primary" 的按钮进行样式覆盖 */
div[data-testid="stButton"] button[kind="primary"] {
    background-color: #e0e0e0 !important; /* 浅灰色底 */
    color: #1a1a1a !important;           /* 黑色字体 */
    border: 1px solid #cccccc !important;
    font-size: 18px !important;
    font-weight: 700 !important;
    transition: all 0.3s ease;
}

/* 悬停效果：颜色稍微加深，并增加阴影 */
div[data-testid="stButton"] button[kind="primary"]:hover {
    background-color: #d0d0d0 !important;
    border-color: #999999 !important;
    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
}

/* 点击激活效果 */
div[data-testid="stButton"] button[kind="primary"]:active {
    transform: scale(0.98);
}

/* --- DPS 数字变红 --- */
/* 针对 st.metric 的数值部分进行染色 */
div[data-testid="stMetricValue"] {
    color: #ff4b4b !important;
    font-size: 32px !important;
    font-weight: 800 !important;
}

/* --- 左侧边栏字体放大 --- */
/* 放大侧边栏所有文本、输入框标签和按钮 */
section[data-testid="stSidebar"] .stWidgetLabel p {
    font-size: 1.1rem !important; /* 标签字体 */
    font-weight: 600 !important;
}

section[data-testid="stSidebar"] .stNumberInput input {
    font-size: 1.2rem !important; /* 输入框内的数字 */
}

section[data-testid="stSidebar"] button p {
    font-size: 1.1rem !important; /* 侧边栏按钮文字 */
}

/* 侧边栏标题单独加粗加大 */
section[data-testid="stSidebar"] h1, 
section[data-testid="stSidebar"] h2, 
section[data-testid="stSidebar"] h3 {
    font-size: 1.5rem !important;
}
</style>
""", unsafe_allow_html=True)


# ======================================================
# 2. 数据与逻辑
# ======================================================
def get_lib():
    return {
        "人族": [("小环", XiaoHuan), ("燕虹", YanHong), ("周一仙", ZhouYiXian), ("文敏", WenMin),
               ("上官策", ShangGuanCe), ("林峰", LinFeng), ("左归", ZuoGui), ("齐昊", QiHao)],
        "兽族": [("猩红巨蚁", ScarletGiantAnt), ("猛虎", MengHu), ("二尾妖狐", TwoTailedFox),
               ("岁兽", SuiShou), ("雪地熊", XueDiXiong), ("六尾魔狐", SixTailedFox)],
        "器族": [("木剑", MuJian), ("折扇", ZheShan), ("仙人布幡", XianRenBuFan),
               ("神木骰", ShenMuTou), ("寒冰箭", HanBingJian), ("六合镜", LiuHeJing)]
    }


library = get_lib()

if "deck_state" not in st.session_state:
    st.session_state.deck_state = {
        name: {"selected": False, "level": 6}
        for cat in library.values() for name, _ in cat
    }

# ======================================================
# 3. 顶部 UI 状态
# ======================================================
final_deck = []
total_fee = 0
for cat in library.values():
    for name, cls in cat:
        state = st.session_state.deck_state[name]
        if state["selected"]:
            inst = cls(level=state["level"])
            final_deck.append(inst)
            total_fee += inst.fee

t1, t2 = st.columns([3, 1])
with t1:
    st.title("🎴 丹青模拟器")
    f_color = "#28a745" if total_fee <= 25 else "#ff4b4b"
    st.markdown(f"### 当前费用: <span style='color:{f_color}'>{total_fee} / 25</span>", unsafe_allow_html=True)

with t2:
    st.write("##")
    start_sim = st.button("🚀 开始模拟", type="primary", use_container_width=True)

st.divider()

# ======================================================
# 4. 主渲染区
# ======================================================
# ======================================================
# 4. 主渲染区
# ======================================================
# l_col, r_col = st.columns([2.5, 1.2])
l_col, gap_col, r_col = st.columns([3, 0.25, 2])
with l_col:
    for cat_name, cards in library.items():
        st.subheader(cat_name)
        cols = st.columns(4)
        for i, (name, cls) in enumerate(cards):
            state = st.session_state.deck_state[name]

            # --- 新增逻辑：获取卡牌费用 ---
            # 实例化一个临时对象以读取其费用属性（level不影响基础费用，传6即可）
            temp_inst = cls(level=6)
            card_fee = temp_inst.fee

            with cols[i % 4]:
                # 1. 选卡按钮 - 修改 label 拼接方式
                prefix = "✅ " if state['selected'] else ""
                btn_label = f"{prefix}{name} ({card_fee}费)"

                if st.button(btn_label, key=f"btn_{name}", use_container_width=True):
                    state["selected"] = not state["selected"]
                    st.rerun()

                # 2. 进度条/留白区域 (保持不变)
                if state["selected"]:
                    new_lvl = st.select_slider(
                        f"star_{name}",
                        options=list(range(7)),
                        value=state["level"],
                        key=f"slider_{name}",
                        label_visibility="collapsed"
                    )
                    if new_lvl != state["level"]:
                        state["level"] = new_lvl
                        st.rerun()

                    st.markdown(f'<div class="star-hint">{state["level"]}★</div>', unsafe_allow_html=True)
                else:
                    st.markdown('<div class="spacer-box"></div>', unsafe_allow_html=True)

# --- 左侧面板 ---
with st.sidebar:
    st.header("⚙️ 基础设置")
    base_atk = st.number_input("基础攻击力", value=8000, step=100)
    base_dps = st.number_input("初始秒伤", value=35000, step=1000)
    sim_time = st.slider("模拟时长 (s)", 30, 500, 180)

    st.divider()
    st.subheader("🛠️ 批量操作")

    if st.button("🧹 一键清空卡组", use_container_width=True):
        for v in st.session_state.deck_state.values():
            v["selected"] = False
        st.rerun()

    st.write("统一修改已选卡牌星级：")
    cols = st.columns(7)
    for i in range(7):
        if cols[i].button(f"{i}★", use_container_width=True):
            for v in st.session_state.deck_state.values():
                if v["selected"]:
                    v["level"] = i
            st.rerun()

with r_col:
    st.subheader("📊 模拟结果")
    if start_sim:
        if not final_deck:
            st.warning("请选择卡牌")
        elif total_fee > 25:
            st.error("费用超限！")
        else:
            engine = RaceCombatEngine(final_deck, base_dps=base_dps, base_atk=base_atk)
            res = engine.simulate(float(sim_time))
            # 这里的数字会因为 CSS 自动变成红色
            st.metric("预估最终 DPS", f"{res / sim_time:,.0f}")
            st.caption(f"总伤害量: {res:,.0f}")