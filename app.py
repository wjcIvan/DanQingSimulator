import streamlit as st
from card_engine_v2 import *
import pandas as pd

# ======================================================
# 1. 页面配置与全局样式
# ======================================================
st.set_page_config(page_title="丹青模拟器", layout="wide")

st.markdown("""
<style>

/* 1. 顶部按钮对齐：替代 st.write("##") 防止抖动 */
div[data-testid="stButton"] button[kind="primary"] {
    margin-top: 42px !important;
}
/* 阻止页面自动滚动和溢出抖动 */
html, body, [data-testid="stAppViewContainer"] {
    scroll-behavior: auto !important;
    overflow-anchor: none !important;
}

/* 隐藏 Streamlit 自带的加载微调器，避免其撑开布局 */
[data-testid="stStatusWidget"] {
    display: none !important;
}
/* --- 新增：全局禁用光标和文字选择 --- */
html, body, [data-testid="stAppViewContainer"] {
    -webkit-user-select: none; 
    -ms-user-select: none; 
    user-select: none;
    cursor: default;
}

/* 保持输入框正常使用 */
input, [data-testid="stNumberInput"] {
    user-select: text !important;
}
/* --- 隐藏标题后的锚点链接图标 --- */
[data-testid="stHeaderActionElements"] {
    display: none !important;
}

/* 针对较旧版本 Streamlit 的兼容处理 */
.viewerBadge_container__1QSob, .st-emotion-cache-15zrgzn {
    display: none !important;
}
/* --- 移除顶部空白 --- */
.block-container {
    padding-top: 1rem !important;    /* 主容器顶部内边距 */
    padding-bottom: 0rem !important;
    padding-left: 5rem !important;
    padding-right: 5rem !important;
}

header {
    visibility: hidden;              /* 隐藏顶部装饰横条 */
    height: 0px !important;
}

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
div[data-testid="stMainBlockContainer"] div[data-testid="stSliderThumbValue"] {
    display: none !important;
}

div[data-testid="stSlider"] [data-baseweb="slider"] { 
    padding: 0 5px; 
    height: 10px; 
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
    font-size: 16px;
    color: #ff4b4b;
    font-weight: 700;
    text-align: right;
    margin-top: -40px;
    padding-right: 5px;
}

/* 留白容器 */
.spacer-box {
    height: 42px !important;
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

# 初始化模拟历史记录列表
if "sim_history" not in st.session_state:
    st.session_state.sim_history = []

if "sim_result" not in st.session_state:
    st.session_state.sim_result = None  # 用于存储上一次的 DPS 结果
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
    start_sim = st.button("🚀 开始模拟", type="primary", key="start_btn", use_container_width=True)

st.divider()

# ======================================================
# 4. 主渲染区
# ======================================================
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

                    st.markdown(f'<div class="star-hint">{state["level"]} ★</div>', unsafe_allow_html=True)
                else:
                    st.markdown('<div class="spacer-box"></div>', unsafe_allow_html=True)

# --- 左侧面板 ---
with st.sidebar:
    st.header("⚙️ 基础设置")
    base_atk = st.number_input("基础攻击力（无丹青）", value=8000, step=100)
    base_dps = st.number_input("初始秒伤（无丹青）", value=35000, step=1000)
    sim_time = st.slider("模拟时长 (s)", 30, 500, 180)
    sim_count = st.slider("模拟次数 ", 0, 50, 20)

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

            # --- 增加一个列表记录每次结果 ---
            results_history = []
            total_damage_accumulator = 0.0
            status_placeholder = st.empty()

            for i in range(sim_count):
                status_placeholder.text(f"⏳ 正在计算: {i + 1}/{sim_count}")
                run_res = engine.simulate(float(sim_time))

                # 记录单次模拟的平均 DPS
                current_dps = run_res / sim_time
                results_history.append(current_dps)

                total_damage_accumulator += run_res

            status_placeholder.empty()
            avg_dps = (total_damage_accumulator / sim_count) / sim_time
            st.session_state.sim_result = avg_dps

            # --- 按卡牌各自的费用倒序排序 ---
            sorted_deck = sorted(final_deck, key=lambda c: c.fee, reverse=True)

            # 生成排序后的名称列表
            deck_names = [f"{c.name}({c.level}★)" for c in sorted_deck]
            # 将新记录插入到列表开头（最新的在最上面）
            record = {
                "时间": pd.Timestamp.now().strftime("%H:%M:%S"),
                "DPS": round(avg_dps),
                "卡组": " + ".join(deck_names)
            }
            st.session_state.sim_history.insert(0, record)

    if st.session_state.sim_result is not None:
        # 4. 渲染核心指标
        st.metric("模拟丹青 DPS（平均值）", f"{st.session_state.sim_result:,.0f}")

        # 补充辅助信息
        # st.info(f"基于 {sim_count} 次模拟取平均值，模拟时长 {sim_time}s")
        # st.divider()

        st.subheader("📜 历史模拟记录")
        if st.session_state.sim_history:
            history_df = pd.DataFrame(st.session_state.sim_history)
            st.dataframe(
                history_df,
                use_container_width=True,
                hide_index=True,
                column_config={
                    "卡组": st.column_config.TextColumn("卡组", width="large"),
                    "DPS": st.column_config.NumberColumn("DPS", format="%d")
                }
            )

            if st.button("🗑️ 清空历史记录"):
                st.session_state.sim_history = []
                st.rerun()
        else:
            st.info("暂无模拟记录，配置好卡组后点击“开始模拟”即可记录。")
