# GitHub 自动任务

Issue 的新建、重新打开、编辑，以及 PR 的新建、重新打开、提交更新和 ready-for-review 会触发 `.github/workflows/codex-forward.yml`。相关作者或维护者可通过 `/codex ` 评论继续任务；普通评论和处理结果不会循环触发。

任务由本机 Codex App 固定会话 `GitHub 自动任务 · SideX` 处理，实际工作目录是 `E:\VP\SideX`，固定模型为 `gpt-6.1-sol`，推理强度为 `xhigh`。Setup 目录仅运行调度器、保存证据，业务源码与测试在 SideX 仓库中处理。每次结果评论包含对应会话和 Actions 链接。

先排查、实现和验证，再由调度器在项目目录独立执行 `npm test`。涉及 X 交互时仍须完成与变更相称的真实浏览器验证。只有确有产品变更、必要验证和独立测试通过后，才进入发布阶段。

发布沿用项目现有流程：同步版本与必要说明，使用 `scripts/package-store.ps1` 构建并校验商店 ZIP，提交、tag、push，发布 GitHub Release 并附 ZIP 与校验信息。Chrome Web Store 的最终提交是独立步骤。文档、分析和调度接入不升级产品版本、不制造 Release。

云端转发使用专用 GitHub App 的短期令牌，只能调度私有仓库的 Actions；转发工作流不 checkout 或执行 PR 代码。本机核验仓库 ID、源工作流、源运行和 PR 当前 head，保留既有未提交文件。所有者创建、标题以 `[dispatch-check]` 开头的 Issue/PR 用于只读接入验收，不修改或发布产品代码。
