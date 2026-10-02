# 霓虹围城

<p align="center">
  <a href="/README_en.md">English</a> | <a href="/README.md">中文</a>
</p>
<p align="center">
  <a href="https://github.com/guangzhoueven/fps/actions/workflows/release.yml">
    <img alt="Build & Release" src="https://github.com/guangzhoueven/fps/actions/workflows/release.yml/badge.svg" />
  </a>
  <img alt="Language" src="https://img.shields.io/badge/language-JavaScript-F7DF1E?logo=javascript&logoColor=black" />
  <img alt="Three.js" src="https://img.shields.io/badge/Three.js-r160-black?logo=threedotjs&logoColor=white" />
  <img alt="Electron" src="https://img.shields.io/badge/Electron-33-47848F?logo=electron&logoColor=white" />
</p>
<p align="center">
  <img alt="GitHub stars" src="https://img.shields.io/github/stars/guangzhoueven/fps?style=social" />
  <img alt="GitHub forks" src="https://img.shields.io/github/forks/guangzhoueven/fps?style=social" />
  <img alt="GitHub watchers" src="https://img.shields.io/github/watchers/guangzhoueven/fps?style=social" />
</p>

[![Typing SVG](https://readme-typing-svg.demolab.com?font=Comic+Sans+MS&pause=1000&center=true&vCenter=true&width=435&lines=Welcome+to+this+FPS+project.)](https://git.io/typing-svg)

<p align="center">
  <a href="https://www.star-history.com/?repos=guangzhoueven%2Ffps&type=date&legend=top-left">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=guangzhoueven%2Ffps&type=date&theme=dark&legend=top-left" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=guangzhoueven%2Ffps&type=date&theme=light&legend=top-left" />
    <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=guangzhoueven%2Ffps&type=date&theme=light&legend=top-left" />
  </picture>
  </a>
</p>
<p align="center">
  <a href="http://guangzhoueven.github.io/fps"><b>立即游玩</b></a>
</p>


---

# 霓虹围城 NEON SIEGE

> 坚守阵地，抵御潮水般的敌人。

**原创波次生存 FPS** —— 基于 Three.js 的纯浏览器第一人称射击游戏，无需构建、打开即玩；同时提供 Windows 桌面版（Electron 打包）与 GitHub Actions 一键发布。

## 特性

- **无限波次**：敌人数量与强度逐波递增，定期出现 Boss 巨兽波
- **8 种武器**：手枪、冲锋枪、霰弹枪、突击步枪、狙击枪、火箭筒、弩、机枪 —— 各具伤害/散布/后坐力/射速参数，商店购买与补给
- **7 种敌人**：步兵、奔袭者、蛮兵、射手、幻影、重坦、巨兽 Boss，各具 AI 与行为差异
- **B\* 寻路**：自研 B\* 网格寻路（失败自动回退 A\*），怪物会绕开障碍、穿门追击
- **波次增益与成就**：每波通关三选一增益（10 种），5 项成就挑战
- **连击系统**：爆头、连击倍率、积分弹字、油桶连锁爆炸
- **补给体系**：商店、医疗包、弹药、手雷、空投补给箱、增益道具（加速/双倍伤害/急速射击/无敌）
- **完整存档**：自动保存、继续游戏、导出/导入 JSON 备份、可撤销的软清除
- **中英双语**：全界面 i18n 实时切换
- **沉浸体验**：动态昼夜天空、指针锁定视角、冲刺/蹲伏/跳跃/手电筒、小地图、武器属性面板
- **复活机制**：死亡后可复活，5 秒无敌脱困

## 操作

| 按键 | 功能 | 按键 | 功能 |
| --- | --- | --- | --- |
| `W` `A` `S` `D` | 移动 | `鼠标左键` | 射击 |
| `鼠标` | 视角 | `鼠标右键` | 瞄准 |
| `Shift` | 冲刺 | `Ctrl` | 蹲下 |
| `Space` | 跳跃 | `R` | 换弹 |
| `E` | 互动/开门 | `F` | 手电筒 |
| `G` | 手雷 | `Q` / 滚轮 | 切换武器 |
| `1`–`5` | 武器栏 | `Tab` | 武器属性 |
| `Esc` | 暂停 | | |

## 快速开始

### 在线游玩

直接访问 **[fps.gzeven.cc.cd](https://fps.gzeven.cc.cd)**，现代桌面浏览器即可（首次点击会请求指针锁定）。

### 本地运行

```bash
git clone https://github.com/guangzhoueven/fps.git
cd fps

# 零构建 —— 任意静态服务器即可，例如：
npx serve .
# 或
python -m http.server 8080
```

也可以直接启动 Electron 桌面窗口：

```bash
npm ci
npm start
```

### 构建 Windows 安装包

```bash
npm ci
npm run dist
# 输出 dist/NeonSiege-Setup-1.0.0.exe（安装版）与 NeonSiege-Portable-1.0.0.exe（便携版）
```

推送 `v*` 标签会自动触发 GitHub Actions（`windows-latest`）构建，并把 exe 发布到 [Releases](https://github.com/guangzhoueven/fps/releases)。

## 技术栈

- [Three.js](https://threejs.org) r160（本地 vendor，无外部依赖）
- 原生 JavaScript 经典 `<script>` 模块（**无打包器、无框架**）
- Electron 33 + electron-builder 25
- GitHub Actions 自动构建发布
- 存档：浏览器 `localStorage`

## 项目结构

```
fps/
├── index.html              # 入口页面
├── css/style.css           # 样式
├── js/                     # 游戏模块
│   ├── engine.js           #   渲染 / 灯光 / 相机
│   ├── world.js            #   地图、房间、门
│   ├── navigation.js       #   导航网格 + B*/A* 寻路
│   ├── player.js           #   移动 / 伤害 / 复活
│   ├── enemies.js          #   敌人 AI
│   ├── waves.js            #   波次与生成队列
│   ├── weapons.js          #   射击 / 弹道
│   ├── shop.js, hud.js     #   商界与 HUD
│   ├── save.js             #   存档系统
│   └── ...                 #   音效、特效、道具、输入、i18n
├── js/vendor/three.min.js  # Three.js r160
├── translations/           # zh.json / en.json
├── electron-main.js        # Electron 壳
└── .github/workflows/      # 自动发布
```

## 存档数据

游戏进度自动保存在浏览器 `localStorage`（键：`neonSiegeSave`）。暂停菜单支持：

- **导出数据**：下载 JSON 备份
- **导入数据**：从备份恢复
- **清除数据**：二次确认 + 撤销提示，防误删

## 贡献

欢迎提交 Issue 与 Pull Request。

---

<p align="center">
  原创作品 · Made by <a href="https://github.com/guangzhoueven">guangzhoueven</a> and <a href="https://github.com/starlightfootprint">StarlightFootprint</a>
</p>
