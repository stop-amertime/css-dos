// Wizard navigation as reactive state. Three steps (About / Build /
// Play); About has 5 sub-pages, Build has 3. The URL hash is the route
// so a refresh keeps the step. Play is gated behind a finished build.
import { build } from './builder.svelte.js';

export const STEPS = ['about', 'build', 'play'];
const ABOUT = 1, BUILD = 2, PLAY = 3;
export const ABOUT_SUBPAGES = 5;
const BUILD_PICK = 1, BUILD_CONFIG = 2, BUILD_RESULT = 3;

const hashToStep = {
  '#about': ABOUT, '#how': ABOUT, '#howitworks': ABOUT,
  '#build': BUILD, '#games': BUILD, '#play': PLAY,
};

let guard = false; // suppress the hashchange our own writeHash triggers

class Nav {
  step = $state(ABOUT);
  sub = $state(1);       // About sub-page 1..ABOUT_SUBPAGES
  buildSub = $state(1);  // Build sub-page 1..3

  // Play unlocks once a cabinet exists.
  get canPlay() { return build.done; }

  get atStart() { return this.step === ABOUT && this.sub === 1; }
  get isLast() { return this.step === PLAY; }

  // Next is blocked on the Build step until the gate for the current
  // sub-page is met: pick → need a cart; configure → need a finished build.
  get nextDisabled() {
    if (this.step !== BUILD) return false;
    if (this.buildSub === BUILD_PICK) return !build.hasSource;
    if (this.buildSub === BUILD_CONFIG) return !build.done;
    return false; // result sub-page: Next crosses to Play
  }

  go(step) {
    if (step === PLAY && !this.canPlay) return;
    this.step = Math.max(ABOUT, Math.min(PLAY, step));
    this.#writeHash();
    scrollTop();
  }

  // Free to jump backward; forward to Build always, Play only when built.
  jump(step) {
    if (step === this.step) return;
    if (step < this.step || step === BUILD || (step === PLAY && this.canPlay)) this.go(step);
  }

  // Forward one logical page. Within About/Build, walk sub-pages first;
  // only cross to the next step from the last (unlocked) sub-page.
  next() {
    if (this.step === PLAY) { this.restart(); return; }
    if (this.step === ABOUT) {
      if (this.sub < ABOUT_SUBPAGES) { this.sub += 1; scrollTop(); return; }
      this.go(BUILD);
      return;
    }
    // Build step
    if (this.nextDisabled) return;
    if (this.buildSub < BUILD_CONFIG) { this.buildSub += 1; scrollTop(); return; }
    if (this.buildSub === BUILD_CONFIG) { this.go(PLAY); return; } // built → Play
    this.go(PLAY);
  }

  // Backward one logical page, mirroring next().
  prev() {
    if (this.step === ABOUT) { if (this.sub > 1) { this.sub -= 1; scrollTop(); } return; }
    if (this.step === BUILD) {
      if (this.buildSub > BUILD_PICK) { this.buildSub -= 1; scrollTop(); return; }
      this.sub = ABOUT_SUBPAGES;
      this.go(ABOUT);
      return;
    }
    this.go(BUILD);
  }

  restart() {
    this.sub = 1;
    this.buildSub = 1;
    this.go(ABOUT);
  }

  #writeHash() {
    const want = '#' + STEPS[this.step - 1];
    if (location.hash.toLowerCase() === want) return;
    guard = true;
    location.hash = want;
    requestAnimationFrame(() => { guard = false; });
  }

  applyHash() {
    const target = hashToStep[(location.hash || '').toLowerCase()];
    if (target && !(target === PLAY && !this.canPlay)) this.step = target;
  }
}

function scrollTop() {
  if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'instant' });
}

export const nav = new Nav();

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => { if (!guard) nav.applyHash(); });
  nav.applyHash();
}
