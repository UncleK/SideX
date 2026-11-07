# X x-web compatibility — 2026-11-08

Release: **1.1.38**. Four actually loaded page scripts were matched byte-for-byte to the 1.1.37 package and core flows passed installed-code checks. 1.1.38 adds an emoji-label fix; Chinese labels subsequently passed an installed-page check. This is not full end-to-end acceptance; see the [QA matrix](QA_20261108.md) for coverage and the user's later network-warning recheck. Store submission is a separate maintainer step.

## Confirmed cause

The reported store version is 1.1.35. Main-post text/padding navigated to native detail before SideX appeared, with some reply bodies empty. Baseline commit `0212ddface28dbe80c1b9084fef338cdd756ba24` (2026-11-04) changed recipient reset and mention cards, not the timeline click entry. Its date does not establish store rollout timing.

Live Chrome found `abs.twimg.com/x-web/`, using Vite, Relay and TanStack Router. X's rollout start date/coverage remain unknown.

- New posts use `article.group/post` inside `[data-navigation-stop][data-href][role=link]`. Old tweet/tweetText test IDs and `time` entry points are absent; the old handler also exempts the outer link row.
- Reads now use `https://api.x.com/graphql/<id>/<name>`, without the old Webpack registry.
- Text/dates/ranges moved to `details`, counts to `counts`, flags to `perspective`. Media, quotes, entities and reply parents changed. Short text is HTML escaped; modern ranges use code points, legacy ranges use UTF-16.
- Native modal textareas/routes, component references, portals and photo pane structure changed.

Reported example: https://x.com/fxmqs/status/2119005016740741146. Reduced fixture: `tests/fixtures/x-web-tweet-detail-20261108.json`, excluding relationship fields, credentials and request headers.

## Candidate

Both DOM generations are supported. Main-post text/padding opens SideX; explicit links, quote text, media and actions retain native behavior. New field mapping restores bodies, Unicode/escaping, media, counts, flags and reply trees. New-native sidebar lookup, own-post Show more, textarea transfer and photo-pane positioning are recognized.

Observed operation IDs override the dated fallback map. Modern mutations use X's existing Relay network/native headers and fail without retry or raw-fetch mutation fallback if confirmation is missing. Standard/long-reply artifacts and six action aliases were checked against native source; action variables use `tweetId`.

Reply/Quote reuse X's router. Quick tools capture its history index so Escape returns once to the original entry. Modern profiles and More/Share/Grok reuse loaded native components through a portal/error boundary, without remote imports or source-row action callbacks. Target data uses retained TweetDetail/TweetResultByRestId artifacts; fresh home can preload the native artifact without navigating. Retentions are released and reads time out.

## Validation of the 1.1.36 reading candidate

- Baseline: 230 tests. Candidate: **263/263 passed**, no skips. Modern DOM, reduced real response, Unicode/media, aliases/no-retry failures, router/textarea tools, target preload and photo docking are covered.
- Browser checks used separate tabs, a dedicated message channel and isolated content world. They did **not** replace the installed store extension; that extension remained present. These checks do not establish clean installed-candidate behavior.
- Reported thread: three visible bodies and `3/3` restored.
- Actual main-post body click retained `/home`; FiniYang post `2118982866923299102` loaded `18/41` direct replies plus continuations. Quote-text clicks still navigated to the quoted post. Proof: ignored `scratch/verification/x-web-20261108/final-home-in-place.jpg`.
- Fresh home opened More for sidebar-only JosephBlue56 post `2119072291430748530`, with correct Follow/Mute/Block targets. Share Copy link was intercepted locally and contained that author/ID; the original clipboard implementation was restored. No account action was selected.
- Preparing JosephBlue56's native profile opened the correct native card; UserByScreenName also returned that handle.
- Native Reply targeted the correct post, GIF search opened, Escape returned to `/home`, and both dialogs closed.
- CreateTweet and preflight were intercepted **before transmission**. URL/body/header names were checked; local synthetic confirmation returned success. No header values were recorded. Interception was cleared; no test reply reached X.
- Photo pane/root DOM bounds matched approximately 350px after adding its positioning context. Clean photo visual acceptance remains pending; isolated bounds are not installed visual verification.
- Both test tabs were closed, removing test injection/mocks. Original user tabs and extension settings were unchanged.

## Required installed-candidate acceptance

Disable 1.1.35, load the unpacked candidate, then refresh X after copying drafts. Check main-post body/padding keeps `/home`, replies render, sidebar-only users' cards/menus target the correct user, and real images remain beside SideX with Official/collapse restoration working. Two enabled versions can compete over the DOM.

