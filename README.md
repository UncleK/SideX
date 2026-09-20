<div align="center">
  <img src="icons/icon-128.png" alt="SideX Logo" width="100" height="100" />
  <h1>SideX</h1>
  <p><strong>沉浸式 X (Twitter) 侧边评论流与就地长文阅读扩展</strong></p>
  <p><em>An Immersive In-Place Comment Stream & Thread Drawer Extension for X (Twitter)</em></p>

  <p>
    <a href="#-features--核心特性">特性 / Features</a> •
    <a href="#-installation--安装使用">安装 / Installation</a> •
    <a href="#-architecture--架构原理">架构 / Architecture</a> •
    <a href="#-shortcuts--快捷键操作">快捷键 / Shortcuts</a> •
    <a href="#-disclaimer--免责声明">免责 / Disclaimer</a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/Manifest-V3-blue?style=flat-square" alt="Manifest V3" />
    <img src="https://img.shields.io/badge/Browser-Chrome%20%7C%20Edge%20%7C%20Brave-success?style=flat-square" alt="Supported Browsers" />
    <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="MIT License" />
    <img src="https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square" alt="PRs Welcome" />
  </p>
</div>

---

<div align="center">
  <a href="#中文说明">🇨🇳 中文说明</a> &nbsp;|&nbsp; <a href="#english">🇺🇸 English</a>
</div>

---

<a name="中文说明"></a>
## 🇨🇳 中文说明

### 📖 项目简介
在 X (Twitter) 网页端浏览信息流时，每次想看评论或长文，传统交互都会强行跳转至推文详情页，打断原本的时间线滚动体验。

**SideX** 彻底重构了这一交互——当你点击信息流中的任何推文时，**无需跳页**，右侧第三列就地化身为极简评论抽屉，同时自动展开主贴长文；支持完整的树状对话流、二级回复层级下钻与行内图片回复，带给你丝滑顺畅的“边刷边看”体验。

---

### ✨ 核心特性

* 🚀 **就地停靠评论流（In-Place Drawer）**
  * 点击时间线帖子，右侧第三列无缝展开评论抽屉，时间线不丢失、不跳转、不重新加载。
* 📖 **主帖长文原地展开（Auto Show-More）**
  * 点击推文即刻自动展开“显示更多”（Show more），无需手动寻觅折叠按钮。
* 🧵 **树状对话流与层级下钻（Thread & Drill-down）**
  * 告别官方平铺杂乱的评论展示，自动解析父子回复关系，以清晰的 `Thread Line` 组织树状结构；支持点击“展开子回复”下钻浏览独立分支。
* 🖼️ **原生级多媒体与大图画廊（Media & Lightbox）**
  * 评论区完整支持多图网格、高清原图点击全屏放大画廊、视频/动图原生播放。
* 💬 **行内手风琴回复与剪贴板贴图（Inline Composer）**
  * 随时针对任意层级评论展开回复框，支持 `Ctrl+V` 直接粘贴剪贴板图片并自动上传，支持 `Ctrl+Enter` 快速发送。
* 🔄 **完全无感的互动同步（Live Actions）**
  * 侧栏内支持点赞、转推、添加书签、复制推文链接，状态与 X 原生页面实时双向同步。
* 🎨 **三色自适应主题与自由拉伸（Adaptive Themes & Resizable）**
  * 自动跟随 X 的主题切换（浅色 Light / 暗蓝 Dim / 纯黑 Dark）；
  * 右边缘支持拖拽自由调节侧栏宽度，双击把手即可快速恢复原生默认宽度。
* 🛡️ **原生级安全与零封号风险（Native & Safe）**
  * 运行于浏览器本地，直接复用当前登录态与官方反爬签名生成器，在服务端特征与原生点击完全一致，完全不同于传统高风险爬虫。

---

### 📦 安装使用

目前 SideX 作为开源 Manifest V3 扩展提供，支持所有基于 Chromium 的浏览器（Chrome、Edge、Brave、Arc、Vivaldi 等）：

1. **克隆或下载源码**：
   ```bash
   git clone https://github.com/UncleK/SideX.git
   ```
2. **打开浏览器扩展管理页面**：
   * Chrome / Brave: `chrome://extensions/`
   * Edge: `edge://extensions/`
