<div align="center">
  <a href="https://github.com/UncleK/SideX">
    <img src="docs/banner_en.png" alt="SideX - Immersive In-Place Comment Stream for X" width="100%" />
  </a>

  <p>
    <a href="README_CN.md">🇨🇳 简体中文</a> •
    <a href="#features">Features</a> •
    <a href="#installation">Installation</a> •
    <a href="#shortcuts">Shortcuts</a> •
    <a href="#license">License</a>
  </p>

  <p>
    <a href="https://chromewebstore.google.com/detail/ccbkagemmobenjoioicemekhjbggmpde">
      <img src="https://img.shields.io/badge/Chrome_Web_Store-Available-4285F4?style=flat-square&logo=googlechrome&logoColor=white" alt="Chrome Web Store" />
    </a>
    <img src="https://img.shields.io/badge/Manifest-V3-blue?style=flat-square" alt="Manifest V3" />
    <img src="https://img.shields.io/badge/Version-1.1.10-00b4f8?style=flat-square" alt="Version 1.1.10" />
    <img src="https://img.shields.io/badge/Browser-Chrome%20%7C%20Edge%20%7C%20Brave-success?style=flat-square" alt="Supported Browsers" />
    <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="MIT License" />
  </p>

  <br />
  <a href="demo/demo.mp4">
    <img src="demo/demo.gif" alt="SideX Demo" width="100%" />
  </a>
  <p><em>🎬 Click preview to open the HD demo video (<a href="demo/demo.mp4">demo.mp4 · 947KB</a>)</em></p>
  <br />
</div>

---

## 📖 Overview

**SideX** transforms how you read X (Twitter) on the web. **Click any tweet to auto-load comments on the right and unroll long posts in-place**—experience seamless, uninterrupted reading with zero page hops. Never lose your timeline scroll position again.

---

## ✨ Features

* 🚀 **In-Place Drawer**: Click any tweet to dock its replies directly in the 3rd column—zero page redirects or reload.
* 📖 **Auto-Unroll Long Posts**: Automatically expands "Show more" on focal posts.
* 🧵 **Conversation Tree & Drill-down**: Reconstructs nested replies with clean thread lines; configurable sub-reply previews (1, 2, 3, 5) with zero-jump smooth in-place expansion.
* 💬 **Inline Reply & Multi-Attachments**: Reply to any comment in-place with up to 4 images/GIFs (`Ctrl+V` pasting, file picker), X Premium long post support (up to 25,000 characters), and one-click native reply fallback.
* 🔄 **Native interactions first**: Reuse native like, bookmark, and menu controls when the same post is rendered on the page; other comments use X session requests.
* 🌐 **Translation options**: Use X official translation by default, choose Google, or hide SideX translation controls and use your existing translator's selection/page translation.
* 👤 **Profile hover cards**: Reuse the actual X card next to the sidebar when a matching native profile link exists; otherwise show a fallback with biography, relationship counts, and followers you know.
* 🎨 **Adaptive Themes & Resizable**: Matches X's Light, Dim, and Dark themes. Drag the right edge to adjust sidebar width.
* 🛡️ **Runs in your browser**: Reuses your X session without a SideX relay server. When Google translation is selected, post text is sent directly to Google.

---

## 📦 Installation

Compatible with Chrome, Edge, Brave, Arc, and other Chromium browsers:

### Method 1: Chrome Web Store (Recommended, One-Click)
👉 **[Install from Chrome Web Store](https://chromewebstore.google.com/detail/ccbkagemmobenjoioicemekhjbggmpde)** with seamless automatic updates!

### Method 2: ZIP Package (100% Reliable & Offline)
1. Download the latest published **`SideX-v*.zip`** from [Releases](https://github.com/UncleK/SideX/releases) and extract it.
2. Open `chrome://extensions/` (or `edge://extensions/`), enable **"Developer mode"** in the top-right corner.
3. Click **"Load unpacked"** and select the extracted folder.

### Method 3: Clone via Git (For Developers)
```bash
git clone https://github.com/UncleK/SideX.git
```
Then click **"Load unpacked"** and select the cloned `SideX` folder.

5. Open [x.com](https://x.com) or [twitter.com](https://twitter.com) and click any tweet to start reading!

---

## ⌨️ Shortcuts

| Shortcut / Action | Description |
| :--- | :--- |
| **Click Tweet body** | Expand post text & open comments drawer in-place |
| **ESC** | Close image lightbox, or close comments drawer |
| **Click outside drawer** | Close comments drawer |
| **Drag right edge** | Resize drawer width (auto-saved) |
| **Double-click handle** | Reset drawer to default width |
| **Ctrl + V** | Paste clipboard image directly into reply box |
| **Ctrl + Enter** | Send reply |

---

## ⚠️ Disclaimer

SideX is an independent open-source productivity extension and is **not affiliated with, endorsed by, or associated with X Corp. or Twitter**.

---

## Development and verification

No build is required. Reload SideX in `chrome://extensions` after editing, then refresh X.

```bash
npm ci --ignore-scripts
npm test
```

Tests use synthetic X responses and DOM fixtures without performing real account actions. They cover profile parsing, translation requests, long-text chunking, native controls, rollback, retained reading state, scroll reset, and stale responses. X internals and third-party translation extensions may change. Without a matching native profile link, SideX renders a fallback with a full-profile link rather than simulating Grok's Profile Summary button; comments without native nodes are still rendered by SideX.

## 📄 License

[MIT License](LICENSE) © 2026 SideX Contributors
