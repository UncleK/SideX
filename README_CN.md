<div align="center">
  <img src="icons/icon-128.png" alt="SideX Logo" width="90" height="90" />
  <h1>SideX</h1>
  <p><strong>点击推文即可在右侧自动加载评论流，主帖长文原位自动展开</strong></p>
  <p><em>无需跳页的沉浸式 X 阅读扩展</em></p>

  <p>
    <a href="README.md">🇺🇸 English</a> •
    <a href="#-特性功能">特性功能</a> •
    <a href="#-安装使用">安装使用</a> •
    <a href="#-快捷键">快捷键</a> •
    <a href="#-开源协议">开源协议</a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/Manifest-V3-blue?style=flat-square" alt="Manifest V3" />
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

* 🚀 **就地停靠评论流**：点击推文，右侧第三列无缝展开评论抽屉，不跳页、不重新加载、不丢失滚动位置。
* 📖 **主帖长文原地展开**：自动展开“显示更多”（Show more），告别手动点击。
* 🧵 **对话树与层级下钻**：自动解析父子回复，以清晰的 `Thread Line` 连接；支持点击展开二级回复与独立分支下钻。
* 💬 **行内回复与剪贴板贴图**：任意层级就地呼出回复框，支持 `Ctrl+V` 直接粘贴剪贴板图片并上传，`Ctrl+Enter` 快捷发送。
* 🔄 **实时互动双向同步**：侧栏内点赞、转推、收藏、复制链接，状态与 X 原生页面实时双向同步。
* 🎨 **自适应主题与自由拉伸**：自动跟随 X 的主题切换（浅色 / 暗蓝 / 纯黑）；右边缘支持自由拖拽调节宽度（双击复原）。
* 🛡️ **原生级安全零封号风险**：完全运行于浏览器本地，直接复用当前登录态与官方签名生成器，与爬虫存在本质区别。

---

## 📦 安装使用

适用于 Chrome、Edge、Brave、Arc 等所有 Chromium 浏览器：

1. **下载或克隆本仓库**：
   ```bash
   git clone https://github.com/UncleK/SideX.git
   ```
2. **打开浏览器扩展管理页面**：
   * Chrome / Brave: `chrome://extensions/`
   * Edge: `edge://extensions/`
3. **开启右上角的「开发者模式」**。
4. **点击「加载未打包的扩展程序」**（部分浏览器为「加载已解压的扩展程序」/ Load unpacked），选中 `SideX` 文件夹。
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