3. **开启右上角的「开发者模式」（Developer mode）**。
4. **点击「加载已解压的扩展程序」（Load unpacked）**，选中克隆下来的 `SideX` 文件夹。
5. 打开 [x.com](https://x.com) 或 [twitter.com](https://twitter.com)，在任意时间线点击帖子，即可享受就地展开的沉浸式评论流！

---

### ⌨️ 快捷键操作

| 按键 / 操作 | 功能描述 |
| :--- | :--- |
| **单击推文空白处** | 就地展开当前推文全文及右侧评论流抽屉 |
| **ESC** | 优先关闭大图画廊，再次按下关闭侧栏抽屉 |
| **单击页面空白处** | 点击侧栏外区域自动收起抽屉 |
| **拖拽右边缘** | 自由拉伸调节侧边栏宽度（自动持久化记忆） |
| **双击右边缘把手** | 快速恢复默认宽度（与原生第三列等宽） |
| **Ctrl + V** | 在评论输入框中直接粘贴剪贴板图片 |
| **Ctrl + Enter** | 快速提交并发送评论 |

---

<a name="english"></a>
## 🇺🇸 English

### 📖 Overview
When browsing feeds on X (Twitter) for the web, reading comments or long-form posts typically forces a full-page navigation, abruptly disrupting your timeline flow.

**SideX** reimagines this experience. When you click any tweet in your timeline, the post automatically expands in-place while a minimalist comment drawer slides into the right-hand column. With full hierarchical conversation trees, nested sub-thread drill-down, and inline media reply, SideX provides a seamless and frictionless reading experience.

---

### ✨ Features

* 🚀 **In-Place Comment Drawer**
  * Docked directly into the third column of X without any page navigation, reload, or losing your scroll position.
* 📖 **Automatic Long-Post Unroll**
  * Automatically expands "Show more" on focal posts upon clicking.
* 🧵 **Conversation Tree & Drill-down**
  * Automatically reconstructs nested parent-child replies with elegant thread lines; drill-down into specific conversation branches with ease.
* 🖼️ **Rich Media & Lightbox**
  * Supports high-resolution image galleries with full-screen zoom, video playback, and animated GIFs.
* 💬 **Inline Accordion Composer & Clipboard Image Upload**
  * Reply to any comment directly in-place with `Ctrl+V` clipboard image pasting and `Ctrl+Enter` fast submission.
* 🔄 **Bi-directional Live Actions**
  * Like, repost, bookmark, and share directly from the sidebar with instantaneous state sync.
* 🎨 **Adaptive Themes & Custom Width**
  * Fully adapts to X's Light, Dim, and Dark themes.
  * Drag the right edge to customize your reading width; double-click the handle to reset to native width.
* 🛡️ **Zero-Ban Risk & Native Security**
  * Operates 100% locally in your browser. Reuses official session credentials and client transaction signatures, appearing completely identical to native user interactions.

---

### 📦 Installation

SideX is a Manifest V3 extension compatible with all Chromium-based browsers (Chrome, Edge, Brave, Arc, Vivaldi, etc.):

1. **Clone or download this repository**:
   ```bash
   git clone https://github.com/UncleK/SideX.git
   ```
2. **Open your browser's extension manager**:
   * Chrome / Brave: `chrome://extensions/`
   * Edge: `edge://extensions/`
3. **Enable "Developer mode"** in the top-right corner.
4. **Click "Load unpacked"** and select the cloned `SideX` directory.
5. Navigate to [x.com](https://x.com) or [twitter.com](https://twitter.com) and click on any tweet to experience seamless in-place reading!

---

### 🛠️ Architecture & Project Structure

```text
SideX/
├── manifest.json       # Manifest V3 configuration & permission definitions
├── page-bridge.js      # Main-world script for GraphQL interception & TID signatures
├── core.js             # Data modeling, Tweet parser & conversation tree constructor
├── content.js          # DOM lifecycle, drawer rendering, events & interaction logic
├── sidebar.css         # Minimalist responsive styling & multi-theme adaptation
├── icons/              # Brand-safe Switch-inspired icons (16, 32, 48, 128px)
├── LICENSE             # MIT License
└── README.md           # Bilingual project documentation
```

---

### ⚠️ Disclaimer / 免责声明

* **SideX** is an independent, open-source productivity tool developed for educational and personal workflow enhancement purposes.
* This extension is **NOT affiliated with, endorsed by, or associated with X Corp. or Twitter**. All trademarks and registered trademarks belong to their respective owners.
* **SideX** 是一款完全开源、用于提升个人阅读效率的第三方辅助工具，与 X Corp. / Twitter 官方无任何隶属或背书关系。

---

### 📄 License

Distributed under the [MIT License](LICENSE). Feel free to use, modify, and distribute!
