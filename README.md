# fall-hot

◊·κ Hot-load plugin updates without redeploying.

Loads changes without restarting. The HTML serves itself new code. Users keep working through updates — state preserved, mid-action sustained, the tool absorbs the patch like a living thing absorbing food.

**Live demo + docs:** https://sjgant80-hub.github.io/fall-hot/

## Install

```html
<script src="https://sjgant80-hub.github.io/fall-hot/fall-hot.js" defer></script>
```

## Register what to watch

```js
window.addEventListener('fall-hot:ready', () => {
  window.fallHot.watch([
    { name: 'fall-palette', url: 'https://sjgant80-hub.github.io/fall-palette/fall-palette.js' },
    { name: 'fall-bloom',   url: 'https://your-domain/bloom.js' }
  ], { every: 5 * 60 * 1000 });
});
```

That's it. Every 5 minutes the watched URLs are polled with cache-bust. If the response changed, the new code re-runs in global scope. The plugin's own `if (window.X && window.X._v >= N) return` init guard keeps the swap idempotent.

## What this unlocks

For a sovereign tool estate where multiple users run multiple tools:

| Before | After |
|---|---|
| Update palette → users hard-refresh | Update palette → already in their tab |
| User mid-action | Patch arrives quietly · they stay mid-action |
| Tab drift between users | BroadcastChannel sync · all tabs reload together |
| "please refresh and try again" | The refresh happens · the user didn't have to know |

## API

```js
window.fallHot.watch(spec[], opts?)    // register URLs · spec = {name, url, every?}
window.fallHot.checkNow(name?)          // force-check one or all
window.fallHot.stop()                   // pause polling
window.fallHot.start()                  // resume
window.fallHot.status()                 // state array per watched URL
window.fallHot.onUpdate(callback)       // fired on every successful reload
```

## How it works

1. Periodically fetches each watched URL with `?_h=<timestamp>` for cache-bust
2. Hashes the response (DJB2-style, fast)
3. Compares to last-loaded hash
4. If different, runs the code via `(1, eval)(code)` — indirect eval enters global scope
5. The plugin's own `_v` version guard makes re-init idempotent
6. BroadcastChannel `fall-hot` notifies other tabs of the same tool — they reload too
7. Subtle 2-second toast bottom-right confirms each reload

## Limits & edge cases

- **Minimum poll interval:** 60 seconds. Faster polls get clamped.
- **Network blips:** silent retry on next tick. Error count surfaced in `status()`.
- **Bad code in an update:** caught, logged. The running tool is unaffected. The previous version stays in memory.
- **State migration:** plugin authors should bump `_v` and migrate inside the init guard. Example:
  ```js
  if (window.bloom && window.bloom._v >= 2) return;
  if (window.bloom && window.bloom._v === 1) { /* migrate v1 state */ }
  ```

## Architecture rationale

The estate already had two paths:

**A · Script injection (this plugin)** — simple, no service worker required, works in any browser, deploys in a single `<script>` tag. The cost is a periodic HTTP HEAD-ish fetch per watched URL, which is negligible.

**B · Service Worker fetch intercept** — cleaner (the page never knows it asked), but requires HTTPS, requires SW registration, requires the SW file to live at the right origin scope, and harder to debug. Saving for v2 if pattern A's polling cost becomes meaningful.

Both paths land at the same destination: tools that update themselves.

## Use cases

- **CASSIE solver running for hours** — push a corrected mod-31 filter from the latest forward-analysis · the running walker absorbs it without losing its position
- **Mansoor mid-RFQ-review** — patch the audit chain verifier · he keeps reviewing
- **Michel mid-GymOps onboarding** — add a new agent to the swarm · it appears in his view
- **Apex Procurement in a partner meeting** — fix a UI label · it changes mid-demo
- **Estate-wide ripple** — update fall-palette at the source repo · every Fall* tool inherits within 5 minutes

## Sovereign

You host what you watch. The plugin polls your URLs. You control update cadence per URL. You can stop polling at any time. No third-party dependency, no telemetry, no analytics.

## Licence

MIT. Part of the Fall sovereign tool estate. ◊·κ=1
