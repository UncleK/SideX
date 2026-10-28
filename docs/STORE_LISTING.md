# Chrome Web Store Listing Description

v1.1.34：在现有 SideX 商店项目的详细说明中粘贴下方文本；也可分别使用打包输出的英文和中文说明填写对应语言。更新包不会自动替换商店说明。

```text
SideX makes X (Twitter) conversations easier to read. Click a post's text or blank area to open its replies in the right-hand column while keeping your timeline in place.

FEATURES
• Docked comments: read replies beside the timeline without opening a separate detail page.
• Long-post reading: automatically open the post's native Show more control when available.
• Conversation threads: expand and collapse reply branches, with configurable reply previews and automatic unfolding of loaded author self-replies.
• Reply loading: choose a default preview N (1/2/3/5), filled as the branch enters view. First click adds N+2, up to 2N+2 total (3 → 8); second click expands and loads the selected ordinary branch. Collapse or change the setting to reset to N. Main-list automatic loading is on by default and pauses after manual loading. Offscreen branches are not prefetched; folded replies need a separate reveal. Errors, empty pages and repeated cursors stop continuous branch loading.
• Optional pinning: keep the panel open across outside clicks, Esc and X navigation, with the active post highlighted. Manual close and post switching remain available. Auto-pin is off by default and applies to new panels.
• Reply text: long replies are fully shown by default; turn this off to fold them.
• Reply options: use the inline composer with image attachments, or open X's official reply dialog.
• Text drafts: keep separate drafts per post and reply target, restored on return. Switch posts or close comments freely without a prompt. Drafts last until you refresh the page or close the tab; images are not saved with drafts.
• Photo comments: choose SideX or Official comments beside photos, independently of reply mode. Collapse for a full-width image and expand with reading position and drafts retained.
• Quoted posts: expand and collapse quoted text in place from a three-line preview.
• Quote and share: open X's official quote composer with the original-post card, and use X's official share menu with account and media-specific options, including for replies absent from the native timeline.
• Grok and More: analyze the selected reply with Grok or open X's official three-dot menu from its header, including replies absent from the native timeline. Grok, Chat and official menus stay in front of the SideX sidebar.
• Native interactions: reuse X controls when the matching native post is present. Other comments use your active X session.
• Profile cards: show the actual X hover card when a matching native profile link is available. Otherwise, show a fallback with biography, relationship counts and followers you know.
• Translation choices: use the compact translation icon directly after Like to show or hide a reply's translation. Use X official translation, choose Google, or use your existing translation extension's selection/page translation.
• Appearance: follows X's theme and supports an adjustable sidebar width.

WHAT'S NEW IN 1.1.34
• Includes the fix for long blank areas in native X Article quotes.
• Fills visible reply previews to the chosen default; the first click adds N+2 (3 → 8), and the second loads the selected branch.
• Reorganizes reading options and more settings, shows full reply text by default, and places SideX photo comments first.
• Restores all default options and sidebar width while preserving drafts. A short refresh reminder appears only after changing a setting.

AFTER UPDATING
Refresh open X pages after updating SideX or changing settings. Send or copy any unfinished text first: refreshing clears temporary drafts. An explicitly saved preference to fold long reply text is retained until you enable full text or restore defaults.

PRIVACY
SideX runs in your browser and has no SideX relay server or analytics service. It processes the X content you open and uses your current X session for authenticated requests. Text drafts stay temporarily in the current page and are not synced. Replies and selected attachments go to X. Clicking Grok opens X's native analysis flow for the selected post through X/Grok, under their service terms and privacy policies. If you select Google translation and click Translate, the post text is sent directly to Google. X authentication information is not sent to Google. Other translation extensions follow their own settings and privacy policies.

SHORTCUTS
• Esc: close the current overlay or unpinned comment drawer.
• Pin button: toggle whether outside clicks, Esc and X navigation keep the panel open.
• Drawer close button: close the drawer and keep its text draft.
• Ctrl + Enter: send a reply from the inline composer.
• Ctrl + V: paste an image into a reply.

SideX is independent and is not affiliated with or endorsed by X Corp.
Open source: https://github.com/UncleK/SideX

────────────────────────
中文说明
────────────────────────
SideX 把 X 的评论区放到右侧。点击帖子正文或空白处，在保留主信息流位置的同时阅读回复。

主要功能
• 评论原位停靠在右侧，减少主信息流与详情页之间的来回切换。
• 帖子存在官方“显示更多”入口时，自动展开长文。
• 展开、收起回复分支，自定义二级回复默认展示数量，自动展示已加载的作者连续自回复。
• 默认二级回复数 N 可选 1/2/3/5，分支进入可见区域时按需补齐；首次加载更多追加 N+2 条，共最多 2N+2 条（例如 3 → 8），第二次展开并连续加载本条普通分支，收起或修改设置后回到 N。主列表自动加载默认开启，手动加载后暂停；不预取屏幕外分支，折叠回复仍需单独主动展开，失败、空页或重复游标会停止连续加载。
• 可选固定面板并高亮当前帖；固定后，点击外部、按 Esc 和站内导航会保留面板，仍可手动关闭或切帖。自动固定默认关闭，仅影响新打开的面板。
• 回复长正文默认完整显示，可关闭以折叠长文。
• 支持侧栏回复、图片附件，以及打开 X 官方回复框。
• 按帖子和回复对象分别保留文字草稿，切回时恢复；切帖、关闭直接响应，不弹出拦截提示。草稿在刷新页面或关闭标签页后清空，不保存图片附件。
• 图片旁评论区可选 SideX 或官方样式，与回复模式分别设置；收起看大图，展开保留评论位置和草稿。
• 引用正文默认最多 3 行，可就地展开和收起。
• 引用操作在当前页面打开 X 官方编辑器并显示原帖卡片；分享使用 X 官方菜单，选项跟随账号权限和媒体类型，也支持主页面未渲染的评论。
• 回复右上角提供 Grok 与官方三个点菜单，也支持主页面未渲染的评论；Grok、Chat 和官方菜单显示在 SideX 侧栏前方。
• 页面有对应原生帖子时，优先复用官方交互；其余评论通过当前 X 会话处理。
• 页面有对应原生用户入口时，显示完整官方悬浮卡；否则显示包含简介、关注数字和共同关注的后备卡片。
• 点击点赞后面的翻译图标显示或隐藏译文；默认使用 X 官方翻译，也可选择 Google，或使用已有翻译插件的划词／网页翻译。
• 跟随 X 主题，支持调整侧栏宽度。

1.1.34 更新
• 包含 X 原生文章引用出现大段空白的布局修复。
• 按所选默认数量补齐可见分支；首次再加载 N+2 条（例如 3 → 8），第二次展开本条全部普通回复。
• 设置分为“评论阅读”和“更多设置”，回复长正文默认完整显示，图片评论的 SideX 选项放在左侧。
• 可恢复全部选项和侧栏宽度，保留回复草稿；仅在修改后显示简短的刷新提示。

更新后
更新扩展或修改设置后，请刷新已打开的 X 页面。先发送或复制未完成的文字，刷新会清空临时草稿。此前明确关闭“完整显示回复长文”的设置会保留，可手动打开或恢复默认。

隐私说明
SideX 在浏览器中运行，没有 SideX 中转或统计服务器。扩展处理你打开的 X 内容，并复用当前 X 会话；文字草稿仅在当前页面暂存，不参与同步，回复及选择的附件发送给 X。点击 Grok 会通过 X 原生流程分析所选帖子，由 X/Grok 处理并遵循其服务条款与隐私政策。只有选择 Google 翻译并点击翻译时，正文才会直接发送给 Google，X 认证信息不会发给 Google。已有翻译插件遵循各自的设置和隐私政策。

快捷键：Esc 关闭当前浮层或未固定的评论区；固定按钮切换面板保留状态；关闭按钮关闭评论区并保留文字草稿；Ctrl + Enter 发送回复；Ctrl + V 粘贴图片。
SideX 与 X 官方无隶属或背书关系。
开源地址：https://github.com/UncleK/SideX
```
