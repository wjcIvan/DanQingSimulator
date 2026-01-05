import streamlit as st
from card_engine_v2 import *
import pandas as pd
from concurrent.futures import ThreadPoolExecutor
import numpy as np

# ======================================================
# 1. 页面配置与全局样式 (现代 UI 设计)
# ======================================================
st.set_page_config(page_title="丹青模拟器 Pro", layout="wide")

st.markdown("""
<style>
/* --- 隐藏标题后的锚点链接图标 --- */
[data-testid="stHeaderActionElements"] {
    display: none !important;
}

/* 阻止页面自动滚动和溢出抖动 */
html, body, [data-testid="stAppViewContainer"] {
    scroll-behavior: auto !important;
    overflow-anchor: none !important;
    -webkit-user-select: none; 
    user-select: none;
}

/* 隐藏 Streamlit 默认页眉 */
header { visibility: hidden; height: 0px !important; }
.block-container { padding-top: 1rem !important; padding-left: 5rem !important; padding-right: 5rem !important; }

/* --- 现代卡牌按钮 --- */
.stButton > button {
    width: 100%;
    height: 70px;
    border-radius: 14px;
    border: 1px solid #eef2f6;
    background: #ffffff;
    color: #475569;
    font-weight: 600;
    font-size: 16px;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    line-height: 1.2;
}

/* 悬停效果 */
.stButton > button:hover {
    border-color: #ff4b4b;
    color: #ff4b4b;
    transform: translateY(-2px);
    box-shadow: 0 10px 15px -3px rgba(255, 75, 75, 0.1);
}

/* 选中状态 (利用 Primary 属性) */
div[data-testid="stButton"] button[kind="primary"] {
    background: linear-gradient(135deg, #ff4b4b 0%, #ff7676 100%) !important;
    color: white !important;
    border: none !important;
    box-shadow: 0 8px 20px rgba(255, 75, 75, 0.3) !important;
}

/* 辅助说明文字 */
.star-hint {
    font-size: 14px;
    color: #ff4b4b;
    font-weight: 800;
    text-align: right;
    margin-top: -38px;
    padding-right: 8px;
    pointer-events: none;
}

.spacer-box { height: 40px !important; }

/* DPS 指标优化 */
div[data-testid="stMetricValue"] {
    color: #ff4b4b !important;
    font-size: 36px !important;
    font-weight: 900 !important;
}

/* 滑块样式精简 */
div[data-testid="stMainBlockContainer"] div[data-testid="stSliderThumbValue"] {
    display: none !important;
}
div[data-testid="stSlider"] [data-testid="stSliderTickBar"] { display: none; }
div[data-testid="stSlider"] [data-baseweb="slider"] { height: 8px; }
div[data-testid="stSlider"] [role="slider"] { width: 14px; height: 14px; background-color: #ff4b4b; border: 2px solid white; }

div[data-testid="stSlider"] [data-baseweb="typography"] {
    display: none !important;
}
</style>
""", unsafe_allow_html=True)


# ======================================================
# 2. 核心数据与缓存
# ======================================================
@st.cache_resource
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


def update_slider(name):
    # 使用 Widget 的临时 Key 获取最新值，并立即同步给业务 Key
    new_val = st.session_state[f"temp_lvl_{name}"]
    st.session_state[f"lvl_{name}"] = new_val


@st.cache_data
def get_card_static_data():
    fee_map = {}
    for cat in library.values():
        for name, cls in cat:
            fee_map[name] = cls(level=1).fee  # 仅实例化一次获取静态费用
    return fee_map


card_fees = get_card_static_data()

# 初始化状态
if "deck_state" not in st.session_state:
    st.session_state.deck_state = {name: {"selected": False} for cat in library.values() for name, _ in cat}
    for name in st.session_state.deck_state.keys():
        st.session_state[f"lvl_{name}"] = 6
    st.session_state.sim_history = []
    st.session_state.sim_result = None


# 定义一个辅助函数，用于单次独立的模拟
def run_single_sim(instances, base_dps, base_atk, sim_time):
    # 每次模拟都重新实例化所有卡牌和引擎，确保随机种子和状态完全独立
    engine = RaceCombatEngine(instances, base_dps=base_dps, base_atk=base_atk)
    return engine.simulate(float(sim_time))


