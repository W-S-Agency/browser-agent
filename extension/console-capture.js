// Browser Agent — Console Capture (MAIN world, document_start)
// Buffers page console output + uncaught errors into window.__BA_CONSOLE__
// so the `browser_read_console` tool can read it later. Patches console
// methods transparently (original behaviour preserved).

(function () {
  if (window.__BA_CONSOLE__) return; // idempotent (avoid double-patching)

  const MAX = 200; // ring buffer size
  const store = { entries: [] };
  window.__BA_CONSOLE__ = store;

  function push(level, args) {
    try {
      const text = Array.prototype.map
        .call(args, (a) => {
          if (typeof a === 'string') return a;
          try { return JSON.stringify(a); } catch (_) { return String(a); }
        })
        .join(' ');
      store.entries.push({ level, text: text.slice(0, 2000), ts: Date.now() });
      if (store.entries.length > MAX) store.entries.splice(0, store.entries.length - MAX);
    } catch (_) { /* never break the page */ }
  }

  ['log', 'info', 'warn', 'error', 'debug'].forEach((level) => {
    const original = console[level] ? console[level].bind(console) : null;
    console[level] = function () {
      push(level, arguments);
      if (original) original.apply(console, arguments);
    };
  });

  window.addEventListener('error', (e) => {
    push('error', [e.message + (e.filename ? ` (${e.filename}:${e.lineno})` : '')]);
  });
  window.addEventListener('unhandledrejection', (e) => {
    push('error', ['Unhandled promise rejection: ' + (e.reason && e.reason.message ? e.reason.message : e.reason)]);
  });
})();
