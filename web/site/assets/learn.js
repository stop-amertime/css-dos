// learn.js — interactive widgets on the Learn step. Purely cosmetic; no
// build wiring. Safe to no-op if the elements aren't present (e.g. on
// build.html, which doesn't include the Learn markup).

(function () {
  'use strict';

  // ── Tabbed CSS demo ─────────────────────────────────────────────────
  // Each tab (data-demo) maps to one panel (data-demo-panel) showing a
  // code snippet + its own inline result. Click a tab → show its panel.
  const demo = document.getElementById('css-demo');
  if (demo) {
    const tabs   = Array.from(demo.querySelectorAll('.css-demo-tab'));
    const panels = Array.from(demo.querySelectorAll('.css-demo-panel'));

    function show(name) {
      tabs.forEach((t) => t.classList.toggle('current', t.dataset.demo === name));
      panels.forEach((p) => {
        const match = p.dataset.demoPanel === name;
        p.classList.toggle('current', match);
        p.hidden = !match;
      });
    }

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => show(tab.dataset.demo));
    });

    // Initialise from whichever tab is marked current (first by default).
    const initial = tabs.find((t) => t.classList.contains('current')) || tabs[0];
    if (initial) show(initial.dataset.demo);
  }
})();
