// Wizard navigation as reactive state. Three steps (About / Build /
// Play); About has 7 sub-pages (Home hero, Why?, then the info
// pages), Build has 3. The URL path addresses the exact page -
// `/step/subpage[/section]`, names not numbers, so deep links survive
// reordering and a refresh keeps your spot. Legacy one-word hashes
// (#home, #about, #build, #play, #how - from before the switch to
// real paths) still land on the right step, translated to a path on
// first load. Play is gated behind a finished build; a locked Play
// link redirects to Build, not the start.
import { build } from './builder.svelte.js';

export const STEPS = ['about', 'build', 'play'];
export const ABOUT = 1, BUILD = 2, PLAY = 3;
const BUILD_PICK = 1, BUILD_CONFIG = 2;

// Named sub-pages (index = sub - 1). 'home' is the landing hero;
// 'why' fronts the info pages with its skip/continue buttons.
const ABOUT_SUBS = ['home', 'why', 'how', 'file', 'calcite', 'faqs', 'credits'];
export const ABOUT_SUBPAGES = ABOUT_SUBS.length;
const BUILD_SUBS = ['pick', 'configure', 'result'];
// The How-it-works carousel: the map/overview page, then the file's
// sections in file order (mirrors anatomy/groups.js).
export const FILE_SECTIONS = ['map', 'util', 'cpu', 'chipset', 'keys', 'screen', 'decl', 'memr', 'memw', 'disk', 'clock'];
// Which About sub-page hosts the carousel (next/prev walk its sections;
// App.svelte keys the Skip button off it).
export const ABOUT_FILE_SUB = ABOUT_SUBS.indexOf('file') + 1;
// Where "How it Works" entries land: the first info page after Why?.
export const ABOUT_HOW_SUB = ABOUT_SUBS.indexOf('how') + 1;

const HINT_KEY = 'cssdos-filemap-hint';

const stepNames = {
  home: ABOUT, intro: ABOUT,
  about: ABOUT, how: ABOUT, howitworks: ABOUT, why: ABOUT,
  build: BUILD, games: BUILD, play: PLAY,
};

let guard = false; // suppress the hashchange our own hash write triggers

class Nav {
  step = $state(ABOUT);
  sub = $state(1);       // About sub-page 1..ABOUT_SUBPAGES
  buildSub = $state(1);  // Build sub-page 1..3
  section = $state('map');   // current section on the About/file carousel
  sectionDir = $state(1);    // slide direction of the last section change
  // One-shot deep-link target for the FAQs page: '/about/faqs/<id>' sets
  // this, AboutFaqs.svelte opens+scrolls to the matching Foldable and
  // clears it. Not kept in sync on manual toggling (unlike `section`) -
  // it's a landing instruction, not persistent state.
  faqAnchor = $state(null);
  // The carousel's "this bar is a map" hint: shows on every page of
  // the File Map sub-page until dismissed, and the dismissal sticks
  // per browser (localStorage) so returning readers never see it again.
  hintDismissed = $state(
    typeof localStorage !== 'undefined' && localStorage.getItem(HINT_KEY) === '1'
  );

  dismissHint() {
    this.hintDismissed = true;
    try { localStorage.setItem(HINT_KEY, '1'); } catch { /* private mode */ }
  }

  sectionIdx() { return FILE_SECTIONS.indexOf(this.section); }

  // Step the carousel (callers keep d within range; clamp regardless).
  sectionStep(d) {
    const n = FILE_SECTIONS.length;
    this.sectionDir = d;
    this.section = FILE_SECTIONS[Math.max(0, Math.min(n - 1, this.sectionIdx() + d))];
    scrollTop();
  }

  // Jump straight to a section (bar click).
  sectionJump(id) {
    if (id === this.section || !FILE_SECTIONS.includes(id)) return;
    this.sectionDir = FILE_SECTIONS.indexOf(id) > this.sectionIdx() ? 1 : -1;
    this.section = id;
    scrollTop();
  }

  // The File Map sub-page's Skip button: hop past the rest of the
  // carousel to the next info page.
  skipFileMap() {
    this.sub = ABOUT_FILE_SUB + 1;
    scrollTop();
  }

  // Play unlocks once a cabinet exists - built this session, or restored
  // from Cache Storage after a reload.
  get canPlay() { return build.done || build.restored; }

  // A /play deep link that arrived before the cabinet-restore probe
  // resolved; replayed by the 'cssdos-cabinet-restored' listener below.
  #wantedPlay = false;

  // A cart id from a /build/pick?cart=<id> deep link, held until
  // build.serverCarts has loaded (selectCart() needs that list).
  // Replayed by loadServerCarts()'s caller - see replayWantedCart().
  #wantedCart = null;

  // One-shot: the next URL write should carry ?skipped=true, then
  // strip it immediately (history.replaceState) so only that single
  // landing pageview is tagged. Set by go(step, { skipped: true }).
  #tagSkipped = false;

