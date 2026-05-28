// ◊·κ FALL-HOT · v1.0 · 2026-05-28
// Hot-load plugin updates without redeploying. Loads changes without restarting.
//
// Pattern: poll-and-inject. Periodically fetch a watched URL with cache-bust,
// hash the response, compare to last loaded, and if different re-run the code
// in global scope. The plugin's own `if (window.X && window.X._v >= N) return`
// guard handles version-bumping cleanly · or the new code overrides the old.
//
// The HTML is the server · the server serves itself new code · the tool absorbs
// the update while running. Mansoor stays in his audit chain · Michel stays in
// his onboarding phase · CASSIE keeps walking. No refresh. No state loss.
//
// USAGE (CDN):
//   <script src="https://sjgant80-hub.github.io/fall-hot/fall-hot.js" defer></script>
//   <script>
//     // After it loads, register what to watch:
//     window.addEventListener('fall-hot:ready', () => {
//       window.fallHot.watch([
//         { name: 'fall-palette', url: 'https://sjgant80-hub.github.io/fall-palette/fall-palette.js' },
//         { name: 'fall-bloom',   url: 'https://sjgant80-hub.github.io/fall-bloom/bloom.js' }
//       ], { every: 5 * 60 * 1000 });
//     });
//   </script>
//
// API:
//   window.fallHot.watch(spec[], opts?)   register URLs to watch · spec = {name, url, every?}
//   window.fallHot.checkNow(name?)         force-check one or all
//   window.fallHot.stop()                  stop polling
//   window.fallHot.status()                return current state
//   window.fallHot.onUpdate(cb)            callback fired on every successful reload
//
// MIT licence · part of the Fall sovereign tool estate

