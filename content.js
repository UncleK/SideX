(function initSidePeek() {
  "use strict";

  if (window.top !== window.self) return;

  const Core = globalThis.SidePeekCore;
  const ROOT_ID = "sidepeek-drawer-root";
  const CONTENT_SOURCE = "sidepeek-content";
  const PAGE_SOURCE = "sidepeek-page";

  // SVG Icons
  // SVG Icons (Official Phosphor Regular & Fill SVGs matching original peek)
  const ICONS = {
    reply: `<svg viewBox="0 0 256 256"><path d="M128,24A104,104,0,0,0,36.18,176.88L24.83,210.93a16,16,0,0,0,20.24,20.24l34.05-11.35A104,104,0,1,0,128,24Zm0,192a87.87,87.87,0,0,1-44.06-11.81,8,8,0,0,0-6.54-.67L40,216,52.47,178.6a8,8,0,0,0-.66-6.54A88,88,0,1,1,128,216Z"/></svg>`,
    repost: `<svg viewBox="0 0 256 256"><path d="M224,48V96a8,8,0,0,1-8,8H168a8,8,0,0,1,0-16h28.69L182.06,73.37a79.56,79.56,0,0,0-56.13-23.43h-.45A79.52,79.52,0,0,0,69.59,72.71,8,8,0,0,1,58.41,61.27a96,96,0,0,1,135,.79L208,76.69V48a8,8,0,0,1,16,0ZM186.41,183.29a80,80,0,0,1-112.47-.66L59.31,168H88a8,8,0,0,0,0-16H40a8,8,0,0,0-8,8v48a8,8,0,0,0,16,0V179.31l14.63,14.63A95.43,95.43,0,0,0,130,222.06h.53a95.36,95.36,0,0,0,67.07-27.33,8,8,0,0,0-11.18-11.44Z"/></svg>`,
    like: `<svg viewBox="0 0 256 256"><path d="M178,40c-20.65,0-38.73,8.88-50,23.89C116.73,48.88,98.65,40,78,40a62.07,62.07,0,0,0-62,62c0,70,103.79,126.66,108.21,129a8,8,0,0,0,7.58,0C136.21,228.66,240,172,240,102A62.07,62.07,0,0,0,178,40ZM128,214.8C109.74,204.16,32,155.69,32,102A46.06,46.06,0,0,1,78,56c19.45,0,35.78,10.36,42.6,27a8,8,0,0,0,14.8,0c6.82-16.67,23.15-27,42.6-27a46.06,46.06,0,0,1,46,46C224,155.61,146.24,204.15,128,214.8Z"/></svg>`,
    likeSolid: `<svg viewBox="0 0 256 256"><path d="M240,102c0,70-103.79,126.66-108.21,129a8,8,0,0,1-7.58,0C119.79,228.66,16,172,16,102A62.07,62.07,0,0,1,78,40c20.65,0,38.73,8.88,50,23.89C139.27,48.88,157.35,40,178,40A62.07,62.07,0,0,1,240,102Z"/></svg>`,
    bookmark: `<svg viewBox="0 0 256 256"><path d="M184,32H72A16,16,0,0,0,56,48V224a8,8,0,0,0,12.24,6.78L128,193.43l59.77,37.35A8,8,0,0,0,200,224V48A16,16,0,0,0,184,32Zm0,177.57-51.77-32.35a8,8,0,0,0-8.48,0L72,209.57V48H184Z"/></svg>`,
    bookmarkSolid: `<svg viewBox="0 0 256 256"><path d="M184,32H72A16,16,0,0,0,56,48V224a8,8,0,0,0,12.24,6.78L128,193.43l59.77,37.35A8,8,0,0,0,200,224V48A16,16,0,0,0,184,32Z"/></svg>`,
    share: `<svg viewBox="0 0 256 256"><path d="M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0ZM93.66,77.66,120,51.31V144a8,8,0,0,0,16,0V51.31l26.34,26.35a8,8,0,0,0,11.32-11.32l-40-40a8,8,0,0,0-11.32,0l-40,40A8,8,0,0,0,93.66,77.66Z"/></svg>`,
    close: `<svg viewBox="0 0 256 256"><path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"/></svg>`,
    back: `<svg viewBox="0 0 256 256"><path d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z"/></svg>`,
    external: `<svg viewBox="0 0 256 256"><path d="M224,104a8,8,0,0,1-16,0V59.32l-66.33,66.34a8,8,0,0,1-11.32-11.32L196.68,48H152a8,8,0,0,1,0-16h64a8,8,0,0,1,8,8Zm-40,24a8,8,0,0,0-8,8v72H48V80h72a8,8,0,0,0,0-16H48A16,16,0,0,0,32,80V208a16,16,0,0,0,16,16H176a16,16,0,0,0,16-16V136A8,8,0,0,0,184,128Z"/></svg>`,
    image: `<svg viewBox="0 0 256 256"><path d="M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40Zm0,16V158.75l-26.07-26.06a16,16,0,0,0-22.63,0l-20,20-44-44a16,16,0,0,0-22.62,0L40,149.37V56ZM40,172l52-52,80,80H40Zm176,28H194.63l-36-36,20-20L216,181.38V200ZM144,100a12,12,0,1,1,12,12A12,12,0,0,1,144,100Z"/></svg>`,
    resetWidth: `<svg viewBox="0 0 256 256"><path d="M224,128a96,96,0,1,1-21.84-60.61L224,48v48H176l18.53-18.53A80,80,0,1,0,207.82,136H224A95.54,95.54,0,0,1,224,128Z"/></svg>`,
    officialReply: `<svg viewBox="0 0 256 256"><path d="M200,32H56A16,16,0,0,0,40,48V216a8,8,0,0,0,13.15,6.18L88.76,192H200a16,16,0,0,0,16-16V48A16,16,0,0,0,200,32Zm0,144H86.11a8,8,0,0,0-5.15,1.86L56,198.85V48H200ZM144,96a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h40A8,8,0,0,1,144,96Zm32,32a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h72A8,8,0,0,1,176,128Z"/></svg>`,
    user: `<svg viewBox="0 0 256 256"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24ZM74.08,197.5a64,64,0,0,1,107.84,0,87.83,87.83,0,0,1-107.84,0ZM128,120a40,40,0,1,1,40-40A40,40,0,0,1,128,120Zm65.2,66.19a79.89,79.89,0,0,0-36.06-28.74,56,56,0,1,0-58.28,0,79.89,79.89,0,0,0-36.06,28.74,88,88,0,1,1,130.4,0Z"/></svg>`
  };

  const state = {
    open: false,
    focalTweetId: null,
    focalArticle: null,
    focalModel: null,
    replies: [],
    tree: null,
    expandedThreadIds: new Set(),
    activeView: "root", // "root" or { type: "drilldown", parentId: string }
    activeComposerReplyId: null,
    loading: false,
    error: "",
    isResizing: false
  };

  const pendingRequests = new Map();
  let requestSequence = 0;

  function requestPage(type, payload, timeoutMs = 18000) {
    const requestId = ++requestSequence;
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        pendingRequests.delete(requestId);
        reject(new Error("等待 X 响应超时，请刷新重试"));
      }, timeoutMs);
      pendingRequests.set(requestId, { resolve, reject, timer });
      window.postMessage({ source: CONTENT_SOURCE, type, requestId, ...payload }, location.origin);
    });
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== location.origin || event.data?.source !== PAGE_SOURCE) return;
    const request = pendingRequests.get(event.data.requestId);
    if (!request) return;
    window.clearTimeout(request.timer);
    pendingRequests.delete(event.data.requestId);
    if (event.data.ok) request.resolve(event.data.payload);
    else request.reject(new Error(event.data.error || "X 请求失败"));
  });

  function currentThemeClass() {
    const color = getComputedStyle(document.body).backgroundColor;
    if (/rgb\(0, 0, 0\)/.test(color)) return "sidepeek-theme-dark";
    if (/rgb\((?:21|22), (?:31|32), (?:42|43)\)/.test(color)) return "sidepeek-theme-dim";
    return "sidepeek-theme-light";
  }

  function formatCount(number) {
    if (!number || number <= 0) return "";
    if (number >= 10000) return `${(number / 10000).toFixed(1)}万`;
    if (number >= 1000) return `${(number / 1000).toFixed(1)}k`;
    return String(number);
  }

  function formatTime(dateString) {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return "刚刚";
    if (diff < 3600) return `${Math.floor(diff / 60)}分`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}小时`;
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  }

  // ==========================================================================
  // Drawer DOM Setup & Layout Positioning
  // ==========================================================================
  function ensureDrawerRoot() {
    let root = document.getElementById(ROOT_ID);
    if (!root) {
      root = document.createElement("aside");
      root.id = ROOT_ID;
      root.className = currentThemeClass();
      document.body.appendChild(root);
    } else {
      root.className = currentThemeClass();
    }
    return root;
  }

  function getCurrentUserAvatar() {
    const avatarImg = document.querySelector(
      '[data-testid="SideNav_AccountSwitcher_Button"] img, header [data-testid="UserAvatar-Container-unknown"] img, [data-testid="tweetTextarea_0"] img'
    );
    return avatarImg?.src || "";
  }

  function updateDrawerPosition() {
    const root = document.getElementById(ROOT_ID);
    if (!root || !state.open) return;

    // 使用全新键名，避免继承旧版误保存的大宽度数据
    const savedWidth = Number(localStorage.getItem("sidepeek_custom_width_v2"));
    const sidebar = document.querySelector('[data-testid="sidebarColumn"]');

    if (sidebar) {
      const rect = sidebar.getBoundingClientRect();
      const minWidth = Math.round(rect.width) || 350;
      // 保证最大宽度永远留出至少 12px 边距，确保拖拽到最右侧时不会被浏览器边缘截断或丢失光标
      const maxWidth = Math.max(minWidth, Math.round(window.innerWidth - rect.left) - 12);

      // 默认宽度严格与原生第三列一致（约 350px）
      let targetWidth = minWidth;
      if (savedWidth && savedWidth >= minWidth) {
        targetWidth = Math.min(maxWidth, savedWidth);
      }

      root.style.left = `${rect.left}px`;
      root.style.width = `${targetWidth}px`;
      root.style.right = "auto";
    } else {
      const savedWidth = Number(localStorage.getItem("sidepeek_custom_width_v2")) || 380;
      root.style.right = "0px";
      root.style.left = "auto";
      root.style.width = `${savedWidth}px`;
    }
  }

  function initResizeHandle(root) {
    const handleRight = root.querySelector(".sidepeek-resize-handle-right");
    const handleLeft = root.querySelector(".sidepeek-resize-handle-left");
    const resetBtn = root.querySelector(".sidepeek-btn-reset-width");

    function resetWidth() {
      localStorage.removeItem("sidepeek_custom_width_v2");
      updateDrawerPosition();
      showToast("已恢复默认宽度");
    }

    resetBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      resetWidth();
    });

    function bindDrag(handle, isLeft) {
      if (!handle) return;

      handle.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        handle.classList.add("dragging");
        document.body.style.userSelect = "none";
        document.body.style.cursor = "col-resize";
        state.isResizing = true;

        const sidebar = document.querySelector('[data-testid="sidebarColumn"]');
        const minWidth = sidebar ? Math.round(sidebar.getBoundingClientRect().width) : 350;
        const initialRect = root.getBoundingClientRect();
        let hasMoved = false;

        function onMouseMove(moveEvent) {
          hasMoved = true;
          if (isLeft) {
            // 拖动左边缘：向左拉宽，向右缩窄（以右边缘为固定锚点）
            let newWidth = initialRect.right - moveEvent.clientX;
            const maxLeftWidth = Math.min(
              window.innerWidth - 80,
              Math.round(initialRect.right - 100)
            );
            newWidth = Math.min(maxLeftWidth, Math.max(minWidth, newWidth));
            const newLeft = initialRect.right - newWidth;

            root.style.left = `${newLeft}px`;
            root.style.width = `${newWidth}px`;
            root.style.right = "auto";
            localStorage.setItem("sidepeek_custom_width_v2", String(Math.round(newWidth)));
          } else {
            // 拖动右边缘：向右拉宽，向左缩窄（以左边缘为固定锚点）
            const leftEdge = root.getBoundingClientRect().left;
            const maxWidth = Math.max(minWidth, Math.round(window.innerWidth - leftEdge) - 12);

            let newWidth = moveEvent.clientX - leftEdge;
            newWidth = Math.min(maxWidth, Math.max(minWidth, newWidth));

            root.style.width = `${newWidth}px`;
            localStorage.setItem("sidepeek_custom_width_v2", String(Math.round(newWidth)));
          }
        }

        function onMouseUp() {
          handle.classList.remove("dragging");
          document.body.style.userSelect = "";
          document.body.style.cursor = "";
          window.removeEventListener("mousemove", onMouseMove);
          window.removeEventListener("mouseup", onMouseUp);

          if (hasMoved) {
            // 彻底拦截本次拖拽释放时触发的 click 事件，防止被 handleTimelineClick 识别为“点击外部空白”而意外关闭抽屉
            const captureClick = (clickEvent) => {
              clickEvent.preventDefault();
              clickEvent.stopPropagation();
              clickEvent.stopImmediatePropagation();
              window.removeEventListener("click", captureClick, true);
            };
            window.addEventListener("click", captureClick, true);
            setTimeout(() => {
              window.removeEventListener("click", captureClick, true);
              state.isResizing = false;
            }, 120);
          } else {
            state.isResizing = false;
          }
        }

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
      });

      handle.addEventListener("dblclick", (e) => {
        e.preventDefault();
        e.stopPropagation();
        resetWidth();
      });
    }

    bindDrag(handleRight, false);
    bindDrag(handleLeft, true);
  }

  window.addEventListener("resize", updateDrawerPosition);

  // ==========================================================================
  // UI Rendering
  // ==========================================================================
  function renderDrawer() {
    const root = ensureDrawerRoot();
    if (!state.open) {
      root.classList.remove("sidepeek-open");
      return;
    }

    updateDrawerPosition();
    root.classList.add("sidepeek-open");

    const isDrillDown = state.activeView && typeof state.activeView === "object" && state.activeView.type === "drilldown";
    const drillDownParent = isDrillDown ? state.tree?.byId.get(state.activeView.parentId) : null;
    const userAvatar = getCurrentUserAvatar();
    const replyPlaceholder = isDrillDown
      ? `回复 @${drillDownParent?.author?.handle || "此人"}...`
      : `回复 @${state.focalModel?.author?.handle || "楼主"}... (按 Ctrl+Enter 发送)`;

    root.innerHTML = `
      <div class="sidepeek-resize-handle sidepeek-resize-handle-left" title="拖动左边缘调整宽度，双击恢复默认">
        <div class="sidepeek-resize-grip"></div>
      </div>
      <div class="sidepeek-resize-handle sidepeek-resize-handle-right" title="拖动右边缘调整宽度，双击恢复默认">
        <div class="sidepeek-resize-grip"></div>
      </div>
      <header class="sidepeek-header">
        <div class="sidepeek-title-wrap">
          ${isDrillDown ? `<button type="button" class="sidepeek-back-btn" aria-label="返回全部评论">${ICONS.back}</button>` : ""}
          <span class="sidepeek-title">${isDrillDown ? "对话分支" : "SideX"}</span>
          <span class="sidepeek-count-badge">(${isDrillDown ? (state.tree?.childrenMap.get(drillDownParent?.id)?.length || 0) : (state.tree?.rootReplies.length || 0)})</span>
        </div>
        <div class="sidepeek-header-actions">
          <button type="button" class="sidepeek-icon-btn sidepeek-btn-reset-width" title="恢复默认宽度">${ICONS.resetWidth}</button>
          ${state.focalModel?.url ? `<a href="${state.focalModel.url}" target="_blank" class="sidepeek-icon-btn" title="在 X 详情页打开">${ICONS.external}</a>` : ""}
          <button type="button" class="sidepeek-icon-btn sidepeek-btn-close" aria-label="关闭侧栏">${ICONS.close}</button>
        </div>
      </header>
      <div class="sidepeek-body"></div>
      <footer class="sidepeek-footer-composer">
        <div class="sidepeek-footer-inner">
          <div class="sidepeek-footer-avatar-wrap">
            ${userAvatar ? `<img src="${userAvatar}" class="sidepeek-footer-avatar" alt="" />` : `<div class="sidepeek-footer-avatar-default">${ICONS.user}</div>`}
          </div>
          <div class="sidepeek-footer-main">
            <textarea class="sidepeek-footer-textarea" rows="1" placeholder="${replyPlaceholder}"></textarea>
            <div class="sidepeek-footer-preview-area"></div>
            <div class="sidepeek-footer-toolbar">
              <div class="sidepeek-footer-tools">
                <label class="sidepeek-tool-btn sidepeek-tool-media" title="添加图片 (支持 Ctrl+V 粘贴)">
                  <input type="file" accept="image/*" class="sidepeek-media-file-input" style="display:none;" />
                  ${ICONS.image}
                </label>
                <button type="button" class="sidepeek-tool-btn sidepeek-tool-official" title="使用官方回复弹窗 (支持表情/投票/GIF)">
                  ${ICONS.officialReply}
                </button>
              </div>
              <div class="sidepeek-footer-actions">
                <span class="sidepeek-footer-hint">Ctrl+Enter</span>
                <button type="button" class="sidepeek-footer-submit-btn" disabled>回复</button>
              </div>
            </div>
          </div>
        </div>
      </footer>
    `;

    initResizeHandle(root);
    initFooterComposer(root, isDrillDown, drillDownParent);

    // Event listeners on header
    root.querySelector(".sidepeek-btn-close")?.addEventListener("click", closeDrawer);
    if (isDrillDown) {
      root.querySelector(".sidepeek-back-btn")?.addEventListener("click", () => {
        state.activeView = "root";
        renderDrawer();
      });
    }

    const body = root.querySelector(".sidepeek-body");

    if (state.loading) {
      body.innerHTML = `
        <div class="sidepeek-loading-box">
          <div class="sidepeek-spinner"></div>
          <span>正在加载评论...</span>
        </div>`;
      return;
    }

    if (state.error) {
      body.innerHTML = `
        <div class="sidepeek-empty-box">
          <span>${state.error}</span>
          <button type="button" class="sidepeek-btn-submit sidepeek-retry-btn">重试</button>
        </div>`;
      body.querySelector(".sidepeek-retry-btn")?.addEventListener("click", () => fetchThread(state.focalTweetId));
      return;
    }

    if (isDrillDown && drillDownParent) {
      // Render the parent comment first
      const parentNode = renderCommentNode(drillDownParent, true);
      body.appendChild(parentNode);

      // Render children
      const children = state.tree?.childrenMap.get(drillDownParent.id) || [];
      if (children.length === 0) {
        const empty = document.createElement("div");
        empty.className = "sidepeek-empty-box";
        empty.textContent = "暂无更多子回复";
        body.appendChild(empty);
      } else {
        for (let i = 0; i < children.length; i++) {
          const hasNext = i < children.length - 1;
          body.appendChild(renderCommentNode(children[i], hasNext, true));
        }
      }
    } else {
      // Root view: 默认直接展开二级回复
      const roots = state.tree?.rootReplies || [];
      if (roots.length === 0) {
        body.innerHTML = `<div class="sidepeek-empty-box"><span>暂无评论，快来抢沙发吧~</span></div>`;
        return;
      }

      const INLINE_LIMIT = 2; // 默认就地展示最多 2 条二级回复

      for (const rootReply of roots) {
        const children = state.tree?.childrenMap.get(rootReply.id) || [];
        const childrenCount = children.length;

        if (childrenCount === 0) {
          body.appendChild(renderCommentNode(rootReply, false));
        } else {
          const threadGroup = document.createElement("div");
          threadGroup.className = "sidepeek-thread-group";

          // 父评论带有向下连接子评论的 Thread Line
          threadGroup.appendChild(renderCommentNode(rootReply, true));

          const isExpanded = state.expandedThreadIds.has(rootReply.id);
          const showAll = isExpanded || childrenCount <= INLINE_LIMIT;
          const visibleChildren = showAll ? children : children.slice(0, INLINE_LIMIT);

          for (let i = 0; i < visibleChildren.length; i++) {
            const child = visibleChildren[i];
            const isLast = (i === visibleChildren.length - 1) && (showAll || isExpanded);
            const childHasLine = !isLast;
            threadGroup.appendChild(renderCommentNode(child, childHasLine, true));
          }

          if (!showAll) {
            const remaining = childrenCount - INLINE_LIMIT;
            const moreBtn = document.createElement("button");
            moreBtn.type = "button";
            moreBtn.className = "sidepeek-drilldown-trigger";
            moreBtn.textContent = `展开另外 ${remaining} 条回复`;
            moreBtn.addEventListener("click", () => {
              state.expandedThreadIds.add(rootReply.id);
              renderDrawer();
            });
            threadGroup.appendChild(moreBtn);
          } else if (childrenCount > INLINE_LIMIT && isExpanded) {
            const collapseBtn = document.createElement("button");
            collapseBtn.type = "button";
            collapseBtn.className = "sidepeek-drilldown-trigger";
            collapseBtn.textContent = `收起回复`;
            collapseBtn.addEventListener("click", () => {
              state.expandedThreadIds.delete(rootReply.id);
              renderDrawer();
            });
            threadGroup.appendChild(collapseBtn);
          }

          body.appendChild(threadGroup);
        }
      }
    }
  }

  function renderCommentNode(model, hasThreadLine = false, isChild = false) {
    const item = document.createElement("article");
    item.className = `sidepeek-comment-item${isChild ? " sidepeek-child-comment" : ""}`;
    item.dataset.id = model.id;

    item.innerHTML = `
      <div class="sidepeek-avatar-col">
        <img class="sidepeek-avatar" src="${model.author.avatar}" alt="${model.author.name}" />
        ${hasThreadLine ? '<div class="sidepeek-thread-line"></div>' : ""}
      </div>
      <div class="sidepeek-content-col">
        <div class="sidepeek-author-row">
          <a class="sidepeek-name" href="https://x.com/${model.author.handle}" target="_blank">${model.author.name}</a>
          ${model.author.verified ? `<span class="sidepeek-verified-badge">✓</span>` : ""}
          <span class="sidepeek-handle">@${model.author.handle}</span>
          <span class="sidepeek-dot">·</span>
          <a class="sidepeek-time" href="${model.url}" target="_blank">${formatTime(model.createdAt)}</a>
        </div>
        ${model.inReplyToHandle ? `<div class="sidepeek-reply-to-tag">回复 <a href="https://x.com/${model.inReplyToHandle}" target="_blank">@${model.inReplyToHandle}</a></div>` : ""}
        <div class="sidepeek-text">${escapeHtml(model.text)}</div>
        ${renderMediaBox(model.media)}
        <div class="sidepeek-action-bar">
          <button type="button" class="sidepeek-action-btn sidepeek-act-reply" title="回复">
            <span class="sidepeek-action-btn-surface">${ICONS.reply} <span>${formatCount(model.counts.replies)}</span></span>
          </button>
          <button type="button" class="sidepeek-action-btn sidepeek-act-repost ${model.flags.reposted ? "active" : ""}" title="转发">
            <span class="sidepeek-action-btn-surface">${ICONS.repost} <span>${formatCount(model.counts.reposts)}</span></span>
          </button>
          <button type="button" class="sidepeek-action-btn sidepeek-act-like ${model.flags.liked ? "active" : ""}" title="喜欢">
            <span class="sidepeek-action-btn-surface">${model.flags.liked ? ICONS.likeSolid : ICONS.like} <span>${formatCount(model.counts.likes)}</span></span>
          </button>
          <button type="button" class="sidepeek-action-btn sidepeek-act-bookmark ${model.flags.bookmarked ? "active" : ""}" title="书签">
            <span class="sidepeek-action-btn-surface">${model.flags.bookmarked ? ICONS.bookmarkSolid : ICONS.bookmark}</span>
          </button>
          <button type="button" class="sidepeek-action-btn sidepeek-act-share" title="复制链接">
            <span class="sidepeek-action-btn-surface">${ICONS.share}</span>
          </button>
        </div>
        <!-- Inline Accordion Composer Container -->
        <div class="sidepeek-inline-composer" id="composer-${model.id}"></div>
      </div>
    `;

    // Drilldown click
    item.querySelector(".sidepeek-drilldown-trigger")?.addEventListener("click", () => {
      state.activeView = { type: "drilldown", parentId: model.id };
      renderDrawer();
    });

    // Action handlers
    const actReply = item.querySelector(".sidepeek-act-reply");
    const actRepost = item.querySelector(".sidepeek-act-repost");
    const actLike = item.querySelector(".sidepeek-act-like");
    const actBookmark = item.querySelector(".sidepeek-act-bookmark");
    const actShare = item.querySelector(".sidepeek-act-share");

    actReply?.addEventListener("click", () => toggleInlineComposer(model));
    actRepost?.addEventListener("click", () => handleToggleAction(model, "repost", actRepost));
    actLike?.addEventListener("click", () => handleToggleAction(model, "like", actLike));
    actBookmark?.addEventListener("click", () => handleToggleAction(model, "bookmark", actBookmark));
    actShare?.addEventListener("click", () => handleShare(model));

    // Image zoom / lightbox click
    item.querySelectorAll(".sidepeek-zoomable-img").forEach((img) => {
      img.addEventListener("click", (e) => {
        e.stopPropagation();
        openLightbox(img.dataset.full || img.src);
      });
    });

    // If composer is active for this item
    if (state.activeComposerReplyId === model.id) {
      renderInlineComposer(item.querySelector(`#composer-${model.id}`), model);
    }

    return item;
  }

  function renderMediaBox(mediaList) {
    if (!mediaList || mediaList.length === 0) return "";
    const photos = mediaList.filter((m) => m.type === "photo");
    if (photos.length > 0) {
      const count = Math.min(photos.length, 4);
      let itemsHtml = "";
      for (let i = 0; i < count; i++) {
        const p = photos[i];
        const highRes = p.url ? `${p.url.split("?")[0]}?name=large` : p.url;
        itemsHtml += `
          <div class="sidepeek-media-item">
            <img class="sidepeek-zoomable-img" src="${p.url}" data-full="${highRes}" loading="lazy" alt="" />
          </div>`;
      }
      return `<div class="sidepeek-media-grid grid-${count}">${itemsHtml}</div>`;
    }

    const video = mediaList.find((m) => m.type === "video" || m.type === "animated_gif");
    if (video) {
      return `<div class="sidepeek-media-box"><video src="${video.videoUrl}" controls playsinline preload="metadata"></video></div>`;
    }
    return "";
  }

  function openLightbox(imgSrc) {
    let lightbox = document.getElementById("sidepeek-lightbox");
    if (!lightbox) {
      lightbox = document.createElement("div");
      lightbox.id = "sidepeek-lightbox";
      lightbox.innerHTML = `
        <div class="sidepeek-lightbox-backdrop"></div>
        <div class="sidepeek-lightbox-content">
          <img class="sidepeek-lightbox-img" src="" alt="" />
          <button type="button" class="sidepeek-lightbox-close" title="关闭">✕</button>
        </div>
      `;
      document.body.appendChild(lightbox);
      lightbox.querySelector(".sidepeek-lightbox-backdrop")?.addEventListener("click", (e) => {
        e.stopPropagation();
        e.stopImmediatePropagation();
        closeLightbox();
      });
      lightbox.querySelector(".sidepeek-lightbox-close")?.addEventListener("click", (e) => {
        e.stopPropagation();
        e.stopImmediatePropagation();
        closeLightbox();
      });
      lightbox.querySelector(".sidepeek-lightbox-img")?.addEventListener("click", (e) => {
        e.stopPropagation();
        e.stopImmediatePropagation();
      });
    }
    const imgEl = lightbox.querySelector(".sidepeek-lightbox-img");
    if (imgEl) imgEl.src = imgSrc;
    lightbox.classList.add("active");
  }

  function closeLightbox() {
    document.getElementById("sidepeek-lightbox")?.classList.remove("active");
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text || "";
    return div.innerHTML;
  }

  // ==========================================================================
  // Inline Accordion Composer & Paste Image Upload
  // ==========================================================================
  function toggleInlineComposer(model) {
    if (state.activeComposerReplyId === model.id) {
      state.activeComposerReplyId = null;
    } else {
      state.activeComposerReplyId = model.id;
    }
    renderDrawer();
  }

  function renderInlineComposer(container, targetModel) {
    if (!container) return;
    container.classList.add("expanded");

    let pastedMediaId = null;
    let pastedBlob = null;

    container.innerHTML = `
      <div class="sidepeek-composer-inner">
        <textarea class="sidepeek-composer-textarea" placeholder="回复 @${targetModel.author.handle}... (支持 Ctrl+V 粘贴图片)"></textarea>
        <div class="sidepeek-composer-preview-area"></div>
        <div class="sidepeek-composer-footer">
          <span class="sidepeek-composer-hint">按 Ctrl+Enter 发送</span>
          <div class="sidepeek-composer-btns">
            <button type="button" class="sidepeek-btn-cancel">取消</button>
            <button type="button" class="sidepeek-btn-submit">发送</button>
          </div>
        </div>
      </div>
    `;

    const textarea = container.querySelector(".sidepeek-composer-textarea");
    const previewArea = container.querySelector(".sidepeek-composer-preview-area");
    const cancelBtn = container.querySelector(".sidepeek-btn-cancel");
    const submitBtn = container.querySelector(".sidepeek-btn-submit");

    textarea.focus();

    cancelBtn.addEventListener("click", () => {
      container.classList.remove("expanded");
      state.activeComposerReplyId = null;
    });

    // Paste Image listener
    textarea.addEventListener("paste", async (event) => {
      const items = event.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          event.preventDefault();
          const file = item.getAsFile();
          if (!file) continue;

          pastedBlob = file;
          const reader = new FileReader();
          reader.onload = async () => {
            const dataUrl = reader.result;
            const base64 = dataUrl.split(",")[1];

            // Render thumbnail preview immediately
            previewArea.innerHTML = `
              <div class="sidepeek-pasted-preview">
                <img src="${dataUrl}" alt="" />
                <button type="button" class="sidepeek-remove-img-btn" title="删除图片">✕</button>
              </div>
            `;
            previewArea.querySelector(".sidepeek-remove-img-btn")?.addEventListener("click", () => {
              previewArea.innerHTML = "";
              pastedMediaId = null;
              pastedBlob = null;
            });

            // Upload via page-bridge in background
            try {
              submitBtn.disabled = true;
              submitBtn.textContent = "上传中...";
              const res = await requestPage("UPLOAD_MEDIA", { base64, mimeType: file.type, size: file.size });
              pastedMediaId = res.mediaId;
            } catch (err) {
              alert(err.message || "图片上传失败");
              previewArea.innerHTML = "";
              pastedMediaId = null;
            } finally {
              submitBtn.disabled = false;
              submitBtn.textContent = "发送";
            }
          };
          reader.readAsDataURL(file);
          break;
        }
      }
    });

    // Submit handler
    async function doSubmit() {
      const text = textarea.value.trim();
      if (!text && !pastedMediaId) return;

      submitBtn.disabled = true;
      submitBtn.textContent = "发送中...";

      try {
        const mediaIds = pastedMediaId ? [pastedMediaId] : [];
        await requestPage("CREATE_REPLY", {
          tweetId: targetModel.id,
          text,
          mediaIds
        });

        // Close composer and reload/update thread
        state.activeComposerReplyId = null;
        fetchThread(state.focalTweetId);
      } catch (err) {
        alert(err.message || "回复发送失败，请重试");
        submitBtn.disabled = false;
        submitBtn.textContent = "发送";
      }
    }

    submitBtn.addEventListener("click", doSubmit);
    textarea.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        doSubmit();
      }
    });
  }

  function initFooterComposer(root, isDrillDown, drillDownParent) {
    const footer = root.querySelector(".sidepeek-footer-composer");
    if (!footer) return;

    const textarea = footer.querySelector(".sidepeek-footer-textarea");
    const previewArea = footer.querySelector(".sidepeek-footer-preview-area");
    const submitBtn = footer.querySelector(".sidepeek-footer-submit-btn");
    const fileInput = footer.querySelector(".sidepeek-media-file-input");
    const officialBtn = footer.querySelector(".sidepeek-tool-official");

    let pastedMediaId = null;
    let pastedBlob = null;

    const targetTweetId = isDrillDown && drillDownParent ? drillDownParent.id : state.focalTweetId;

    // 尽量复用官方回复功能：点击触发官方原生回复弹窗
    officialBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!isDrillDown && state.focalArticle) {
        const nativeBtn = state.focalArticle.querySelector('[data-testid="reply"]');
        if (nativeBtn) {
          nativeBtn.click();
          return;
        }
      }
      const tweetArticle = document.querySelector(`article[data-testid="tweet"] a[href*="${targetTweetId}"]`)?.closest('article[data-testid="tweet"]');
      const nativeBtn = tweetArticle?.querySelector('[data-testid="reply"]');
      if (nativeBtn) {
        nativeBtn.click();
      } else {
        textarea?.focus();
        showToast("已聚焦输入框，可直接输入回复");
      }
    });

    // 自动高度与提交按钮状态
    textarea?.addEventListener("input", () => {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
      const hasContent = textarea.value.trim().length > 0 || pastedMediaId !== null;
      submitBtn.disabled = !hasContent;
    });

    function handleImageFile(file) {
      if (!file || !file.type.startsWith("image/")) return;
      pastedBlob = file;
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result;
        const base64 = dataUrl.split(",")[1];

        previewArea.innerHTML = `
          <div class="sidepeek-pasted-preview">
            <img src="${dataUrl}" alt="" />
            <button type="button" class="sidepeek-remove-img-btn" title="删除图片">✕</button>
          </div>
        `;
        previewArea.querySelector(".sidepeek-remove-img-btn")?.addEventListener("click", () => {
          previewArea.innerHTML = "";
          pastedMediaId = null;
          pastedBlob = null;
          submitBtn.disabled = !textarea.value.trim();
        });

        try {
          submitBtn.disabled = true;
          submitBtn.textContent = "上传中...";
          const res = await requestPage("UPLOAD_MEDIA", { base64, mimeType: file.type, size: file.size });
          pastedMediaId = res.mediaId;
          submitBtn.disabled = false;
        } catch (err) {
          alert(err.message || "图片上传失败");
          previewArea.innerHTML = "";
          pastedMediaId = null;
        } finally {
          submitBtn.textContent = "回复";
          submitBtn.disabled = !(textarea.value.trim() || pastedMediaId);
        }
      };
      reader.readAsDataURL(file);
    }

    fileInput?.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (file) handleImageFile(file);
      fileInput.value = "";
    });

    textarea?.addEventListener("paste", (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) handleImageFile(file);
          break;
        }
      }
    });

    async function doSubmit() {
      const text = textarea.value.trim();
      if (!text && !pastedMediaId) return;

      submitBtn.disabled = true;
      submitBtn.textContent = "发送中...";

      try {
        const mediaIds = pastedMediaId ? [pastedMediaId] : [];
        await requestPage("CREATE_REPLY", {
          tweetId: targetTweetId,
          text,
          mediaIds
        });

        // 重置编辑框状态
        textarea.value = "";
        textarea.style.height = "auto";
        previewArea.innerHTML = "";
        pastedMediaId = null;
        pastedBlob = null;
        submitBtn.textContent = "回复";
        submitBtn.disabled = true;

        showToast("回复已发布");
        // 自动重新加载评论流，新回复立即呈现于列表顶部
        fetchThread(state.focalTweetId);
      } catch (err) {
        alert(err.message || "回复发送失败，请重试");
        submitBtn.disabled = false;
        submitBtn.textContent = "回复";
      }
    }

    submitBtn?.addEventListener("click", doSubmit);
    textarea?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        doSubmit();
      }
    });
  }

  // ==========================================================================
  // Action Handlers (Like, Repost, Bookmark, Share)
  // ==========================================================================
  async function handleToggleAction(model, action, btnElement) {
    const flag = action === "like" ? "liked" : action === "repost" ? "reposted" : "bookmarked";
    const countProp = action === "like" ? "likes" : action === "repost" ? "reposts" : "bookmarks";
    const wasActive = Boolean(model.flags[flag]);

    // Optimistic UI update
    model.flags[flag] = !wasActive;
    model.counts[countProp] = Math.max(0, model.counts[countProp] + (wasActive ? -1 : 1));

    btnElement.classList.toggle("active", model.flags[flag]);
    const iconSpan = btnElement.querySelector(".sidepeek-action-btn-surface");
    if (action === "like") {
      iconSpan.innerHTML = `${model.flags.liked ? ICONS.likeSolid : ICONS.like} <span>${formatCount(model.counts.likes)}</span>`;
    } else if (action === "repost") {
      iconSpan.innerHTML = `${ICONS.repost} <span>${formatCount(model.counts.reposts)}</span>`;
    } else if (action === "bookmark") {
      iconSpan.innerHTML = `${model.flags.bookmarked ? ICONS.bookmarkSolid : ICONS.bookmark}`;
    }

    try {
      await requestPage("TOGGLE_ACTION", {
        tweetId: model.id,
        action,
        active: wasActive
      });
    } catch {
      // Revert on failure
      model.flags[flag] = wasActive;
      model.counts[countProp] = Math.max(0, model.counts[countProp] + (wasActive ? 1 : -1));
      btnElement.classList.toggle("active", wasActive);
    }
  }

  function handleShare(model) {
    if (!model.url) return;
    navigator.clipboard.writeText(model.url).then(() => {
      showToast("已复制推文链接到剪贴板");
    }).catch(() => {
      showToast("复制链接失败");
    });
  }

  function showToast(text) {
    let toast = document.getElementById("sidepeek-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "sidepeek-toast";
      toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(15, 20, 25, 0.9);
        color: #ffffff;
        padding: 8px 16px;
        border-radius: 9999px;
        font-size: 13px;
        z-index: 2147483647;
        pointer-events: none;
        transition: opacity 0.2s ease;
      `;
      document.body.appendChild(toast);
    }
    toast.textContent = text;
    toast.style.opacity = "1";
    setTimeout(() => { toast.style.opacity = "0"; }, 2000);
  }

  // ==========================================================================
  // Timeline Click Interceptor & Focal Tweet Show More
  // ==========================================================================
  async function fetchThread(tweetId) {
    state.loading = true;
    state.error = "";
    state.expandedThreadIds.clear();
    renderDrawer();

    try {
      const json = await requestPage("READ_THREAD", { tweetId });
      const { focal, replies } = Core.parseTweetDetail(json, tweetId);
      state.focalModel = focal;
      state.replies = replies;
      state.tree = Core.buildConversationTree(replies, tweetId);
      state.loading = false;
      renderDrawer();
    } catch (err) {
      state.loading = false;
      state.error = err.message || "读取评论失败，请重试";
      renderDrawer();
    }
  }

  function openDrawerForTweet(tweetId, articleNode) {
    // 1. Update focal tweet highlight
    if (state.focalArticle) {
      state.focalArticle.classList.remove("sidepeek-focal-active");
    }
    state.focalArticle = articleNode;
    state.focalArticle?.classList.add("sidepeek-focal-active");

    // 2. Expand "Show more" on focal tweet automatically
    const showMoreBtn = articleNode?.querySelector?.('[data-testid="tweet-text-show-more-link"]');
    if (showMoreBtn) {
      showMoreBtn.click();
    }

    // 3. Open drawer & fetch replies
    state.open = true;
    state.focalTweetId = tweetId;
    state.activeView = "root";
    state.activeComposerReplyId = null;
    renderDrawer();
    fetchThread(tweetId);
  }

  function closeDrawer() {
    state.open = false;
    if (state.focalArticle) {
      state.focalArticle.classList.remove("sidepeek-focal-active");
      state.focalArticle = null;
    }
    renderDrawer();
  }

  function shouldSkipClick(target) {
    return Boolean(
      target.closest("a[href]") ||
      target.closest("button") ||
      target.closest('[role="button"]') ||
      target.closest("video") ||
      target.closest("audio") ||
      target.closest("input") ||
      target.closest("textarea") ||
      target.closest('[data-testid="like"]') ||
      target.closest('[data-testid="retweet"]') ||
      target.closest('[data-testid="reply"]') ||
      target.closest('[data-testid="bookmark"]') ||
      target.closest('[data-testid="tweet-text-show-more-link"]')
    );
  }

  function handleTimelineClick(event) {
    if (state.isResizing) return;
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;

    // If clicked inside our drawer or lightbox, don't handle as timeline click
    const drawer = document.getElementById(ROOT_ID);
    if (drawer && drawer.contains(event.target)) return;

    const lightbox = document.getElementById("sidepeek-lightbox");
    if (lightbox && lightbox.contains(event.target)) return;

    const article = event.target.closest?.('article[data-testid="tweet"]');
    if (!article) {
      // Clicked blank space outside drawer -> close drawer
      if (state.open && drawer && !drawer.contains(event.target)) {
        closeDrawer();
      }
      return;
    }

    if (shouldSkipClick(event.target)) return;

    // Find tweet URL & ID
    const hrefs = [...article.querySelectorAll('a[href*="/status/"]')].map(a => a.getAttribute("href"));
    const ownUrl = Core.selectOwnPostUrl(hrefs, null, location.href);
    const tweetId = ownUrl ? Core.postIdFromUrl(ownUrl) : null;

    if (!tweetId) return;

    // Prevent default navigation to detail page!
    event.preventDefault();
    event.stopImmediatePropagation();

    openDrawerForTweet(tweetId, article);
  }

  document.addEventListener("click", handleTimelineClick, true);

  // ESC key to close (Lightbox first, then Drawer)
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      const lightbox = document.getElementById("sidepeek-lightbox");
      if (lightbox && lightbox.classList.contains("active")) {
        closeLightbox();
        return;
      }
      if (state.open) {
        closeDrawer();
      }
    }
  });
})();