  get atStart() { return this.step === ABOUT && this.sub === 1; }
  get isLast() { return this.step === PLAY; }

  // Next is blocked on the Build step until the gate for the current
  // sub-page is met (pick → need a cart; configure → need a finished
  // build).
  get nextDisabled() {
    if (this.step !== BUILD) return false;
    if (this.buildSub === BUILD_PICK) return !build.hasSource;
    if (this.buildSub === BUILD_CONFIG) return !build.done;
    return false; // result sub-page: Next crosses to Play
  }

  // Why Next is blocked, for the wiz-nav tooltip (null when it isn't).
  get nextTip() {
    if (!this.nextDisabled) return null;
    return this.buildSub === BUILD_PICK
      ? 'Please select a program first'
      : "Please 'Build' a file first";
  }

  go(step, opts) {
    this.#wantedPlay = false; // any navigation cancels a pending replay
    if (step === PLAY && !this.canPlay) step = BUILD; // locked Play → Build
    this.step = Math.max(ABOUT, Math.min(PLAY, step));
    if (opts?.skipped) this.#tagSkipped = true;
    scrollTop();
  }

  // The Why? page's "find out how it works" button and the Play step's
  // "How it Works" button: land on the first info page after Why?.
  goHowItWorks() {
    this.sub = ABOUT_HOW_SUB;
    this.go(ABOUT);
  }