# ======================================================
# 3. 模拟器主区域 (Fragment 局部刷新)
# ======================================================
@st.fragment
def main_simulator_area():
    # 计算费用 (直接查表，不实例化类，速度极快)
    total_fee = sum(card_fees[name] for name, state in st.session_state.deck_state.items() if state["selected"])

    fee_color = "#28a745" if total_fee <= 25 else "#ff4b4b"
    st.markdown(f"### 编队费用: <span style='color:{fee_color}'>{total_fee} / 25</span>", unsafe_allow_html=True)
    st.divider()

    l_col, _, r_col = st.columns([3, 0.2, 1.8])

    with l_col:
        for cat_name, cards in library.items():
            st.subheader(cat_name)
            cols = st.columns(4)
            for i, (name, cls) in enumerate(cards):
                state = st.session_state.deck_state[name]
                is_sel = state["selected"]

                with cols[i % 4]:
                    # 现代按钮：通过 type="primary" 切换样式
                    if st.button(f"{name}\n{card_fees[name]}费",
                                 key=f"btn_{name}",
                                 type="primary" if is_sel else "secondary",
                                 use_container_width=True):
                        st.session_state.deck_state[name]["selected"] = not is_sel
                        st.rerun(scope="fragment")

                    # 星级滑块使用 empty 占位
                    star_placeholder = st.empty()
                    if is_sel:
                        with star_placeholder.container():
                            current_lvl_val = st.session_state.get(f"lvl_{name}", 6)
                            st.select_slider(
                                f"star_{name}",
                                options=list(range(7)),
                                value=current_lvl_val,  # 显式指定初始值
                                on_change=update_slider,
                                args=(name,),
                                key=f"temp_lvl_{name}",
                                label_visibility="collapsed"
                            )
                            st.markdown(f'<div class="star-hint">{st.session_state[f"lvl_{name}"]}★</div>',
                                        unsafe_allow_html=True)
                    else:
                        star_placeholder.markdown('<div class="spacer-box"></div>', unsafe_allow_html=True)

    with r_col:
        # 这里的“开始模拟”按钮通过 CSS 已经做了特殊加亮处理
        start_sim = st.button("🔥 开始战斗模拟", type="secondary", use_container_width=True)
        st.subheader("📊 模拟报告")

        if start_sim:
            selected_names = [n for n, s in st.session_state.deck_state.items() if s["selected"]]
            if not selected_names:
                st.warning("请先在左侧选择卡牌")
            elif total_fee > 25:
                st.error("费用超过 25 限制")
            else:
                with st.spinner("正在进行多线程演算..."):
                    # 仅在此时进行类实例化
                    instances = []
                    for cat in library.values():
                        for name, cls in cat:
                            if st.session_state.deck_state[name]["selected"]:
                                instances.append(cls(level=st.session_state[f"lvl_{name}"]))

                    # engine = RaceCombatEngine(instances, base_dps=base_dps, base_atk=base_atk)
                    # 使用多线程优化部署环境下的计算延迟
                    with ThreadPoolExecutor() as executor:
                        # 将参数传给辅助函数，在每个线程内部实例化 engine
                        futures = [
                            executor.submit(run_single_sim, instances, base_dps, base_atk, sim_time)
                            for _ in range(sim_count)
                        ]
                        results = [f.result() for f in futures]

                    # 2. 统计计算 (转化为 DPS)
                    dps_list = np.array(results) / sim_time
                    avg_dps = np.mean(dps_list)
                    std_dev = np.std(dps_list)  # 标准差

                    # 计算 95% 置信区间: z=1.96
                    # CI = 1.96 * (标准差 / sqrt(样本数))
                    ci_95 = 1.96 * (std_dev / np.sqrt(sim_count))

                    # 3. 存储结果
                    st.session_state.sim_result = {
                        "avg": avg_dps,
                        "ci": ci_95,
                        "max": np.max(dps_list),
                        "min": np.min(dps_list),
                        "std": std_dev
                    }

                    sorted_deck = sorted(instances, key=lambda c: c.fee, reverse=True)
                    # 历史记录
                    # app.py 中的修改点
                    st.session_state.sim_history.insert(0, {
                        "时间": pd.Timestamp.now(tz='Asia/Shanghai').strftime("%H:%M:%S"),
                        "DPS": round(avg_dps),
                        "误差": f"±{ci_95:,.0f}",  # 必须添加这一行，对应 column_config 中的 "误差"
                        "阵容": " + ".join([f"{obj.name}({obj.level}★)" if obj.level != 6 else obj.name
                                          for obj in sorted_deck])
                    })

        if st.session_state.sim_result:
            res = st.session_state.sim_result

            # 布局：上方主指标，下方波动细节
            m_col1, m_col2 = st.columns(2)
            with m_col1:
                st.metric("平均秒伤 (Avg)", f"{res['avg']:,.0f}")
            with m_col2:
                # 计算变异系数 (CV) 来衡量稳定性
                cv = res['std'] / res['avg'] if res['avg'] > 0 else 0
                stability = "极高" if cv < 0.05 else "稳定" if cv < 0.15 else "看脸"
                st.metric("波动偏差 (±95%)", f"±{res['ci']:,.0f}", help=f"稳定性评价：{stability}")

            # 绘制简单的分布可视化 (使用 CSS 模拟进度条范围)
            st.markdown(f"""
            <div style="background: #fdf2f2; padding: 12px; border-radius: 8px; border: 1px solid #fee2e2; margin: 10px 0;">
                <div style="display: flex; justify-content: space-between; font-size: 12px; color: #991b1b;">
                    <span>最低: {res['min']:,.0f}</span>
                    <span>预期范围: {res['avg'] - res['ci']:,.0f} ~ {res['avg'] + res['ci']:,.0f}</span>
                    <span>最高: {res['max']:,.0f}</span>
                </div>
                <div style="height: 6px; background: #fee2e2; border-radius: 3px; margin-top: 8px; position: relative;">
                    <div style="position: absolute; left: {max(0, (res['avg'] - res['ci'] - res['min']) / (res['max'] - res['min'] + 1) * 100)}%; 
                                width: {min(100, (2 * res['ci']) / (res['max'] - res['min'] + 1) * 100)}%; 
                                height: 100%; background: #ff4b4b; opacity: 0.6; border-radius: 3px;"></div>
                </div>
            </div>
            """, unsafe_allow_html=True)

        if st.session_state.sim_history:
            st.subheader("📜 历史模拟记录")
            df_history = pd.DataFrame(st.session_state.sim_history)

            st.data_editor(
                df_history,
                column_config={
                    "时间": st.column_config.TextColumn("时间"),
                    "DPS": st.column_config.NumberColumn("DPS", format="%d"),
                    "误差": st.column_config.TextColumn("误差"),
                    "阵容": st.column_config.TextColumn("阵容", width="large")
                },
                use_container_width=True,
                hide_index=True,
                disabled=True,
                # 强制指定显示的列
                column_order=("时间", "DPS", "误差", "阵容")
            )
            # st.dataframe(pd.DataFrame(st.session_state.sim_history), use_container_width=True, hide_index=True)
            if st.button("🗑️ 清空历史"):
                st.session_state.sim_history = []
                st.session_state.sim_result = None
                st.rerun(scope="fragment")


# ======================================================
# 4. 侧边栏
# ======================================================
st.title("🎴 丹青模拟器 Pro")

with st.sidebar:
    st.header("⚙️ 基础参数")
    base_atk = st.number_input("基础攻击力(无丹青)", value=8000, step=100)
    base_dps = st.number_input("初始秒伤(无丹青)", value=35000, step=1000)
    sim_time = st.slider("模拟战斗时长 (s)", 30, 600, 180)
    sim_count = st.slider("模拟迭代次数", 1, 200, 50)

    st.divider()
    if st.button("🧹 重置全卡组", use_container_width=True):
        for v in st.session_state.deck_state.values(): v["selected"] = False
        st.rerun()

    st.write("快捷调整星级 (已选)：")
    star_cols = st.columns(7)
    for i in range(7):
        if star_cols[i].button(f"{i}★", key=f"batch_{i}"):
            for name, state in st.session_state.deck_state.items():
                if state["selected"]: st.session_state[f"lvl_{name}"] = i
            st.rerun()

main_simulator_area()
