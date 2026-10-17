# Privacy Policy for SideX

**Last updated:** October 17, 2026

Thank you for choosing **SideX** ("the Extension"). We respect your privacy and are committed to protecting it. This Privacy Policy explains our practices regarding user data and permissions.

---

### 1. Browser Processing and Network Requests
SideX is a completely client-side productivity extension:
- **Data Used for Features:** SideX processes the X posts and profiles you open, relationship information shown in profile cards, and text/media you choose to submit as replies. It uses the current X session for authenticated requests. It does not build a browsing-history log, run analytics, or read your password.
- **No SideX Servers:** SideX does not operate remote servers, analytics, or telemetry services. Requests go directly from the browser to X, media hosts, and, when selected, Google Translation. These services receive the network information required to serve a request.
- **Text Drafts:** Unsent quick-reply text is kept separately per post and reply target in the current page's memory. It is not synced or saved to disk by SideX and is cleared when the page is refreshed or the tab is closed. Images and native tool selections are not saved as SideX drafts. Selected reply images are uploaded directly to X while editing.

---

### 2. Permissions and Their Use

SideX requests only the minimum permissions necessary for its functionality:

- **`storage`**:
  - **Purpose:** Saves UI and translation preferences using `chrome.storage.sync`, with local storage as a fallback. Drawer width is stored locally.
  - **Data Location:** Synced preferences may be synchronized by your browser account. Post text and translation results are not written to synced storage.

- **Host Permissions (`https://x.com/*`, `https://twitter.com/*`)**:
  - **Purpose:** Used strictly to inject the necessary scripts and styles into X (Twitter) web pages so that the side comment drawer can be rendered beside the timeline and tweet details can be displayed.
  - **Scope:** Content scripts only execute on `x.com` and `twitter.com`. Upload host permissions support reply attachments; `translate.googleapis.com` allows the extension worker to request Google translations.

---

### 3. Account Security & Session
SideX interacts with X directly within your active browser session:
- It reads the active X session's request headers and CSRF cookie to make authenticated X requests. These values are kept in page memory and are not sent to Google or a SideX server. SideX does not read your password.
- All actions (e.g., viewing comments, liking, or posting replies) are performed directly through your own browser session with X.

---

### 4. Third-Party Services
SideX does not contain any third-party advertising, trackers, analytics, or remote scripts.

- **X official translation (default):** Uses X's translation service within your current session.
- **Google translation (optional):** When selected and you click Translate, the post text and target language are sent directly to `translate.googleapis.com`. Translation results are cached temporarily in memory. X authentication headers and cookies are not included.
- **Existing translation extensions:** SideX leaves readable text in the page and hides its own translation controls. Other extensions operate under their own settings and privacy policies; SideX does not automatically invoke arbitrary extensions.
- **Media:** Displaying X images/videos and browsing the bundled GIF choices requests assets from their hosts, including X media hosts and GIPHY. Reply attachments selected by you are uploaded to X.

---

### 5. Open Source & Transparency
SideX is open source. You can inspect the entire source code on GitHub at any time to verify our privacy and security commitments.

---

### 6. Contact & Inquiries
If you have any questions or feedback regarding this Privacy Policy, please open an issue on the GitHub repository:
- **GitHub Issues:** [https://github.com/UncleK/SideX/issues](https://github.com/UncleK/SideX/issues)