  // Called when the restore probe finds a cabinet: honour a #play link
  // that was redirected to Build only because the probe hadn't resolved.
  replayWantedPlay() {
    if (this.#wantedPlay && this.canPlay) this.go(PLAY);
  }

  // Called once build.loadServerCarts() resolves: honour a
  // ?cart=<id> link that arrived before the cart list did. Silently
  // does nothing if the id doesn't match any known cart (selectCart's
  // own no-op). Mirrors CartGrid's click behaviour: picking a cart
  // advances past the Pick sub-page.
  async replayWantedCart() {
    const id = this.#wantedCart;
    this.#wantedCart = null;
    if (!id) return;
    await build.selectCart(id);
    if (build.source === 'cart' && this.buildSub === BUILD_PICK) this.next();
  }

  // One-shot read of #tagSkipped for the URL-write effect (private
  // fields aren't reachable from outside the class body otherwise).
  _consumeTagSkipped() {
    const was = this.#tagSkipped;
    this.#tagSkipped = false;
    return was;
  }

  // Called from the Play page when its cabinet probe comes up empty
  // (cache evicted, SW purge, …): fall back to the Build step's picker.
  bounceFromPlay() {
    this.buildSub = BUILD_PICK;
    this.go(BUILD);
  }

  // Free to jump backward; forward to Build always, Play only when
  // built.
  jump(step) {
    if (step === this.step) return;
    if (step < this.step || step !== PLAY || this.canPlay) this.go(step);
  }

  // Forward one logical page. Within About/Build, walk sub-pages first
  // (the File Map sub-page walks its 11 carousel sections one by one);
  // only cross to the next step from the last (unlocked) sub-page.
  next() {
    if (this.step === ABOUT) {
      if (this.sub === ABOUT_FILE_SUB && this.sectionIdx() < FILE_SECTIONS.length - 1) {
        this.sectionStep(1);
        return;
      }
      if (this.sub < ABOUT_SUBPAGES) {
        this.sub += 1;
        // Entering the carousel forwards starts it from its first page.
        if (this.sub === ABOUT_FILE_SUB) { this.section = FILE_SECTIONS[0]; this.sectionDir = 1; }
        scrollTop();
        return;
      }
      this.go(BUILD);
      return;
    }
    if (this.step === BUILD) {
      if (this.nextDisabled) return;
      if (this.buildSub < BUILD_CONFIG) { this.buildSub += 1; scrollTop(); return; }
      this.go(PLAY); // configure (built) or result → Play
    }
    // Play is the last step; its nav shows "How it Works" instead.
  }

  // Backward one logical page, mirroring next(). Backing out of Build
  // returns to whichever About page the reader left from.
  prev() {
    if (this.step === PLAY) { this.go(BUILD); return; }
    if (this.step === BUILD) {
      if (this.buildSub > BUILD_PICK) { this.buildSub -= 1; scrollTop(); return; }
      this.go(ABOUT);
      return;
    }
    // About step
    if (this.sub === ABOUT_FILE_SUB && this.sectionIdx() > 0) {
      this.sectionStep(-1);
      return;
    }
    if (this.sub > 1) {
      this.sub -= 1;
      // Entering the carousel backwards lands on its last page, so the
      // sub-pages + sections read as one continuous strip.
      if (this.sub === ABOUT_FILE_SUB) {
        this.section = FILE_SECTIONS[FILE_SECTIONS.length - 1];
        this.sectionDir = -1;
      }
      scrollTop();
    }
  }

  // The canonical path + query string for the current state.
  pathFor() {
    let p;
    if (this.step === BUILD) {
      p = `/build/${BUILD_SUBS[this.buildSub - 1]}`;
      // selectCart() advances straight past Pick to Configure, so a
      // chosen cart stays on the URL across the whole Build step, not
      // just while buildSub === BUILD_PICK.
      if (build.source === 'cart' && build.cart?.name) {
        p += `?cart=${encodeURIComponent(build.cart.name)}`;
      }
    } else if (this.step === PLAY) {
      p = '/play';
    } else if (this.sub === 1) {
      p = '/'; // the About/home hero IS the homepage
    } else {
      p = `/about/${ABOUT_SUBS[this.sub - 1]}`;
      if (this.sub === ABOUT_FILE_SUB) p += `/${this.section}`;
    }
    if (this.#tagSkipped) p += (p.includes('?') ? '&' : '?') + 'skipped=true';
    return p;
  }

  applyPath() {
    const raw = location.pathname.replace(/^\/+/, '').toLowerCase();
    if (!raw) return; // root '/' → About/home, the default state
    // In-copy deep links (e.g. a FAQ pointing at /about/file/clock)
    // land like a page turn, not mid-scroll.
    scrollTop();
    const [s0, s1, s2] = raw.split('/');
    const target = stepNames[s0];
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
      // 'home' / legacy 'about/intro' → the hero; one-word legacy
      // 'how' / 'howitworks' / 'why' → that page; bare 'about' →
      // "How is this possible?" (the old first About page).
      const subName =
        s0 === 'home' || s0 === 'intro' || s1 === 'intro' ? 'home'
        : s0 === 'about' ? (s1 ?? 'how')
        : s0; // 'how' | 'howitworks' | 'why'
      const i = ABOUT_SUBS.indexOf(subName === 'howitworks' ? 'how' : subName);
      this.sub = i >= 0 ? i + 1 : 1;
      if (this.sub === ABOUT_FILE_SUB && FILE_SECTIONS.includes(s2)) {
        this.section = s2;
      }
      if (subName === 'faqs' && s2) {
        this.faqAnchor = s2;
      }
    } else if (target === BUILD) {
      const i = BUILD_SUBS.indexOf(s1);
      let want = i >= 0 ? i + 1 : 1;
      // Deep links can't skip the build gates.
      if (want === 3 && !build.done) want = build.hasSource ? 2 : 1;
      if (want === 2 && !build.hasSource) want = 1;
      this.buildSub = want;
      // ?cart=<id> on any Build sub-page - stash for replayWantedCart()
      // once build.serverCarts has loaded (selectCart() needs that
      // list). Deep-linking straight to Configure/Result with a cart
      // still lands on Pick above (no source yet); replayWantedCart()
      // advances past it once the cart's loaded.
      const cartId = new URLSearchParams(location.search).get('cart');
      if (cartId) this.#wantedCart = cartId;
    }
  }
}

function scrollTop() {
  if (typeof window === 'undefined') return;
  window.scrollTo({ top: 0, behavior: 'instant' });
  // The page itself can't scroll - the wizard's middle band is the
  // real scroller, so a page turn has to reset it too.
  document.querySelector('.wiz-scroll')?.scrollTo({ top: 0, behavior: 'instant' });
}

export const nav = new Nav();

// A legacy bookmark/shared link arrives as '#about/why' etc. - translate
// it to the equivalent path once, then drop the hash. Bare '#' (no path
// segments) means "just the old homepage hash", same as visiting '/'.
function migrateLegacyHash() {
  const raw = (location.hash || '').replace(/^#/, '');
  if (!raw) return;
  history.replaceState(null, '', '/' + raw + location.search);
  location.hash = '';
}

if (typeof window !== 'undefined') {
  migrateLegacyHash();
  window.addEventListener('popstate', () => { if (!guard) nav.applyPath(); });
  window.addEventListener('cssdos-cabinet-restored', () => nav.replayWantedPlay());
  // Intercept same-origin, unmodified left-clicks on plain <a href="/...">
  // links (in-copy deep links like '/about/calcite') so they go through
  // pushState instead of a full page reload.
  window.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest?.('a');
    if (!a || a.target || a.hasAttribute('download')) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return;
    e.preventDefault();
    guard = true;
    history.pushState(null, '', url.pathname + url.search);
    guard = false;
    nav.applyPath();
  });
  nav.applyPath();

  // Any navigation state change writes the canonical path - including
  // canonicalising a legacy hash on first load.
  $effect.root(() => {
    $effect(() => {
      const want = nav.pathFor();
      const have = location.pathname + location.search;
      if (have === want) return;
      guard = true;
      history.pushState(null, '', want);
      guard = false;
      // The ?skipped=true tag is a one-shot label for this single landing
      // pageview - strip it right after so it doesn't linger through
      // subsequent navigation (replaceState adds no history entry).
      if (nav._consumeTagSkipped()) {
        history.replaceState(null, '', nav.pathFor());
      }
    });
  });
}
