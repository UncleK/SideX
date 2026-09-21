<div align="center">
  <a href="https://github.com/UncleK/SideX">
    <img src="docs/banner_zh.png" alt="SideX - 沉浸式侧边评论流" width="100%" />
  </a>

  <p>
    <a href="README.md">🇺🇸 English</a> •
    <a href="#-特性功能">特性功能</a> •
    <a href="#-安装使用">安装使用</a> •
    <a href="#-快捷键">快捷键</a> •
    <a href="#-开源协议">开源协议</a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/Manifest-V3-blue?style=flat-square" alt="Manifest V3" />
    <img src="https://img.shields.io/badge/Version-1.1.1-00b4f8?style=flat-square" alt="Version 1.1.1" />
    <img src="https://img.shields.io/badge/Browser-Chrome%20%7C%20Edge%20%7C%20Brave-success?style=flat-square" alt="Supported Browsers" />
    <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="MIT License" />
  </p>

  <br />
  <img src="demo/demo.gif" alt="SideX 演示动图" width="100%" />
  <br />
</div>

---

## 📖 项目简介

**SideX** 彻底重构了 X (Twitter) 网页端的浏览体验——**点击推文即可在右侧自动加载评论流，主帖长文原位自动展开**，无需跳页、不丢失时间线滚动位置，带来丝滑顺畅的沉浸式“边刷边看”体验。

---

## ✨ 特性功能

* 🚀 **右侧就地停靠**：在推文流中直接点击任意推文，评论流秒级停靠在页面第三列，零跳转、不重新加载页面。
* 📖 **长文原位展开**：自动展开主帖“显示更多（Show more）”，原地阅读完整长文。
* 🧵 **树状对话流 & 子评论下钻**：智能重构评论层级与清晰连接线，支持点击任意评论下钻进入独立子对话。
* 💬 **行内回复 & 粘贴图片**：支持原地就地回复，可直接 `Ctrl+V` 粘贴剪贴板图片上传并用 `Ctrl+Enter` 快速发送。
* 🔄 **操作实时双向同步**：在侧栏中进行点赞、转推、收藏，与主时间线及 X 官方状态毫秒级实时同步。
* 🎨 **主题自适应 & 自由拉伸**：完美自适应浅色（Light）、暗色（Dim）与黑色（Dark）主题；可随意拖拽右边缘调节抽屉宽度。
* 🛡️ **安全零封号风险**：纯前端 DOM 与会话复用，完全模拟官方 Web 行为，无任何额外第三方服务器中转。

---

## 📦 安装使用

适用于 Chrome、Edge、Brave、Arc 等所有 Chromium 浏览器：

### 方式一：CRX 文件直接拖拽安装（最快）
1. 前往 [Releases 页面](https://github.com/UncleK/SideX/releases) 下载 **`SideX-v1.1.1.crx`**。
2. 打开浏览器扩展管理页面：
   * Chrome / Brave: `chrome://extensions/`
   * Edge: `edge://extensions/`
3. 开启右上角的**「开发者模式」**。
4. 将下载的 `.crx` 文件直接**拖拽**到该扩展管理页面中完成安装。
   *(注：较新版本的 Chrome 可能会弹出安全拦截提示禁止安装非商店 CRX，遇到此类情况请使用下方的「方式二」)*。

### 方式二：下载 ZIP 压缩包（100% 成功，推荐）
1. 前往 [Releases 页面](https://github.com/UncleK/SideX/releases) 下载 **`SideX-v1.1.1.zip`** 并解压。
2. 在扩展管理页面开启「开发者模式」后，点击左上角**「加载未打包的扩展程序」**（部分浏览器为「加载已解压的扩展程序」/ Load unpacked），选择解压后的文件夹即可。

### 方式三：通过 Git 源码安装（开发者）
```bash
git clone https://github.com/UncleK/SideX.git
```
在扩展管理页面点击「加载未打包的扩展程序」，选择克隆的 `SideX` 文件夹即可。

5. 打开 [x.com](https://x.com) 或 [twitter.com](https://twitter.com)，点击任意推文即可享受就地展开的评论流！

---

## ⌨️ 快捷键

| 操作 / 快捷键 | 功能说明 |
| :--- | :--- |
| **单击推文空白处** | 原地展开主贴长文并在右侧打开评论抽屉 |
| **ESC** | 优先关闭大图画廊，再次按下关闭侧栏抽屉 |
| **单击侧栏外空白处** | 快速收起侧栏抽屉 |
| **拖拽右边缘** | 自由拉伸调节侧边栏宽度（自动记忆） |
| **双击右边缘把手** | 恢复默认宽度（与原生第三列等宽） |
| **Ctrl + V** | 在评论输入框中直接粘贴剪贴板图片 |
| **Ctrl + Enter** | 快速提交并发送评论 |

---

## ⚠️ 免责声明

SideX 是一款完全开源、用于提升个人阅读效率的第三方辅助工具，**与 X Corp. / Twitter 官方无任何隶属或背书关系**。

---

## 📄 开源协议

基于 [MIT License](LICENSE) 开源发布。