(function fallHot(){
  if (window.fallHot && window.fallHot._v >= 1) return;

  var WATCHES = [];            // [{ name, url, every, lastHash, lastCheck, lastReload, attempts, errors }]
  var DEFAULT_EVERY = 5 * 60 * 1000;
  var MIN_EVERY = 60 * 1000;   // never poll faster than once a minute
  var POLL_TIMER = null;
  var STOPPED = false;
  var UPDATE_CALLBACKS = [];

  // Tiny synchronous hash · DJB2-ish · fast enough · good enough for change detection
  function hash(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
    return ((h >>> 0).toString(16) + s.length.toString(16)).padStart(10, '0').slice(-10);
  }

  // BroadcastChannel · so other tabs of the same tool also reload
  var CH = null;
  try { CH = new BroadcastChannel('fall-hot'); } catch(_) {}

  function notifyOthers(name, url, h) {
    try { CH && CH.postMessage({ type: 'hot-reload', name: name, url: url, hash: h, ts: Date.now() }); } catch(_) {}
  }
  if (CH) {
    CH.onmessage = function(ev) {
      var m = ev.data || {};
      if (m.type === 'hot-reload' && m.url) {
        // Another tab reloaded the same URL · fetch and apply locally too
        var w = WATCHES.find(function(x){ return x.url === m.url; });
        if (w && w.lastHash !== m.hash) {
          // Skip the diff phase since the other tab already verified
          fetchAndInject(w, /*force*/ true);
        }
      }
    };
  }

  // ── Fetch + diff + inject ────────────────────────────────
  async function fetchAndInject(w, force) {
    if (STOPPED) return;
    var url = w.url + (w.url.indexOf('?') === -1 ? '?' : '&') + '_h=' + Date.now();
    w.lastCheck = Date.now();
    w.attempts = (w.attempts || 0) + 1;
    try {
      var resp = await fetch(url, { cache: 'no-store' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      var code = await resp.text();
      var h = hash(code);
      if (!force && h === w.lastHash) {
        // Unchanged
        return false;
      }
      var wasFirstLoad = !w.lastHash;
      w.lastHash = h;
      w.lastReload = Date.now();
      // Inject · run in global scope · existing init guards (`_v >= N`) keep this idempotent
      try {
        // Use indirect eval so it runs in global scope, not local
        (1, eval)(code);
        if (!wasFirstLoad) {
          try { console.log('%c◊ fall-hot reloaded · ' + w.name, 'color:#4ecba0;font-weight:bold', '· hash ' + h); } catch(_){}
          notifyOthers(w.name, w.url, h);
          fireUpdateToast(w.name);
          UPDATE_CALLBACKS.forEach(function(cb){ try { cb(w); } catch(_){} });
        } else {
          try { console.log('%c◊ fall-hot first-loaded · ' + w.name, 'color:#d4a853;font-weight:bold', '· hash ' + h); } catch(_){}
        }
        return true;
      } catch(execErr) {
        console.warn('fall-hot inject failed for ' + w.name + ':', execErr);
        w.errors = (w.errors || 0) + 1;
        return false;
      }
    } catch(netErr) {
      // Silent retry on next tick · don't spam console for network blips
      w.errors = (w.errors || 0) + 1;
      return false;
    }
  }

  // ── Polling loop ─────────────────────────────────────────
  function tick() {
    if (STOPPED) return;
    var now = Date.now();
    WATCHES.forEach(function(w){
      var every = w.every || DEFAULT_EVERY;
      if (every < MIN_EVERY) every = MIN_EVERY;
      if (!w.lastCheck || (now - w.lastCheck) >= every) {
        fetchAndInject(w, false);
      }
    });
  }

  function start() {
    if (POLL_TIMER) return;
    // Quick warmup · check at 5s after start, then every 30s · individual every clauses gate actual fetch
    POLL_TIMER = setInterval(tick, 30 * 1000);
    setTimeout(tick, 5000);
  }
  function stop() {
    STOPPED = true;
    if (POLL_TIMER) { clearInterval(POLL_TIMER); POLL_TIMER = null; }
  }

  // ── Optional subtle toast on reload ──────────────────────
  function fireUpdateToast(name) {
    try {
      var t = document.createElement('div');
      t.style.cssText = 'position:fixed;bottom:14px;right:14px;background:rgba(20,22,30,0.95);border:1px solid #4ecba0;color:#4ecba0;padding:6px 12px;border-radius:6px;font-family:DM Mono,monospace;font-size:11px;z-index:99999;box-shadow:0 6px 20px rgba(0,0,0,0.4);transition:opacity 0.4s';
      t.textContent = '◊ hot-reloaded · ' + name;
      document.body.appendChild(t);
      setTimeout(function(){ t.style.opacity = '0'; setTimeout(function(){ try { t.remove(); } catch(_){} }, 500); }, 2200);
    } catch(_) {}
  }

  // ── Public API ───────────────────────────────────────────
  window.fallHot = {
    _v: 1,
    watch: function(spec, opts) {
      opts = opts || {};
      var arr = Array.isArray(spec) ? spec : [spec];
      arr.forEach(function(s){
        if (!s || !s.url) return;
        var existing = WATCHES.find(function(x){ return x.url === s.url; });
        if (existing) { Object.assign(existing, s); return; }
        WATCHES.push({
          name: s.name || s.url.split('/').pop(),
          url: s.url,
          every: s.every || opts.every || DEFAULT_EVERY,
          lastHash: null,
          lastCheck: 0,
          lastReload: 0,
          attempts: 0,
          errors: 0
        });
      });
      start();
      // Kick a check straight away on first registration
      setTimeout(tick, 100);
    },
    checkNow: function(name) {
      var targets = name ? WATCHES.filter(function(w){ return w.name === name; }) : WATCHES.slice();
      return Promise.all(targets.map(function(w){ return fetchAndInject(w, false); }));
    },
    stop: stop,
    start: function(){ STOPPED = false; start(); },
    status: function(){
      return WATCHES.map(function(w){
        return {
          name: w.name,
          url: w.url,
          every: w.every,
          lastHash: w.lastHash,
          lastCheck: w.lastCheck ? new Date(w.lastCheck).toLocaleTimeString() : null,
          lastReload: w.lastReload ? new Date(w.lastReload).toLocaleTimeString() : null,
          attempts: w.attempts || 0,
          errors: w.errors || 0
        };
      });
    },
    onUpdate: function(cb){ if (typeof cb === 'function') UPDATE_CALLBACKS.push(cb); }
  };

  try { console.log('%c◊·κ fall-hot', 'color:#d4a853;font-weight:bold', 'v1 · poll-and-inject · register via window.fallHot.watch([{name,url}])'); } catch(_){}

  // Fire ready event so host code knows it can call watch()
  try {
    window.dispatchEvent(new Event('fall-hot:ready'));
  } catch(_) {}
})();