Real publication/long replies, account mutations, uploads, translation and Grok analysis were not exercised. Do not describe them as fully verified. Legacy tests pass; a real old-client browser was unavailable. Packaging, local acceptance and store submission are separate steps.

## Shipped-artifact provenance

58 observed assets were downloaded for inert inspection under ignored `scratch/x-web-20261108/assets/`; the manifest records URLs/bytes/SHA256. They are not bundled or executed by SideX.

REA derived evidence `ev_3c8da19b3342790a6ca630c1ffdb00b7fa4dcc4e5e76a1c4b49bf975610dfc7a` covers selected CwvHlM3K; `ev_2b81ac7717c343a37944d50be37abcdb0315a2046771bc6f435fa06505400707` covers selected CxunM8fq. Other modules were excluded from those runs, so this is not complete application analysis. Direct inspection also covered D4oiOUih, CpJ30hmk and yLQvOjOP.

- yLQvOjOP SHA256: `58649974770a40b8ea71d5f382a624060432c2f71c371daefb6e0f90cad1c72b`.
- D4oiOUih SHA256: `39de44f2cc6670e0acccca64a6bb38d148f19239a905eee45968d694c11bd591`.

The regression gap was legacy-only fixtures. Retain modern fixtures and require an installed-candidate home click with unchanged URL for future compatibility releases.

## Follow-up: profile paint and layout — 2026-11-08

The user's subsequent screenshot showed a native profile card painted transparently over reply text. On a newly opened X tab with the already-loaded SideX scripts, the promoted native card computed to `rgba(0, 0, 0, 0)`. Its native `bg-modal` surface was being overridden by a generic SideX rule intended for the old transparent wrapper. Limit transparent background, border removal and visible overflow to the legacy wrapper; retain x-web's own opaque card, border, rounded banner clip and theme colors. A temporary per-tab restoration of native computed paint produced a white, readable card; proof: ignored `scratch/verification/x-web-20261108/profile-paint-fixed.jpg`. This was a paint probe, not a reload of 1.1.37.

The same review found and fixed three additional gaps:

- New-native focal/pinned article markers had no matching CSS selectors.
- The delayed detail-page Show more retry still used the old test ID; it now uses the shared own-post lookup.
- Photo docking depended on a rendered native post. Once SideX hid the native timeline, X's virtualizer unmounted that post, causing the detector to undock and repeatedly alternate modes. Attribute breakpoints traced both writes to the **same** `syncPhotoViewer` script (lines 862/879 of the loaded 1.1.36 source), rather than establishing a duplicate-extension cause. The new detector uses the persistent labelled timeline section. A regression removes the hidden native post and asserts continued docking.

New paint/marker tests fail four of five cases with packaged 1.1.36 CSS; the delayed Show more and photo-unmount tests also fail with their corresponding old source. Final 1.1.37 suite: **270/270 passed**, no skips. Dark, dim, light and legacy-wrapper cases pass after the fix. Keep explicit source injection available in the test helper for baseline comparisons, so tests really execute the old content script when checking the regression.

For the photo probe, a temporary `role=region` marker was added to the existing labelled section, allowing the loaded old detector to select the same stable node the new source now selects via `aria-labelledby`. With zero native post nodes left in the hidden section, mode observations remained `sidex`, image natural width was 1280px, and the drawer stayed within the 350px right pane. Proof: ignored `scratch/verification/x-web-20261108/photo-stable-section-fixed.jpg`. This equivalent structural probe is not a clean 1.1.37 script reload. The marker, observer and debugger were cleaned up and the separate tab closed; the user's original tab was left unchanged.

Native More was checked on the loaded page: correct `@TrainCodeMan` target, opaque white surface, and bounds inside the viewport. No account action was selected. Clean 1.1.37 reload, true sends/uploads/translation/Grok and an old-client browser remain separate acceptance items.

## Subsequent installed-code acceptance and 1.1.38

The next pass matched all four live page scripts to 1.1.37 and directly verified opaque profile paint, focal markers, home clicks, menus, stable photo docking after zero native post nodes remained, and photo collapse/restore, with no temporary style/DOM correction. UI sends were intercepted before transmission: HTTP failure preserved draft/recipient; synthetic success cleared the submitted draft and reset to the main post. These client checks do not establish real publication or upload success.

This pass also found emoji category labels exposing nested dictionary keys. `t()` looked up only flat keys while categories were nested. 1.1.38 resolves nested keys; new Chinese/English UI tests fail on 1.1.37. The detailed [QA matrix](QA_20261108.md) distinguishes installed checks, simulations and untested services.
