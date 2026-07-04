// Wizard navigation as reactive state. Three steps (About / Build /
// Play); About has 5 sub-pages, Build has 3. The URL hash addresses
// the exact page — `#step/subpage[/section]`, names not numbers, so
// deep links survive reordering and a refresh keeps your spot.
// Legacy one-word hashes (#about, #build, #play, #how) still land on
// the right step. Play is gated behind a finished build; a locked
// Play link redirects to Build, not the start.
import { build } from './builder.svelte.js';

export const STEPS = ['about', 'build', 'play'];
const ABOUT = 1, BUILD = 2, PLAY = 3;
export const ABOUT_SUBPAGES = 5;
const BUILD_PICK = 1, BUILD_CONFIG = 2;

// Named sub-pages (index = sub - 1).
const ABOUT_SUBS = ['intro', 'how', 'file', 'faqs', 'why'];
const BUILD_SUBS = ['pick', 'configure', 'result'];
// The How-it-works carousel: the map/overview page, then the file's
// sections in file order (mirrors anatomy/groups.js).
export const FILE_SECTIONS = ['map', 'util', 'cpu', 'keys', 'screen', 'decl', 'memr', 'disk', 'clock', 'memw'];
// Which About sub-page hosts the carousel (App.svelte keys arrows off it).
export const ABOUT_FILE_SUB = ABOUT_SUBS.indexOf('file') + 1;

const stepNames = {
  about: ABOUT, how: ABOUT, howitworks: ABOUT,
  build: BUILD, games: BUILD, play: PLAY,
};

let guard = false; // suppress the hashchange our own hash write triggers

class Nav {
  step = $state(ABOUT);
  sub = $state(1);       // About sub-page 1..ABOUT_SUBPAGES
  buildSub = $state(1);  // Build sub-page 1..3
  section = $state('map');   // current section on the About/file carousel
  sectionDir = $state(1);    // slide direction of the last section change
  // Next is held on the carousel's map page until the reader has moved
  // the carousel at least once (arrows, bar click, or a section deep
  // link) — proof they've found the navigation before skipping the tour.
  carouselSeen = $state(false);

  sectionIdx() { return FILE_SECTIONS.indexOf(this.section); }

  // Step the carousel (wraps at the ends).
  sectionStep(d) {
    const n = FILE_SECTIONS.length;
    this.sectionDir = d;
    this.section = FILE_SECTIONS[(this.sectionIdx() + d + n) % n];
    this.carouselSeen = true;
    scrollTop();
  }

  // Jump straight to a section (bar click).
  sectionJump(id) {
    if (id === this.section || !FILE_SECTIONS.includes(id)) return;
    this.sectionDir = FILE_SECTIONS.indexOf(id) > this.sectionIdx() ? 1 : -1;
    this.section = id;
    this.carouselSeen = true;
  }

  // Play unlocks once a cabinet exists.
  get canPlay() { return build.done; }

  get atStart() { return this.step === ABOUT && this.sub === 1; }
  get isLast() { return this.step === PLAY; }

  // Next is blocked on the Build step until the gate for the current
  // sub-page is met (pick → need a cart; configure → need a finished
  // build), and on the carousel's map page until the carousel has been
  // used once.
  get nextDisabled() {
    if (this.step === ABOUT) {
      return this.sub === ABOUT_FILE_SUB && this.section === 'map' && !this.carouselSeen;
    }
    if (this.step !== BUILD) return false;
    if (this.buildSub === BUILD_PICK) return !build.hasSource;
    if (this.buildSub === BUILD_CONFIG) return !build.done;
    return false; // result sub-page: Next crosses to Play
  }

  go(step) {
    if (step === PLAY && !this.canPlay) step = BUILD; // locked Play → Build
    this.step = Math.max(ABOUT, Math.min(PLAY, step));
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
    this.section = 'map';
    this.go(ABOUT);
  }

  // The canonical hash for the current state.
  hashFor() {
    if (this.step === ABOUT) {
      let h = `about/${ABOUT_SUBS[this.sub - 1]}`;
      if (this.sub === ABOUT_FILE_SUB) h += `/${this.section}`;
      return h;
    }
    if (this.step === BUILD) return `build/${BUILD_SUBS[this.buildSub - 1]}`;
    return 'play';
  }

  applyHash() {
    const raw = (location.hash || '').replace(/^#/, '').toLowerCase();
    if (!raw) return;
    // In-copy deep links (e.g. a FAQ pointing at #about/file/clock)
    // land like a page turn, not mid-scroll.
    scrollTop();
    const [s0, s1, s2] = raw.split('/');
    const target = stepNames[s0];
    if (!target) return;
    if (target === PLAY && !this.canPlay) {
      // Locked Play link/refresh → Build, not the start.
      this.step = BUILD;
      return;
    }
    this.step = target;
    if (target === ABOUT) {
      // Legacy '#how' / '#howitworks' → the "How is this possible?" page.
      const subName = s1 ?? (s0 === 'about' ? 'intro' : 'how');
      const i = ABOUT_SUBS.indexOf(subName);
      this.sub = i >= 0 ? i + 1 : 1;
      if (this.sub === ABOUT_FILE_SUB && FILE_SECTIONS.includes(s2)) {
        this.section = s2;
        if (s2 !== 'map') this.carouselSeen = true;
      }
    } else if (target === BUILD) {
      const i = BUILD_SUBS.indexOf(s1);
      let want = i >= 0 ? i + 1 : 1;
      // Deep links can't skip the build gates.
      if (want === 3 && !build.done) want = build.hasSource ? 2 : 1;
      if (want === 2 && !build.hasSource) want = 1;
      this.buildSub = want;
    }
  }
}

function scrollTop() {
  if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'instant' });
}

export const nav = new Nav();

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => { if (!guard) nav.applyHash(); });
  nav.applyHash();

  // Any navigation state change writes the canonical hash — including
  // canonicalising a legacy one-word hash on first load.
  $effect.root(() => {
    $effect(() => {
      const want = '#' + nav.hashFor();
      if (location.hash === want) return;
      guard = true;
      location.hash = want;
      requestAnimationFrame(() => { guard = false; });
    });
  });
}
