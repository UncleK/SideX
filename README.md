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
    <img src="https://img.shields.io/badge/Version-1.1.25-00b4f8?style=flat-square" alt="Version 1.1.25" />
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
* 🧵 **Conversation Tree & Drill-down**: Reconstructs nested replies with clean thread lines; configurable sub-reply previews (1, 2, 3, 5) with zero-jump smooth in-place expansion. Loaded consecutive self-replies by the original author unfold automatically. Full reply text can also expand automatically when enabled; this option defaults to off.
* 📚 **Reply loading**: Shows loaded direct replies alongside the total reported by X. Near-bottom automatic loading defaults to on and can be disabled. Nested branches retain their own continuation controls; replies folded by X require an explicit reveal action.
* 📌 **Optional panel pinning**: Keep the panel open across outside clicks, Esc and X navigation, with the active post highlighted. You can still switch posts or close the panel manually. Automatic pinning defaults to off and applies to newly opened panels.
* 💬 **Quick replies and official dialogs**: The compact quick toolbar has seven entries: images, GIFs, polls, emoji, scheduling, location and content disclosure (flag). Send text, emoji and up to four JPG/PNG/WebP images directly. Advanced tools open X's actual dialogs above the sidebar. In Official mode, clicking a comment's reply icon opens the official reply dialog in the current page without another browser window.
* ✍️ **Separate text drafts**: Switch posts and close comments freely without a prompt. Unsent text is kept separately per post and reply target in the current tab and restored on return. Refreshing the page or closing the tab clears these drafts; image attachments are not retained after closing or switching replies.
* 🔄 **Native interactions first**: Quotes open X's official in-page composer with the original-post card. Sharing uses X's official menu with account and media-specific options, even for replies absent from the native timeline. Reuse native like and bookmark controls when the same post is rendered on the page; other comments use X session requests.
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
| **Click Tweet body** | Open or switch comments in place, keeping separate text drafts |
| **ESC** | Close the current overlay or unpinned comments drawer |
| **Click outside drawer** | Close an unpinned comments drawer and keep its text draft |
| **Pin button** | Toggle whether outside clicks, Esc and X navigation keep the panel open |
| **Drawer close button** | Close the drawer and keep its text draft |
| **Drag right edge** | Resize drawer width (auto-saved) |
| **Double-click handle** | Reset drawer to default width |
| **Ctrl + V** | Paste clipboard image directly into reply box |
| **Ctrl + Enter** | Send reply |

---

## ⚠️ Disclaimer

SideX is an independent open-source productivity extension and is **not affiliated with, endorsed by, or associated with X Corp. or Twitter**.

---

## Development and verification

The committed source and `vendor/twitter-text.js` need no build for normal edits. Run `npm run build:text` when updating the text library; this also generates bundled license notices. Reload SideX in `chrome://extensions` after editing, then refresh X.

```bash
npm ci --ignore-scripts
npm test
```

Tests use synthetic X responses and DOM fixtures without performing real account actions. They cover profile parsing, translation requests, long-text chunking, native controls, rollback, retained reading state, scroll reset, and stale responses. X internals and third-party translation extensions may change. Without a matching native profile link, SideX renders a fallback with a full-profile link rather than simulating Grok's Profile Summary button; comments without native nodes are still rendered by SideX.

Version 1.1.25 integrates [PR #5](https://github.com/UncleK/SideX/pull/5) by maxDNA. Returning from a reply to its parent post now preserves the current response's reply order instead of promoting previously visited replies. Cached descendants remain available without duplicates, and current content and visibility updates retain precedence. The combined code passes 172 local regression tests, including the v1.1.24 quote and share cases.

Version 1.1.24 opens quotes in X's official in-page composer with the original-post card. Sharing uses X's loaded menu component, including its account and media-specific options, even for replies absent from the native timeline. Existing drafts are preserved; unavailable native controls show a retry message.

Version 1.1.23 integrates [PR #2](https://github.com/UncleK/SideX/pull/2), [PR #3](https://github.com/UncleK/SideX/pull/3) and [PR #4](https://github.com/UncleK/SideX/pull/4): optional panel pinning with an active-post marker, loaded/total reply counts, near-bottom loading, author-thread unfolding and scoped nested pagination. Auto-pin and automatic long-text expansion default to off; automatic pagination defaults to on. Folded replies require an explicit reveal action. Additional fixes preserve normal pagination before Spam, retain pending requests through navigation and native observations, and apply visibility updates to cached replies and their descendants. The combined source passes 162 local regression cases and keeps the v1.1.22 text-only draft behavior. Chinese and English popup layouts and setting writes were also checked in Chromium using a local extension-API fixture.

Version 1.1.22 removes reply protection and its navigation prompts, and keeps separate text drafts per post and reply target. Switching posts, closing the drawer, pressing Esc or clicking outside saves the current text; returning restores it with the original recipient. Drafts last only in the current tab until the page is refreshed or the tab is closed. Image attachments are not saved with drafts and are cleared when closing or switching replies. Failed or unconfirmed sends retain text; confirmed publication clears only the corresponding draft. Pending sends remain single-flight, late responses cannot clear a different reply, and the Reply button returns to its idle state when a request finishes. Validation includes 85 local regression cases, including draft restoration, discarded attachments and late uploads.

Version 1.1.18 adds a Photo comments setting, defaulting to SideX. SideX replaces only the native photo viewer's right column, keeping image navigation and native collapse/expand. The SideX header also offers collapse; expanding retains comment position and drafts. Timeline image links still open the native viewer, while text and blank areas open the in-place comments. Photo styling and reply mode are independent settings. Official reply mode has no bottom composer. Escape from a quick tool returns directly to its starting history entry, preserving an underlying photo viewer.

Quoted text previews use at most three lines. Overflowing quotes can expand and collapse in place, retaining links, media and the original-post action. Photo comments default to SideX while preserving an explicitly saved Official choice.

Previous fixes preserve body links and authored mentions, exclude sibling branches, and support paginated loading with retry, deduplication and stale-response isolation. The public fields in `tests/fixtures/google-source-comment.json` reproduce the source-link regression.

The quick composer keeps its compact layout and is never replaced by a moved official editor. X's editors and pickers retain their original React parents; SideX promotes the existing dialog portal to the browser top layer so the sidebar cannot cover them. The flag opens X's actual content disclosure panel for paid partnerships and AI content. Advanced editing, attachments and publication continue in the official reply dialog. Current input can be transferred to official tools; matching publication confirmation clears its text draft without affecting other replies. SideX keeps only text drafts, not images or native tool selections. If the native router is unavailable, the current editor stays available with an explicit message; Official mode can fall back to X's reply intent in the current tab. Tests cover both mode selections, native tools, draft transfer, picker navigation, stale confirmations and official text counting without publishing real account actions.

## 📄 License

[MIT License](LICENSE) © 2026 SideX Contributors
