// learn.js — interactive widgets on the Learn step. Purely cosmetic; no
// build wiring. Safe to no-op if the elements aren't present (e.g. on
// build.html, which doesn't include the Learn markup).

(function () {
  'use strict';

  // ── CSS code-flicker demo ───────────────────────────────────────────
  // Tabs each carry a `data-rule` (a single CSS declaration string). Click
  // one and we (a) apply it to the live box and (b) reflect it in the shown
  // code snippet, so the user sees rule → effect side by side.
  const demo = document.getElementById('css-demo');
  if (demo) {
    const box   = document.getElementById('css-demo-box');
    const ruleEl = demo.querySelector('.css-demo-rule');
    const tabs  = Array.from(demo.querySelectorAll('.css-demo-tab'));

    function applyRule(rule) {
      // Reset the box to its base look, then apply the chosen declaration.
      box.style.cssText = '';
      box.style.cssText = rule;
      // Reflect in the code view. Show each declaration on its own line.
      ruleEl.textContent = rule.split(';')
        .map((d) => d.trim()).filter(Boolean)
        .map((d) => d + ';').join('\n  ');
    }

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        tabs.forEach((t) => t.classList.toggle('current', t === tab));
        applyRule(tab.dataset.rule || '');
      });
    });

    // Initialise from whichever tab is marked current (first by default).
    const initial = tabs.find((t) => t.classList.contains('current')) || tabs[0];
    if (initial) applyRule(initial.dataset.rule || '');
  }
})();
