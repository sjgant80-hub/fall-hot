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

---

# Hot-load-safe plugin discipline

A plugin gets hot-loaded by `fall-hot` only when it follows these rules. Break any of them and you'll get state loss, double-init bugs, or worse — silent behaviour drift across the estate.

## 1 · Version guard at the top

The FIRST thing every plugin does is check whether a same-or-newer version is already loaded. If yes, return immediately.

```js
(function fallSomething(){
  if (window.fallSomething && window.fallSomething._v >= 1) return;
  // ... rest of plugin
  window.fallSomething = { _v: 1, ... };
})();
```

Bump `_v` when you ship a meaningful change. If `_v` goes 1 → 2, the new code runs even though v1 was already loaded. If `_v` stays the same, the old code wins on reload — useful for cosmetic-only patches.

## 2 · Idempotent init

After the version guard, the rest of the plugin must be safe to run multiple times. Specifically:

- **Don't re-attach event listeners** without removing the old ones first (or use named handlers + check existence)
- **Don't create duplicate DOM nodes** — check `document.getElementById('your-id')` first
- **Don't start duplicate intervals/timers** — `clearInterval(window._yourTimer)` then start fresh
- **Don't lose state** stored on the global — `window.fallSomething._state` should survive the upgrade

Pattern:

```js
// Bad — duplicate listener on each reload
document.addEventListener('click', handler);

// Good — remove old, attach new
if (window.fallSomething && window.fallSomething._cleanup) window.fallSomething._cleanup();
const handler = e => {...};
document.addEventListener('click', handler);
window.fallSomething = {
  _v: 2,
  _cleanup: () => document.removeEventListener('click', handler),
  ...
};
```

## 3 · State migration when shape changes

If `_v 2` needs `_v 1`'s state in a new shape, migrate inside the new init:

```js
if (window.fallSomething && window.fallSomething._v === 1) {
  // we're upgrading 1 → 2 · keep their data
  const oldState = window.fallSomething._state;
  // ... migrate oldState into the new shape
}
```

## 4 · No init side effects beyond setup

Init should ONLY set up infrastructure (DOM, listeners, timers, globals). It should NOT:

- Fire network requests
- Show toasts/alerts
- Modify user data
- Trigger workflows

A hot-load that posts to your CRM every 5 minutes because someone fat-fingered an init bug is the kind of mistake that ends partnerships.

If the plugin needs to "do something on activation," gate it behind a user action or an explicit `start()` method.

## 5 · Backward-compat for at least one version

When you ship `_v 2`, code that depends on the `_v 1` API should keep working until `_v 3`. Deprecate gracefully, don't break.

## 6 · Console log on load · quietly

A single one-line `console.log` confirming the version loaded is good for debugging. More than that is noise:

```js
try { console.log('%c◊·κ fall-something', 'color:#d4a853;font-weight:bold', 'v2 · what changed in this version'); } catch(_){}
```

## 7 · Wrap risky code in try/catch

Hot-loading means new code might break in environments you didn't test. Guard the risky paths so a broken plugin doesn't take down the host tool:

```js
try {
  riskyDOMOperation();
} catch (e) {
  console.warn('fall-something inactive:', e);
  // tool keeps running on previous version state
}
```

## 8 · Don't hot-load yourself

Meta-plugins like `fall-hot` itself · `fall-registry` consumers · anything that decides what to watch · should NOT be in their own watch list. That creates an update-cycle and can lock you out if a bad version ships.

## 9 · The plugin's URL is forever

Once published at `https://sjgant80-hub.github.io/fall-thing/fall-thing.js`, that URL is a contract. Don't rename the file. Don't move the repo. Don't change the canonical path. Tools across the estate hardcode it. Bump `_v`, not the URL.

## 10 · Test hot-load locally before pushing

Before pushing v2 → CDN:

1. Open one of the tools that watches the plugin
2. In DevTools console, `window.fallHot.checkNow('plugin-name')` should still return false for "changed" since you haven't pushed yet
3. Push your change
4. Run `checkNow()` again → should now apply the new version
5. Verify the tool still works · check the previously-set state survived · check console for errors

If something breaks, `git revert` at the source and `checkNow()` again. Damage window is minutes.

## What this enables

Every plugin that follows these 10 rules can be improved in production without anyone running it having to reload. The estate becomes a living surface that grows sharper over time. The deploy tax goes to zero. The compounding starts.

---

## Licence

MIT. Part of the Fall sovereign tool estate. ◊·κ=1
