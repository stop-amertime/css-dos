// Wizard navigation as reactive state. Four steps (Home / Build /
// Play / About); Build has 3 sub-pages, About has 6. The URL hash
// addresses the exact page — `#step/subpage[/section]`, names not
// numbers, so deep links survive reordering and a refresh keeps your
// spot. Legacy one-word hashes (#about, #build, #play, #how) still
// land on the right step. Play is gated behind a finished build; a
// locked Play link redirects to Build, not the start.
import { build } from './builder.svelte.js';

export const STEPS = ['home', 'build', 'play', 'about'];
const HOME = 1, BUILD = 2, PLAY = 3, ABOUT = 4;
export const ABOUT_SUBPAGES = 6;
const BUILD_PICK = 1, BUILD_CONFIG = 2;

// Named sub-pages (index = sub - 1).
const ABOUT_SUBS = ['how', 'file', 'calcite', 'faqs', 'why', 'credits'];
const BUILD_SUBS = ['pick', 'configure', 'result'];
// The How-it-works carousel: the map/overview page, then the file's
// sections in file order (mirrors anatomy/groups.js).
export const FILE_SECTIONS = ['map', 'util', 'cpu', 'keys', 'screen', 'decl', 'memr', 'disk', 'clock', 'memw'];
// Which About sub-page hosts the carousel (App.svelte keys arrows off it).
export const ABOUT_FILE_SUB = ABOUT_SUBS.indexOf('file') + 1;

const stepNames = {
  home: HOME, intro: HOME,
  about: ABOUT, how: ABOUT, howitworks: ABOUT,
  build: BUILD, games: BUILD, play: PLAY,
};

let guard = false; // suppress the hashchange our own hash write triggers

class Nav {
  step = $state(HOME);
  sub = $state(1);       // About sub-page 1..ABOUT_SUBPAGES
  buildSub = $state(1);  // Build sub-page 1..3
  section = $state('map');   // current section on the About/file carousel
  sectionDir = $state(1);    // slide direction of the last section change
  // The carousel's first-visit hint (the "this bar is a map" bubble)
  // shows until the reader has moved the carousel once (arrows, bar
  // click, a section deep link) or dismissed the bubble itself.
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
    scrollTop();
  }

  // Play unlocks once a cabinet exists — built this session, or restored
  // from Cache Storage after a reload.
  get canPlay() { return build.done || build.restored; }

  // A #play deep link that arrived before the cabinet-restore probe
  // resolved; replayed by the 'cssdos-cabinet-restored' listener below.
  #wantedPlay = false;

  get atStart() { return this.step === HOME; }
  get isLast() { return this.step === ABOUT && this.sub === ABOUT_SUBPAGES; }

  // Next is blocked on the Build step until the gate for the current
  // sub-page is met (pick → need a cart; configure → need a finished
  // build).
  get nextDisabled() {
    if (this.step !== BUILD) return false;
    if (this.buildSub === BUILD_PICK) return !build.hasSource;
    if (this.buildSub === BUILD_CONFIG) return !build.done;
    return false; // result sub-page: Next crosses to Play
  }

  go(step) {
    this.#wantedPlay = false; // any navigation cancels a pending replay
    if (step === PLAY && !this.canPlay) step = BUILD; // locked Play → Build
    this.step = Math.max(HOME, Math.min(ABOUT, step));
    scrollTop();
  }

  // Called when the restore probe finds a cabinet: honour a #play link
  // that was redirected to Build only because the probe hadn't resolved.
  replayWantedPlay() {
    if (this.#wantedPlay && this.canPlay) this.go(PLAY);
  }

  // Called from the Play page when its cabinet probe comes up empty
  // (cache evicted, SW purge, …): fall back to the Build step's picker.
  bounceFromPlay() {
    this.buildSub = BUILD_PICK;
    this.go(BUILD);
  }

  // Free to jump backward; forward to Build/About always, Play only
  // when built.
  jump(step) {
    if (step === this.step) return;
    if (step < this.step || step !== PLAY || this.canPlay) this.go(step);
  }

  // Forward one logical page. Within Build/About, walk sub-pages first;
  // only cross to the next step from the last (unlocked) sub-page.
  next() {
    if (this.step === HOME) { this.go(BUILD); return; }
    if (this.step === BUILD) {
      if (this.nextDisabled) return;
      if (this.buildSub < BUILD_CONFIG) { this.buildSub += 1; scrollTop(); return; }
      this.go(PLAY); // configure (built) or result → Play
      return;
    }
    if (this.step === PLAY) { this.go(ABOUT); return; }
    // About step
    if (this.sub < ABOUT_SUBPAGES) { this.sub += 1; scrollTop(); }
  }

  // Backward one logical page, mirroring next(). Backing out of About
  // goes through go(PLAY), which itself falls back to Build when no
  // cabinet exists.
  prev() {
    if (this.step === ABOUT) {
      if (this.sub > 1) { this.sub -= 1; scrollTop(); return; }
      this.go(PLAY);
      return;
    }
    if (this.step === PLAY) { this.go(BUILD); return; }
    if (this.step === BUILD) {
      if (this.buildSub > BUILD_PICK) { this.buildSub -= 1; scrollTop(); return; }
      this.go(HOME);
    }
  }

  // The canonical hash for the current state.
  hashFor() {
    if (this.step === HOME) return 'home';
    if (this.step === BUILD) return `build/${BUILD_SUBS[this.buildSub - 1]}`;
    if (this.step === PLAY) return 'play';
    let h = `about/${ABOUT_SUBS[this.sub - 1]}`;
    if (this.sub === ABOUT_FILE_SUB) h += `/${this.section}`;
    return h;
  }

  applyHash() {
    const raw = (location.hash || '').replace(/^#/, '').toLowerCase();
    if (!raw) return;
    // In-copy deep links (e.g. a FAQ pointing at #about/file/clock)
    // land like a page turn, not mid-scroll.
    scrollTop();
    const [s0, s1, s2] = raw.split('/');
    // Legacy '#about/intro' → the intro now lives on Home.
    const target = s0 === 'about' && s1 === 'intro' ? HOME : stepNames[s0];
    if (!target) return;
    if (target === PLAY && !this.canPlay) {
      // Locked Play link/refresh → Build, not the start. If the restore
      // probe later finds a cabinet, it sends us back to Play.
      this.#wantedPlay = true;
      this.step = BUILD;
      return;
    }
    this.step = target;
    if (target === ABOUT) {
      // Legacy '#how' / '#howitworks' / bare '#about' → "How is this
      // possible?", the first About page.
      const subName = s1 ?? 'how';
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
  if (typeof window === 'undefined') return;
  window.scrollTo({ top: 0, behavior: 'instant' });
  // The page itself can't scroll — the wizard's middle band is the
  // real scroller, so a page turn has to reset it too.
  document.querySelector('.wiz-scroll')?.scrollTo({ top: 0, behavior: 'instant' });
}

export const nav = new Nav();

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => { if (!guard) nav.applyHash(); });
  window.addEventListener('cssdos-cabinet-restored', () => nav.replayWantedPlay());
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
