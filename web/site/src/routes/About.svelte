<script>
  // About — the landing hero (Home) plus the info pages: Why? (with
  // its skip-ahead/read-on buttons), how it's possible (the one-tool
  // idea + the mechanisms), the How-it-works carousel (the file
  // dissected, with a map/overview landing page), Calcite, the FAQs,
  // and the credits. Copy register per ABOUT-SCRIPT.md.
  import { fly } from 'svelte/transition';
  import '../styles/_fragments/about.css';
  import '../styles/_fragments/anatomy.css';
  import { nav, BUILD, FILE_SECTIONS } from '../lib/router.svelte.js';
  import StepDots from '../components/StepDots.svelte';
  import Term from '../components/Term.svelte';
  import Wizard from '../components/Wizard.svelte';
  import Foldable from '../components/Foldable.svelte';
  import Callout from '../components/Callout.svelte';
  import CodeCss from '../components/CodeCss.svelte';
  import CssDemo from '../components/CssDemo.svelte';
  import MoonViz from '../components/MoonViz.svelte';
  import CabinetBar from '../components/anatomy/CabinetBar.svelte';
  import { GROUPS } from '../components/anatomy/groups.js';
  import SectionMap from '../components/anatomy/SectionMap.svelte';
  import SectionUtil from '../components/anatomy/SectionUtil.svelte';
  import SectionCpu from '../components/anatomy/SectionCpu.svelte';
  import SectionChipset from '../components/anatomy/SectionChipset.svelte';
  import SectionKeys from '../components/anatomy/SectionKeys.svelte';
  import SectionScreen from '../components/anatomy/SectionScreen.svelte';
  import SectionMemDecl from '../components/anatomy/SectionMemDecl.svelte';
  import SectionMemWrite from '../components/anatomy/SectionMemWrite.svelte';
  import SectionMemRead from '../components/anatomy/SectionMemRead.svelte';
  import SectionDisk from '../components/anatomy/SectionDisk.svelte';
  import SectionClock from '../components/anatomy/SectionClock.svelte';

  let { strip, wizNav } = $props();

  // The cabinet carousel: the current section lives on the router
  // (nav.section) so it's addressable — #about/file/clock deep-links.
  const SECTIONS = {
    map: SectionMap, util: SectionUtil, cpu: SectionCpu,
    chipset: SectionChipset, keys: SectionKeys,
    screen: SectionScreen, decl: SectionMemDecl, memw: SectionMemWrite,
    memr: SectionMemRead, disk: SectionDisk, clock: SectionClock,
  };
  // The map page isn't a file section (no bytes, no bar segment) —
  // it gets its own pane header and leaves the whole bar lit.
  const MAP_GROUP = { id: 'map', label: 'The whole file', size: '309 MB', c: '#555555' };
  const curGroup = $derived(GROUPS.find((x) => x.id === nav.section) ?? MAP_GROUP);
  const CurSection = $derived(SECTIONS[nav.section]);
  // First-visit hint: shown on every page of the carousel until the
  // reader dismisses it (dismissal persists — router.svelte.js).
  const hintLive = $derived(!nav.hintDismissed);

  // "How is this possible?" page exhibits — Problem 1's full AND
  // machinery (verbatim from kiln/css-lib.mjs, kiln/patterns/flags.mjs),
  // Problem 2's simplified AX table (pre-interrupt; SectionCpu.svelte
  // has the fuller version with the IRQ branch).
  const X_ASSIGN = `x = 2
…
x = 4`;

  const AX_TABLE_SIMPLE = `--AX: if(
    style(--opcode: 0): …;    /* ADD, one flavour */
    style(--opcode: 1): …;    /* ADD, another */
    …                         /* every opcode that can touch AX */
    else: var(--AX-prev));   /* untouched: keep the old value */`;

  const X_SELF_REF = `x = x + 1`;

  const AND_FULL_EXHIBIT = `/* CSS-DOS: the AND operation, plus auxiliary @functions.
   Extracted verbatim from the Kiln emitters (kiln/css-lib.mjs, kiln/patterns/flags.mjs).
   Dependency tree:
     --andFlags16/--andFlags8  (full FLAGS word after AND/TEST)
       -> --and      (16-bit bitwise AND, self-contained)
       -> --parity   (PF, 256-entry even-parity table over the low byte)
            -> --lowerBytes
       -> --bit      (single-bit extract, for SF)
            -> --rightShift
     --and8 = --and truncated to 8 bits via --lowerBytes */

/* ===== core helpers ===== */
@function --lowerBytes(--a <integer>, --b <integer>) returns <integer> {
  result: mod(var(--a), pow(2, var(--b)));
}

@function --rightShift(--a <integer>, --b <integer>) returns <integer> {
  result: round(down, var(--a) / pow(2, var(--b)));
}

@function --bit(--val <integer>, --idx <integer>) returns <integer> {
  result: mod(--rightShift(var(--val), var(--idx)), 2);
}

/* ===== the AND itself ===== */
@function --and(--a <integer>, --b <integer>) returns <integer> {
  --a1: mod(var(--a), 2);
  --a2: mod(round(down, var(--a) / 2), 2);
  --a3: mod(round(down, var(--a) / 4), 2);
  --a4: mod(round(down, var(--a) / 8), 2);
  --a5: mod(round(down, var(--a) / 16), 2);
  --a6: mod(round(down, var(--a) / 32), 2);
  --a7: mod(round(down, var(--a) / 64), 2);
  --a8: mod(round(down, var(--a) / 128), 2);
  --a9: mod(round(down, var(--a) / 256), 2);
  --a10: mod(round(down, var(--a) / 512), 2);
  --a11: mod(round(down, var(--a) / 1024), 2);
  --a12: mod(round(down, var(--a) / 2048), 2);
  --a13: mod(round(down, var(--a) / 4096), 2);
  --a14: mod(round(down, var(--a) / 8192), 2);
  --a15: mod(round(down, var(--a) / 16384), 2);
  --a16: mod(round(down, var(--a) / 32768), 2);
  --b1: mod(var(--b), 2);
  --b2: mod(round(down, var(--b) / 2), 2);
  --b3: mod(round(down, var(--b) / 4), 2);
  --b4: mod(round(down, var(--b) / 8), 2);
  --b5: mod(round(down, var(--b) / 16), 2);
  --b6: mod(round(down, var(--b) / 32), 2);
  --b7: mod(round(down, var(--b) / 64), 2);
  --b8: mod(round(down, var(--b) / 128), 2);
  --b9: mod(round(down, var(--b) / 256), 2);
  --b10: mod(round(down, var(--b) / 512), 2);
  --b11: mod(round(down, var(--b) / 1024), 2);
  --b12: mod(round(down, var(--b) / 2048), 2);
  --b13: mod(round(down, var(--b) / 4096), 2);
  --b14: mod(round(down, var(--b) / 8192), 2);
  --b15: mod(round(down, var(--b) / 16384), 2);
  --b16: mod(round(down, var(--b) / 32768), 2);
  result: calc(
    var(--a1) * var(--b1) +
    calc(var(--a2) * var(--b2)) * 2 +
    calc(var(--a3) * var(--b3)) * 4 +
    calc(var(--a4) * var(--b4)) * 8 +
    calc(var(--a5) * var(--b5)) * 16 +
    calc(var(--a6) * var(--b6)) * 32 +
    calc(var(--a7) * var(--b7)) * 64 +
    calc(var(--a8) * var(--b8)) * 128 +
    calc(var(--a9) * var(--b9)) * 256 +
    calc(var(--a10) * var(--b10)) * 512 +
    calc(var(--a11) * var(--b11)) * 1024 +
    calc(var(--a12) * var(--b12)) * 2048 +
    calc(var(--a13) * var(--b13)) * 4096 +
    calc(var(--a14) * var(--b14)) * 8192 +
    calc(var(--a15) * var(--b15)) * 16384 +
    calc(var(--a16) * var(--b16)) * 32768
  );
}

@function --and8(--a <integer>, --b <integer>) returns <integer> {
  --full: --and(var(--a), var(--b));
  result: --lowerBytes(var(--full), 8);
}

/* ===== flag computation ===== */
@function --parity(--val <integer>) returns <integer> {
  --low8: --lowerBytes(var(--val), 8);
  result: if(
    style(--low8: 0): 4;
    style(--low8: 1): 0;
    style(--low8: 2): 0;
    style(--low8: 3): 4;
    style(--low8: 4): 0;
    style(--low8: 5): 4;
    style(--low8: 6): 4;
    style(--low8: 7): 0;
    style(--low8: 8): 0;
    style(--low8: 9): 4;
    style(--low8: 10): 4;
    style(--low8: 11): 0;
    style(--low8: 12): 4;
    style(--low8: 13): 0;
    style(--low8: 14): 0;
    style(--low8: 15): 4;
    style(--low8: 16): 0;
    style(--low8: 17): 4;
    style(--low8: 18): 4;
    style(--low8: 19): 0;
    style(--low8: 20): 4;
    style(--low8: 21): 0;
    style(--low8: 22): 0;
    style(--low8: 23): 4;
    style(--low8: 24): 4;
    style(--low8: 25): 0;
    style(--low8: 26): 0;
    style(--low8: 27): 4;
    style(--low8: 28): 0;
    style(--low8: 29): 4;
    style(--low8: 30): 4;
    style(--low8: 31): 0;
    style(--low8: 32): 0;
    style(--low8: 33): 4;
    style(--low8: 34): 4;
    style(--low8: 35): 0;
    style(--low8: 36): 4;
    style(--low8: 37): 0;
    style(--low8: 38): 0;
    style(--low8: 39): 4;
    style(--low8: 40): 4;
    style(--low8: 41): 0;
    style(--low8: 42): 0;
    style(--low8: 43): 4;
    style(--low8: 44): 0;
    style(--low8: 45): 4;
    style(--low8: 46): 4;
    style(--low8: 47): 0;
    style(--low8: 48): 4;
    style(--low8: 49): 0;
    style(--low8: 50): 0;
    style(--low8: 51): 4;
    style(--low8: 52): 0;
    style(--low8: 53): 4;
    style(--low8: 54): 4;
    style(--low8: 55): 0;
    style(--low8: 56): 0;
    style(--low8: 57): 4;
    style(--low8: 58): 4;
    style(--low8: 59): 0;
    style(--low8: 60): 4;
    style(--low8: 61): 0;
    style(--low8: 62): 0;
    style(--low8: 63): 4;
    style(--low8: 64): 0;
    style(--low8: 65): 4;
    style(--low8: 66): 4;
    style(--low8: 67): 0;
    style(--low8: 68): 4;
    style(--low8: 69): 0;
    style(--low8: 70): 0;
    style(--low8: 71): 4;
    style(--low8: 72): 4;
    style(--low8: 73): 0;
    style(--low8: 74): 0;
    style(--low8: 75): 4;
    style(--low8: 76): 0;
    style(--low8: 77): 4;
    style(--low8: 78): 4;
    style(--low8: 79): 0;
    style(--low8: 80): 4;
    style(--low8: 81): 0;
    style(--low8: 82): 0;
    style(--low8: 83): 4;
    style(--low8: 84): 0;
    style(--low8: 85): 4;
    style(--low8: 86): 4;
    style(--low8: 87): 0;
    style(--low8: 88): 0;
    style(--low8: 89): 4;
    style(--low8: 90): 4;
    style(--low8: 91): 0;
    style(--low8: 92): 4;
    style(--low8: 93): 0;
    style(--low8: 94): 0;
    style(--low8: 95): 4;
    style(--low8: 96): 4;
    style(--low8: 97): 0;
    style(--low8: 98): 0;
    style(--low8: 99): 4;
    style(--low8: 100): 0;
    style(--low8: 101): 4;
    style(--low8: 102): 4;
    style(--low8: 103): 0;
    style(--low8: 104): 0;
    style(--low8: 105): 4;
    style(--low8: 106): 4;
    style(--low8: 107): 0;
    style(--low8: 108): 4;
    style(--low8: 109): 0;
    style(--low8: 110): 0;
    style(--low8: 111): 4;
    style(--low8: 112): 0;
    style(--low8: 113): 4;
    style(--low8: 114): 4;
    style(--low8: 115): 0;
    style(--low8: 116): 4;
    style(--low8: 117): 0;
    style(--low8: 118): 0;
    style(--low8: 119): 4;
    style(--low8: 120): 4;
    style(--low8: 121): 0;
    style(--low8: 122): 0;
    style(--low8: 123): 4;
    style(--low8: 124): 0;
    style(--low8: 125): 4;
    style(--low8: 126): 4;
    style(--low8: 127): 0;
    style(--low8: 128): 0;
    style(--low8: 129): 4;
    style(--low8: 130): 4;
    style(--low8: 131): 0;
    style(--low8: 132): 4;
    style(--low8: 133): 0;
    style(--low8: 134): 0;
    style(--low8: 135): 4;
    style(--low8: 136): 4;
    style(--low8: 137): 0;
    style(--low8: 138): 0;
    style(--low8: 139): 4;
    style(--low8: 140): 0;
    style(--low8: 141): 4;
    style(--low8: 142): 4;
    style(--low8: 143): 0;
    style(--low8: 144): 4;
    style(--low8: 145): 0;
    style(--low8: 146): 0;
    style(--low8: 147): 4;
    style(--low8: 148): 0;
    style(--low8: 149): 4;
    style(--low8: 150): 4;
    style(--low8: 151): 0;
    style(--low8: 152): 0;
    style(--low8: 153): 4;
    style(--low8: 154): 4;
    style(--low8: 155): 0;
    style(--low8: 156): 4;
    style(--low8: 157): 0;
    style(--low8: 158): 0;
    style(--low8: 159): 4;
    style(--low8: 160): 4;
    style(--low8: 161): 0;
    style(--low8: 162): 0;
    style(--low8: 163): 4;
    style(--low8: 164): 0;
    style(--low8: 165): 4;
    style(--low8: 166): 4;
    style(--low8: 167): 0;
    style(--low8: 168): 0;
    style(--low8: 169): 4;
    style(--low8: 170): 4;
    style(--low8: 171): 0;
    style(--low8: 172): 4;
    style(--low8: 173): 0;
    style(--low8: 174): 0;
    style(--low8: 175): 4;
    style(--low8: 176): 0;
    style(--low8: 177): 4;
    style(--low8: 178): 4;
    style(--low8: 179): 0;
    style(--low8: 180): 4;
    style(--low8: 181): 0;
    style(--low8: 182): 0;
    style(--low8: 183): 4;
    style(--low8: 184): 4;
    style(--low8: 185): 0;
    style(--low8: 186): 0;
    style(--low8: 187): 4;
    style(--low8: 188): 0;
    style(--low8: 189): 4;
    style(--low8: 190): 4;
    style(--low8: 191): 0;
    style(--low8: 192): 4;
    style(--low8: 193): 0;
    style(--low8: 194): 0;
    style(--low8: 195): 4;
    style(--low8: 196): 0;
    style(--low8: 197): 4;
    style(--low8: 198): 4;
    style(--low8: 199): 0;
    style(--low8: 200): 0;
    style(--low8: 201): 4;
    style(--low8: 202): 4;
    style(--low8: 203): 0;
    style(--low8: 204): 4;
    style(--low8: 205): 0;
    style(--low8: 206): 0;
    style(--low8: 207): 4;
    style(--low8: 208): 0;
    style(--low8: 209): 4;
    style(--low8: 210): 4;
    style(--low8: 211): 0;
    style(--low8: 212): 4;
    style(--low8: 213): 0;
    style(--low8: 214): 0;
    style(--low8: 215): 4;
    style(--low8: 216): 4;
    style(--low8: 217): 0;
    style(--low8: 218): 0;
    style(--low8: 219): 4;
    style(--low8: 220): 0;
    style(--low8: 221): 4;
    style(--low8: 222): 4;
    style(--low8: 223): 0;
    style(--low8: 224): 0;
    style(--low8: 225): 4;
    style(--low8: 226): 4;
    style(--low8: 227): 0;
    style(--low8: 228): 4;
    style(--low8: 229): 0;
    style(--low8: 230): 0;
    style(--low8: 231): 4;
    style(--low8: 232): 4;
    style(--low8: 233): 0;
    style(--low8: 234): 0;
    style(--low8: 235): 4;
    style(--low8: 236): 0;
    style(--low8: 237): 4;
    style(--low8: 238): 4;
    style(--low8: 239): 0;
    style(--low8: 240): 4;
    style(--low8: 241): 0;
    style(--low8: 242): 0;
    style(--low8: 243): 4;
    style(--low8: 244): 0;
    style(--low8: 245): 4;
    style(--low8: 246): 4;
    style(--low8: 247): 0;
    style(--low8: 248): 0;
    style(--low8: 249): 4;
    style(--low8: 250): 4;
    style(--low8: 251): 0;
    style(--low8: 252): 4;
    style(--low8: 253): 0;
    style(--low8: 254): 0;
    style(--low8: 255): 4;
  else: 0);
}

@function --andFlags16(--a <integer>, --b <integer>) returns <integer> {
  --res: --and(var(--a), var(--b));
  --pf: --parity(var(--res));
  --zf: if(style(--res: 0): 64; else: 0);
  --sf: calc(--bit(var(--res), 15) * 128);
  result: calc(var(--pf) + var(--zf) + var(--sf) + 2);
}

@function --andFlags8(--a <integer>, --b <integer>) returns <integer> {
  --full: --and(var(--a), var(--b));
  --res: --lowerBytes(var(--full), 8);
  --pf: --parity(var(--res));
  --zf: if(style(--res: 0): 64; else: 0);
  --sf: calc(--bit(var(--res), 7) * 128);
  result: calc(var(--pf) + var(--zf) + var(--sf) + 2);
}`;

  const SUBPAGES = [
    { label: 'Home' },
    { label: 'Why?' },
    { label: 'How?' },
    { label: 'File Map' },
    { label: 'Calcite' },
    { label: 'FAQs' },
    { label: 'Credits' },
  ];
</script>

{#snippet subhead()}
  <StepDots variant="sub" items={SUBPAGES} current={nav.sub} onjump={(n) => (nav.sub = n)} />
{/snippet}

<Wizard {strip} {subhead} nav={wizNav}>
  <section class="step learn-step" data-step="1">

  {#if nav.sub === 1}
    <!-- Home — the landing hero (the site's front page) -->
    <div class="subpage subpage-intro" data-subpage="1">
      <div class="intro-hero">
        <div class="intro-logo">
          <img src="/assets/css-dos-logo-narrow.png" alt="CSS-DOS">
        </div>
        <div class="intro-text">
          <h1>An entire &rsquo;80s PC in a stylesheet.</h1>
          <p class="lede">
            An IBM PC compatible &mdash;
            <Term t="i8086">8086</Term> processor, 640&nbsp;KB
            RAM, floppy drive, keyboard, VGA screen, and various
            less-memorable support chips &mdash; in one <code>.css</code> file.
          </p>
          <p class="lede">
            That file is a morbidly obese <b>300+&nbsp;MB</b> of
            spec-compliant <Term t="css">CSS</Term>, albeit abused beyond
            recognition &mdash; perhaps some of the most circuitous and
            painfully inefficient code ever written in earnest.
          </p>
          <p class="lede">
            It boots <b>MS-DOS</b> (Microsoft&rsquo;s operating system
            before Windows) and runs unmodified &rsquo;80s software.
          </p>
          <p class="lede">Yes, it runs <b>Doom</b><span class="flair-star">*</span></p>
          <div class="flair-burst">
            <div class="flair-text">
              <span><span class="fl-1">The</span><span
                class="fl-2">first time</span><span
                class="fl-3">real programs</span><span
                class="fl-4">have run</span><span
                class="fl-5">in CSS!</span></span>
            </div>
          </div>
          <p class="intro-fn small">
            <span class="fn-star">*</span> barely.
          </p>
          <div class="intro-links">
            <a href="https://github.com/stop-amertime/css-dos"
               target="_blank" rel="noopener">
              <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>Source</a>
            <a href="https://ahmedamer.co.uk"
               target="_blank" rel="noopener">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><circle cx="8" cy="8" r="6.6"/><ellipse cx="8" cy="8" rx="3" ry="6.6"/><path d="M1.6 8h12.8M2.5 4.6h11M2.5 11.4h11"/></svg>My site</a>
            <a href="https://ahmedamer.co.uk/#contact"
               target="_blank" rel="noopener">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><rect x="1.4" y="3.2" width="13.2" height="9.6"/><path d="M1.8 3.8 8 8.8l6.2-5"/></svg>Contact me</a>
          </div>
        </div>
      </div>
    </div>
  {:else if nav.sub === 2}
    <!-- Why? -->
    <div class="subpage" data-subpage="2">
      <h1>Why?</h1>
      <blockquote class="epigraph">
        <p>&ldquo;Because it&rsquo;s there&rdquo;</p>
        <cite>&mdash; George Mallory, when asked why he climbed Everest.</cite>
      </blockquote>
      <!-- TODO(owner): link the Dark Souls bongos run -->
      <p>
        Cave paintings started when some spare blood was misused to
        represent a deer. Fifty thousand years later, someone beat
        <i>Dark Souls</i> using the bongo drums controller from Gamecube
        rhythm game <i>Donkey Konga</i>.
      </p>
      <p>
        <b>I&rsquo;m under no illusion: this project was excruciating to
        create and serves no practical benefit whatsoever.</b>
        &ldquo;Dugg, why are you wasting perfectly good blood on the cave
        walls, you mad idiot? We&rsquo;ll have none left for all the
        rituals that need doing!&rdquo; Dugg didn&rsquo;t have an answer
        for &lsquo;why?&rsquo;. The rituals have been lost to time, but
        the deer is now encased in glass. I don&rsquo;t think
        anyone&rsquo;s even bothered asking the <i>Dark Souls</i> bongo
        drums guy why he did it. I also don&rsquo;t have a good answer to
        the question, only one as vague and meaningless as
        Mallory&rsquo;s: because it <i>wasn&rsquo;t</i> there.
      </p>
      <div class="why-cta">
        <button class="btn why-cta-btn" onclick={() => nav.go(BUILD)}>
          TRY IT OUT IMMEDIATELY
          <span class="why-cta-sub">(for the impatient)</span>
        </button>
        <button class="btn primary why-cta-btn" onclick={() => nav.goHowItWorks()}>
          FIND OUT HOW IT WORKS
          <span class="why-cta-sub">(recommended)</span>
        </button>
      </div>
    </div>
  {:else if nav.sub === 3}
    <!-- How is this possible? -->
    <div class="subpage" data-subpage="3">
      <h1>How is this possible?</h1>
      <p>
        <Term t="css">CSS</Term> is designed to style elements on
        websites (e.g. making a box a specific size and colour) and was
        never designed to compute anything.
      </p>
      <p>
        Basic tools have trickled into CSS as websites have become more
        complex, arriving one at a time over thirty years:
      </p>
      <CssDemo />
      <p style="margin-top:16px">
        Those last two, <code>@function</code> and <code>if()</code>,
        arrived within months of each other in 2025 and made this
        entire project possible. And yet, it is still a pitifully small
        set of tools for such a large job.
      </p>
      <p>
        We smack every problem with those tools until it&rsquo;s fixed.
        Some problems would be solved in one hit with a very slightly
        better tool for the job. Instead, they are brute forced with
        millions of hits from a tool we do have. Each whack is a line
        of code &mdash; 5.9&nbsp;million lines later, the file ends up
        an appalling 300+&nbsp;MB of text:
      </p>
      <MoonViz />
      <Callout kind="info">
        <p>
          How the entire .css file works is covered in detail via a
          full <a href="#about/file">file map</a> a couple of pages
          from here &mdash; this page attempts to just provide an
          accessible intuition on the basics.
        </p>
      </Callout>
      <p>
        So, let&rsquo;s say we want to run DOOM in CSS. What is
        stopping us? After all, CSS is a programming language, and DOOM
        is a program, right? Well, let&rsquo;s take it one problem at a
        time:
      </p>

      <div class="problem-box dos-shadow">
        <span class="problem-tag">Problem 1</span>
        <h3>CSS can&rsquo;t do lists of instructions</h3>
      </div>
      <p>
        CSS declares properties once and forever &mdash; size, font,
        colour &mdash; with no step-by-step workflows. A huge pain in
        the arse for programs, which are lists of instructions by
        definition. CSS is conceptually more like a spreadsheet (bear
        with me) &mdash; each cell/property can have a formula which
        works out its value, and they can even reference each other,
        but you can&rsquo;t write a <i>program</i> because there is no
        order to any of it &mdash; it just exists, recalculating in
        response to input, but not having a direction of travel of its
        own.
      </p>
      <p>
        <b>The solution is the philosophical cornerstone of this
        project: instead of running programs, reconstruct an entire
        computer &mdash; CPU, RAM, PIT, PIC, etc.</b> and then run the
        programs on <i>that</i> simulated computer.
      </p>
      <p>
        This sounds a bizarre detour, but: a CPU is a fixed circuit
        whose outputs are always a function of its inputs. Always in
        force, like a spreadsheet, or like CSS. Programs are a terrible
        fit for CSS, but circuits are a surprisingly natural one. The
        dream is: if we can just emulate all the components of a PC
        1:1, code should just&hellip; run on it.
      </p>
      <Callout kind="info">
        <p>
          Recreating an entire computer is <i>technically possible</i>
          since CSS is Turing complete. This is like saying
          &lsquo;anywhere is walking distance, if you have the
          time&rsquo;.
        </p>
      </Callout>
      <p>
        And so, we embark on a rollercoaster journey: mimicking the
        processor hardware and all its foibles 1:1, reinventing logical
        operations like AND, OR and NOT in CSS, re-creating the RAM,
        the clock, the PIT (timer) and PIC (interrupt controller),
        hacking in a screen, and so on and so forth. We might genuinely
        hit <i>another</i> problem we can&rsquo;t solve along the way
        &mdash; the only way to really tell in advance is to try to do
        it.
      </p>
      <Callout kind="tip" label="Fun fact">
        <p>
          The earliest experiments in CSS computation had no way to
          make time pass &mdash; the user had to repeatedly press keys
          or hold the mouse down to advance the machine one cycle at a
          time, until a trick was found: using CSS animations and
          <code>@keyframes</code> to drive a
          <a href="#about/file/clock">clock</a> instead.
        </p>
      </Callout>

      <h4 class="anatomy-head">Just a taste: the AND function</h4>
      <p>
        Let&rsquo;s sink our teeth into one of the simplest helper
        functions &mdash; AND &mdash; in CSS. AND combines two numbers
        bit by bit: the result has a 1 only where <i>both</i> numbers
        have a 1. Every other language on earth does it with one
        built-in operator: <code>a &amp; b</code>. CSS has no bitwise
        operators at all &mdash; so we rebuild Boolean logic out of
        arithmetic. On single bits, AND is just multiplication
        (1&times;1 is 1, everything else is 0), OR is
        <code>min(1, a+b)</code>, and NOT is <code>1&minus;a</code>.
        The same job transistors do with voltage, done with
        <code>calc()</code> &mdash; the &lsquo;reinventing logic
        gates&rsquo; promised above, made literal.
      </p>
      <p>
        That trick only works one bit at a time, though. So to AND two
        16-bit numbers, the function must first shred both into their
        sixteen separate bits &mdash; sixteen divide-and-round-down
        extractions each &mdash; multiply the pairs, then reassemble
        the answers into a number. Thirty-odd lines of long division to
        do what <code>&amp;</code> does anywhere else. This is all real
        spec-compliant CSS from the cabinet.
      </p>
      <p>
        Bear in mind: <b>this isn&rsquo;t a CPU instruction &mdash;
        it&rsquo;s just one helper @function.</b> The actual AND X,Y
        <i>instruction</i> is implemented across many CPU registers,
        which each individually compute what happens to them if and
        when the current CPU instruction is &lsquo;AND X,Y&rsquo;. But
        let&rsquo;s not worry about that yet &mdash; it&rsquo;s tackled
        in the next &lsquo;problem&rsquo; section.
      </p>

      <Foldable>
        {#snippet summary()}The full AND machinery &mdash; get ready to scroll&hellip;{/snippet}
        <CodeCss code={AND_FULL_EXHIBIT} />
      </Foldable>
      <Foldable>
        {#snippet summary()}Explanation of how AND works{/snippet}
        <p>
          The little helpers at the top (<code>--lowerBytes</code>,
          <code>--rightShift</code>, <code>--bit</code>) are helpers
          &mdash; chop-to-N-bits, shift, extract-one-bit &mdash; each
          built from division and remainder. Then <code>--and</code>
          itself: thirty-two bit extractions, sixteen multiplications,
          one weighted sum. Below it, <code>--parity</code>: the 8086
          reports whether a result has an even number of 1-bits, and
          nothing in CSS can count bits, so all 256 possible answers
          were worked out in advance and written into a 256-arm
          <code>if()</code>. Last, <code>--andFlags16</code> &mdash;
          the bookkeeping a real chip does as a free side effect of its
          silicon (did the result hit zero? go negative?), reconstructed
          as arithmetic.
        </p>
      </Foldable>

      <ul class="sim-list">
        <li><b>Clock:</b> an animation ticks a counter, and every
          formula in the file re-evaluates each tick
          (<a href="#about/file/clock">the clock</a>)</li>
        <li><b>CPU Registers:</b> each a set of formulas including
          every possible processor instruction that could change them,
          and how to calculate their resultant value. Those
          instructions are cobbled together with a combination of
          <code>if()</code> statements, calc, mod (remainder) and round
          (<a href="#about/file/cpu">the CPU</a>)</li>
        <li><b>RAM:</b> a titanic list of hundreds of thousands of
          variables, declared one by one, each with a formula asking,
          every single tick: &lsquo;did this instruction just write to
          <i>my</i> address?&rsquo;. Reading them back is its own
          nightmare &mdash; CSS gives no way to get from an address (a
          number) to a variable (a name), so reads go through one
          colossal lookup function with one arm per address:
          &lsquo;is it address 0? is it address 1?&hellip;&rsquo;,
          743,948 arms long (<a href="#about/file/decl">memory
          declarations</a>, <a href="#about/file/memr">reads</a>)</li>
      </ul>

      <div class="ext-link-box">
        <p>
          Lyra Rebane first built an
          <a href="https://lyra.horse/x86css/" class="ext-link"
             target="_blank" rel="noopener">x86 CPU in CSS</a> with a
          limited instruction set &mdash; this extends that work to a
          full machine running an unmodified OS and real programs.
        </p>
      </div>

      <div class="problem-box dos-shadow">
        <span class="problem-tag">Problem 2</span>
        <h3>CSS cannot change a property while running</h3>
      </div>
      <p>
        In any other programming language, we can set a variable and
        then change it later:
      </p>
      <CodeCss code={X_ASSIGN} />
      <p>
        In CSS, <b>you only get one chance to set a property.</b> A
        huge pain in the arse for programs, which rely heavily
        on&hellip; changing the values of things.
      </p>
      <p>
        Instead, each CSS property &mdash; from the RAM to the CPU
        registers &mdash; has to be written in such a way that its
        value is true <i>all the time.</i>
      </p>
      <p>
        We end up with gigantic <code>if()</code> statements which
        cover every possible state that a variable could be in:
      </p>
      <ul class="sim-list">
        <li>CPU registers cover every possible CPU instruction that
          could change them, and the resultant value of doing so</li>
        <li>Bytes of RAM each ask, every cycle, whether this
          tick&rsquo;s instruction wrote to their address &mdash; and
          when it didn&rsquo;t, their formula simply answers with last
          tick&rsquo;s value, unchanged.</li>
      </ul>
      <p>
        Here is the register AX &mdash; structurally exact from the
        cabinet, arithmetic elided:
      </p>
      <CodeCss code={AX_TABLE_SIMPLE} />
      <p>
        One table, keyed on the current instruction, with a row for
        everything that could ever happen to AX &mdash; and that final
        <code>else</code> is this whole problem in one line of CSS: a
        variable&rsquo;s single, permanent definition has to end with
        <i>&ldquo;otherwise, I am what I was.&rdquo;</i> Fourteen of
        these tables, one per <Term t="register">register</Term>, are
        the machine&rsquo;s entire brain
        (<a href="#about/file/cpu">the CPU section</a>).
      </p>
      <p>
        Memory gets the same treatment at scale. Each tick, the current
        instruction broadcasts &ldquo;I am writing value V to address
        N&rdquo; into three small shared variables (the <b>write
        slots</b>), and all 368,256 memory-cell formulas compare the
        slots against their own address. When an instruction writes
        nothing &mdash; most don&rsquo;t &mdash; a 0-or-1
        &lsquo;live&rsquo; flag on each slot lets every formula
        short-circuit at once
        (<a href="#about/file/memw">the write-formulas section</a>).
      </p>

      <div class="problem-box dos-shadow">
        <span class="problem-tag">Problem 3</span>
        <h3>CSS variables can&rsquo;t reference themselves</h3>
      </div>
      <p>
        In any programming language, you increment a variable using:
      </p>
      <CodeCss code={X_SELF_REF} />
      <p>
        In CSS, that&rsquo;s off the table: a variable whose definition
        mentions itself is a <i>circular reference</i>, and CSS rejects
        it outright.
      </p>
      <p>
        This one is simple to solve &mdash; just keep a <i>complete
        second set</i> of all variables that <i>could</i> change,
        holding their <i>previous</i> values &mdash; each
        <code>--X</code> gets an <code>--X-prev</code> &mdash; and copy
        from those. So, each variable actually needs two copies &mdash;
        what it is <i>now</i> and what it was <i>before.</i> Since at
        most 3 of the machine&rsquo;s 368,256 memory cells change in
        any given cycle, over 99.999% of this copying is redundant.
      </p>
      <p>
        Except that&rsquo;s actually still not quite enough. Every
        formula must read the frozen <i>before</i>-picture while the
        <i>after</i>-picture is being computed &mdash; if new values
        landed the moment they were ready, half the machine would
        calculate from the old state and half from the new, and the
        state would be scrambled beyond repair.
      </p>
      <p>
        That one is simple to solve too: create <i>another complete
        copy</i> of all variables as a buffer between the two. New
        values are parked there, then handed over all at once, at a
        fixed point of each clock lap, when nothing is reading. (In the
        real file every memory cell ends up as <b>four</b> variables.
        If you know electronics or graphics, yes: we have just
        reinvented the flip-flop &mdash; the CSS-as-circuits analogy
        holding up worryingly well &mdash; or, if you prefer,
        double-buffering.) The full mechanism, animated, is on the
        <a href="#about/file/clock">clock page</a> of the file-map
        tour.
      </p>

      <div class="problem-box dos-shadow">
        <span class="problem-tag">Problems 4&ndash;7</span>
        <h3>No inputs and outputs</h3>
      </div>
      <p>
        A computer you can&rsquo;t feed programs into, see, or touch
        isn&rsquo;t much of a computer. CSS can&rsquo;t read files,
        can&rsquo;t take input from your keyboard, and can&rsquo;t draw
        to the screen &mdash; so we cobble every one of these together:
      </p>
      <ul class="sim-list">
        <li><b>The floppy disk:</b> CSS can&rsquo;t open anything at
          runtime &mdash; no files, no requests, no loading &mdash; so
          the entire floppy is baked into the stylesheet in advance,
          byte by byte, one <code>if()</code> arm per byte. (Byte zero
          of the disk is 235 &mdash; the x86 jump instruction every
          boot sector begins with.) DOS asks the drive for one 512-byte
          sector at a time, so the machine keeps a 512-byte
          <i>window</i> in memory whose contents aren&rsquo;t stored
          anywhere: those addresses read straight through to the disk
          table, at &lsquo;requested sector &times; 512 +
          offset&rsquo;. DOS writes a sector number into memory and the
          window instantly shows a different slice of the disk &mdash;
          it never learns the floppy is a fiction. (Making disks
          <i>writable</i> &mdash; saving your work into a stylesheet
          &mdash; is its own adventure, covered in the
          <a href="#about/file/disk">disk section</a>.)</li>
        <li><b>The screen:</b> 64,000 <code>&lt;div&gt;</code>s are
          assembled in a 320&times;200 grid, each with a rule that
          colours it from its own byte of video RAM (skipping over the
          complexity of various video modes &mdash; Text, CGA,
          Mode&nbsp;13h&hellip;). This is, note, the only place in
          300&nbsp;MB where CSS is doing its actual day job &mdash;
          reading a value and colouring a box. Everything else is
          smuggling; the screen is the sliver of honest work at the
          end. What a pity we&rsquo;re still abusing it with
          sixty-four thousand elements
          (<a href="#about/file/screen">the screen section</a>).</li>
        <li><b>A keyboard:</b> CSS cannot see your keyboard &mdash; no
          selector reacts to a real keypress. The <i>one</i> thing it
          can perceive about a human is whether an element is being
          pressed at this exact moment: the <code>:active</code>
          selector. So the machine&rsquo;s keyboard is a set of real
          on-screen buttons, each carrying a rule &mdash; &lsquo;while I
          am held, the keyboard variable holds my key&rsquo;s
          code&rsquo; &mdash; wired into the two bytes of memory where
          the BIOS expects keyboard hardware. It is the single aperture
          through which the physical world enters the computation
          (<a href="#about/file/keys">the keyboard section</a>).</li>
        <li><b>Sound</b> just has no way to work, really. Except
          possibly displaying the sound wave visually&hellip;? Perhaps
          that&rsquo;s future work.</li>
      </ul>

      <div class="problem-box dos-shadow">
        <span class="problem-tag">Problem 8</span>
        <h3>There&rsquo;s too much code to realistically write down</h3>
      </div>
      <p>
        The final code is cooked up using templates via a generator
        script called <b>Kiln</b> &mdash; it mechanically fills in
        every register table, memory formula, every one of the 743,948
        read arms and so on. Could I write that in CSS too? Not
        directly; as I say, you can&rsquo;t really write programs in
        CSS. It&rsquo;d be much easier to write a JavaScript
        interpreter for DOS, stick MS-DOS and that program on a floppy
        disk, then transpile all of that to CSS.
      </p>

      <div class="problem-box dos-shadow">
        <span class="problem-tag">Problem 9</span>
        <h3>This runs absurdly slowly, if it runs at all</h3>
      </div>
      <Foldable>
        {#snippet summary()}Why it&rsquo;s so slow{/snippet}
        <ul class="sim-list">
          <li>All 368,256 RAM cells re-check &lsquo;was I just written
            to?&rsquo; every single tick &mdash; even though, at most,
            3 of them were. In a normal computer the cost of a step is
            proportional to what <i>changed</i>; in this machine it is
            proportional to what <i>exists</i>.</li>
          <li>CPU instructions that normally run <i>in hardware</i>
            &mdash; silicon executing billions of them per second
            &mdash; are here re-derived as long chains of arithmetic
            (remember the AND function above), which the browser has to
            grind through symbolically, every tick.</li>
          <li>(A thought for the technical: the .css file is, in a
            sense, an unrolled computer)</li>
        </ul>
      </Foldable>
      <p>
        A browser really will evaluate all of this &mdash; at about two
        instructions per second. Not 2&nbsp;fps. Two <b>instructions</b>
        &mdash; add, multiply, etc. To put it in perspective how slow
        that is:
      </p>
      <div class="stat-grid">
        <div class="stat-box">
          <span class="stat-num">~3 weeks</span>
          <span class="stat-label">to boot DOS</span>
        </div>
        <div class="stat-box">
          <span class="stat-num">~3 months</span>
          <span class="stat-label">DOOM level load</span>
        </div>
        <div class="stat-box">
          <span class="stat-num">0.00001&nbsp;fps</span>
          <span class="stat-label">DOOM framerate</span>
        </div>
      </div>
      <p>
        This is all assuming your browser doesn&rsquo;t crash from
        trying to load a 300+&nbsp;MB .css file, which it absolutely
        will (at time of writing).
      </p>
      <p>
        The solution is to do what every other programming language
        does (including JavaScript in Chrome etc.), and compile the
        code into something faster before it runs.
      </p>
      <p>
        This site runs the same file through <b>Calcite</b>, a compiler
        that evaluates the same CSS over 100,000&times; faster;
        <a href="#about/calcite">its own page</a> explains how it
        works, and why it isn&rsquo;t cheating.
      </p>
    </div>
  {:else if nav.sub === 4}
    <!-- How it works — the bar as map, the sections as a carousel -->
    <div class="subpage" data-subpage="4">
      <CabinetBar selected={nav.section === 'map' ? null : nav.section}
                  hint={hintLive}
                  onselect={(g) => nav.sectionJump(g)}
                  ondismiss={() => nav.dismissHint()} />

      <div class="anatomy-pane" style="--pane-c:{curGroup.c}">
        <div class="pane-head">
          <h2 class="pane-title">
            {curGroup.label} <span class="sz">{curGroup.size}</span>
          </h2>
          <span class="pane-count">{nav.sectionIdx() + 1} / {FILE_SECTIONS.length}</span>
        </div>
        {#key nav.section}
          <div class="sec-body" in:fly={{ x: 44 * nav.sectionDir, duration: 180 }}>
            <CurSection />
          </div>
        {/key}
      </div>
    </div>
  {:else if nav.sub === 5}
    <!-- Calcite — how the file actually runs (moved from the Play page) -->
    <div class="subpage" data-subpage="5">
      <h1>Calcite</h1>
      <p>
        Chrome has no issue loading a <Term t="css">CSS</Term> file up
        to 536&nbsp;MB (V8&rsquo;s string limit), but trying to
        <i>evaluate</i> 300&nbsp;MB of spaghetti-CSS results in an
        immediate freeze. Even if equipped to handle such a task, it
        would take three weeks to boot DOS, three months for Doom to
        load in, and would run that at 0.00001&nbsp;fps. So we have a
        working computer in a stylesheet, but no way to run it.
      </p>
      <p>
        Every programming language has this problem: source code is
        written for humans, and running it directly just <i>is</i>
        slow. And every language solves it the same way:
        <b>compile the source into something faster before running
        it.</b> Chrome compiles JavaScript to machine code before
        running it (the V8 engine, written in C++), as does every other
        browser. Python quietly compiles <code>.py</code> to bytecode
        before running it. Almost nothing runs from raw source these
        days except shell scripts and declarative languages like CSS.
      </p>
      <p>
        Nobody previously wrote a compiler for CSS, because nobody had
        ever been foolish enough to need one. Thus, CSS-DOS grew a
        second project: a compiler of its own, which took about as long
        to build as the CSS-generating half of the project.
      </p>
      <p>
        <b>Calcite</b> is a <Term t="jit">JIT compiler</Term> for
        computational CSS &mdash; written in Rust, shipped as
        <Term t="wasm">WebAssembly</Term>, running in the background
        and operating on a player page which is itself entirely
        HTML/CSS (mimicking the model of an in-browser engine like V8).
        On load, it reads the whole stylesheet once and recognises the
        repetitive shapes that an emulated computer forces CSS into
        &mdash; the 368,256 near-identical write formulas, the
        colossal lookup functions, the register tables. It compiles
        those shapes into native routines, over 200,000&times; faster
        than the above baseline speed.
      </p>
      <p class="dim small">
        (In a perfect world I&rsquo;d insert Calcite into Chrome&rsquo;s
        own style engine and the site would need nothing else. You
        can&rsquo;t patch Chrome from a website, so Calcite lives as
        WebAssembly instead, in a service worker which calculates the
        video output and streams it to the tab. I considered creating a
        fast-CSS browser, but nobody wants to download a whole browser
        just to play around with one website these days.)
      </p>

      <h3 class="anatomy-head">Is this cheating?</h3>
      <p>
        A fair question &mdash; if a separate program is doing the
        heavy lifting, is the CSS just decoration? I&rsquo;ve taken
        this seriously, because the entire point of the project is that
        the machine is written in real, spec-compliant CSS. To ensure
        this, Calcite is bound by five self-imposed rules, which are on
        the stricter side where possible. The first is the
        project&rsquo;s cardinal rule:
      </p>
      <ol class="cheat-list">
        <li>
          <b>Calcite must produce EXACTLY what a spec-compliant browser
          would &mdash; byte for byte.</b> This is the &lsquo;cardinal
          rule&rsquo;, front and centre in the documentation. Feed the
          same cabinet to Chrome&rsquo;s own style engine and you&rsquo;d
          get the exact same behaviour, just unbearably slowly. I have
          not allowed ONE BYTE of divergence in my conformance testing
          &mdash; no fast approximations, no cut corners or hacking. If
          Calcite disagrees with a spec-compliant browser, that&rsquo;s
          a bug in Calcite. The CSS IS the source code, and Calcite is
          its servant &mdash; perfect, or nothing.
        </li>
        <li>
          <b>Calcite must parse a .css file on-the-spot and blind
          &mdash; no AOT compilation, no pre-baking.</b> It compiles
          whatever arrives at load time, in the browser, the same way
          V8 takes whatever JavaScript arrives: everything inferred
          from the file itself, immediately. And an even stricter rule:
          it must be the same file. Not one byte added, changed, or
          removed to make Calcite&rsquo;s life easier &mdash; it can
          only interpret and recreate.
        </li>
        <li>
          <b>The player page must contain ZERO JavaScript &mdash; only
          HTML/CSS.</b> Calcite lives in a separately-loaded service
          worker, mimicking an in-browser engine like V8, and the
          screen is fed back to the tab through an HTML element. I
          could easily support the real keyboard, improve performance,
          etc. with JavaScript on the player page. But it wouldn&rsquo;t
          be right.
        </li>
        <li>
          <b>Calcite must be generic &mdash; no knowledge of x86, DOS,
          or this repo.</b> It doesn&rsquo;t know it&rsquo;s compiling a
          CPU, and it never finds out what the program does &mdash; it
          only ever reasons about the shape of the CSS. Since CSS has
          so few tools, the shapes are enumerable in advance even with
          no idea what they&rsquo;re for. Point it at a different
          computational stylesheet &mdash; another CPU, a Pong cabinet,
          a cellular automaton, a spreadsheet encoded in selectors
          &mdash; and it would speed those up just the same.
        </li>
        <li>
          <b>The CSS may not signal to Calcite in an unnatural way.</b>
          Plenty of languages allow compiler hints in the source,
          JavaScript once had a whole dialect of them (asm.js and its
          &ldquo;use asm&rdquo; pragma, killed off when WASM arrived).
          Forbidden here. Not only is the stylesheet spec-compliant, but
          it can&rsquo;t smuggle in anything <i>above and beyond</i> the
          spec either. No hints hidden in comments, no sleight of hand.
        </li>
      </ol>
    </div>
  {:else if nav.sub === 6}
    <!-- FAQs -->
    <div class="subpage" data-subpage="6">
      <h1>FAQs</h1>

      <div class="faq-list">
        <Foldable open={true}>
          {#snippet summary()}Really &mdash; no JavaScript?{/snippet}
          <p>
            Really &mdash; the machine is one CSS file, and a browser
            can evaluate every line of it; nothing you see comes from
            JavaScript. What a browser can&rsquo;t do is keep up:
            300&nbsp;MB of stylesheet is more than a tab survives, and
            even a small build runs at a couple of instructions per
            second. So this site feeds the same file to <b>Calcite</b>,
            a compiler built for the job &mdash;
            <a href="#about/calcite">its page</a> explains it, and why
            it isn&rsquo;t cheating.
          </p>
        </Foldable>

        <Foldable>
          {#snippet summary()}Don&rsquo;t you need an HTML page for this to work?{/snippet}
          <p>
            Yes &mdash; a small, dumb one. A tag that loads the
            stylesheet, one element for the clock, one for the CPU, and
            64,000 empty ones for the pixels. Nothing in it computes
            anything; it&rsquo;s scaffolding for the CSS to hang off.
          </p>
        </Foldable>

        <Foldable>
          {#snippet summary()}How can there be a clock? Nothing in CSS moves.{/snippet}
          <p>
            One thing in CSS moves by itself: animations. At the very
            bottom of the file a tiny animation ticks a counter &mdash;
            0, 1, 2, 3, forever &mdash; and each lap the machine
            advances by one instruction. The
            <a href="#about/file/clock">clock section</a> has the real
            keyframes, and the trick that lets 368,256 memory cells
            change at once.
          </p>
        </Foldable>

        <Foldable>
          {#snippet summary()}How does it draw video?{/snippet}
          <p>
            The screen is 64,000 boxes, 320 wide by 200 tall, each with
            a rule that turns its own byte of video memory into a
            background colour. The
            <a href="#about/file/screen">screen section</a> has the
            rules, the palette, and the faked electron beam.
          </p>
        </Foldable>

        <Foldable>
          {#snippet summary()}How do you control it? CSS can&rsquo;t see a keyboard.{/snippet}
          <p>
            It can&rsquo;t. What it can see is whether an element is
            currently being pressed &mdash; the <code>:active</code>
            selector &mdash; so the machine has an on-screen keyboard
            whose keys are real buttons. The
            <a href="#about/file/keys">keyboard section</a> shows the
            actual rules, live.
          </p>
        </Foldable>

        <Foldable>
          {#snippet summary()}What doesn&rsquo;t work in CSS?{/snippet}
          <p>
            <b>Sound</b> &mdash; there&rsquo;s just no way for CSS to
            make noise. Except&hellip; possibly displaying the sound
            wave visually? Perhaps that&rsquo;s future work.
          </p>
          <p>
            <b>A physical keyboard, or any other physical input.</b> I
            think clicking buttons is the only viable input mechanism
            to mimic a keyboard.
          </p>
          <p>
            <b>Any more complex OS than MS-DOS</b> would be a real pain
            in the arse, perhaps even impossible. Anything using
            protected mode, or 286/386 instructions is a significant
            step up in complexity. There&rsquo;s a solid barrier in the
            way: V8&rsquo;s string size limit, which carts are already
            pushing up against. On the other hand, emulating <i>this</i>
            was already a huge pain in the arse that seems like it
            might actually be impossible, so never say never.
          </p>
          <p>
            However, <b>Windows 1.0 is surprisingly possible.</b> It is
            just a GUI layer over DOS 16-bit real-mode; the main barrier
            is the required mouse support. And more Calcite performance
            work. Conceptually, we could allow the screen
            <code>&lt;div&gt;</code> pixels themselves to be hoverable
            and clickable, feeding that information to position and
            click the cursor on the screen. But I&rsquo;m releasing
            this first &mdash; the scope creep would be too egregious.
          </p>
          <p class="dim small">
            A minor note: I like the name CSS-DOS, but lack a catchy
            name for a CSS Windows. CSSWin and WinCSS are uncomfortably
            close to Tailwind CSS and Windsurf. I&rsquo;d probably go
            for Windows.css &mdash; nobody take that name, please.
          </p>
        </Foldable>

        <Foldable>
          {#snippet summary()}Is Doom actually playable?{/snippet}
          <p>
            Barely &mdash; the asterisk on the intro page is honest.
            Through Calcite it manages a frame or two per second:
            enough to walk, open doors and shoot, a long way from
            comfortable.
          </p>
        </Foldable>

        <Foldable>
          {#snippet summary()}Can CSS-DOS run any DOS program?{/snippet}
          <p>
            Yes &mdash; visit the Build page and hand the builder any
            DOS program (.com/.exe) or folder. Two conditions: it has
            to fit on a floppy, and it has to stick to 8086 instructions
            (no Intel 286 or 386 opcodes). The builder bakes it into a
            <Term t="cabinet">cabinet</Term> for you &mdash; every
            preset here was made exactly that way. One more limit: the
            finished file must stay under ~536&nbsp;MB, or you hit V8&rsquo;s
            string size limit and the file simply won&rsquo;t load in a
            browser. If that happens, try reducing the machine&rsquo;s
            RAM.
          </p>
        </Foldable>

        <Foldable>
          {#snippet summary()}How long did this take?{/snippet}
          <p>
            About six months of on-and-off hobbyist work. I have no
            idea how many AI tokens I used on the project, but
            it&rsquo;s easily in the hundreds of millions, probably
            thousands of pounds of API-equivalent usage.
          </p>
        </Foldable>

        <Foldable>
          {#snippet summary()}How did you debug this?{/snippet}
          <p>
            With enormous pain. Many late nights and tears shed. There
            is nothing quite like a program diverging from the
            reference emulator by a byte or two half a million ticks
            into boot, which only became apparent when the system
            crashed four million ticks into boot, inside a system with
            no debugger, no logging and no stack traces &mdash; just
            368,256 variables recalculating every tick, one of which
            did so wrongly. Good luck!
          </p>
          <p>
            I ended up building a messy collection of debug tools which
            were often themselves impractically slow unless used with
            restraint and finesse. Suffice to say, this project gave me
            a newfound appreciation for debug tooling. An LLM was
            useful, but without constant steering it would cheerfully
            chase individual bytes around for hours. I had to put in
            rules on what the model could do: all CLI debugger
            invocations could run for a maximum of two minutes at a
            time, for example.
          </p>
        </Foldable>

        <Foldable>
          {#snippet summary()}Did you use AI?{/snippet}
          <p>
            Yes, I did. I code in my day job too, and I haven&rsquo;t
            typed a line of code in earnest in around a year now.
            Claude &lsquo;wrote&rsquo; 100% of this project&rsquo;s
            code, except for some minor tweaks and fixes by me.
          </p>
          <p>
            Claude could never have figured the project out on its own,
            but it was immensely helpful. Claude lacked the intuition
            to contribute reliably on a conceptual level, although it
            had its moments &mdash; the writable shadow-disk, and
            <code>&lt;img&gt;</code> tag hack in Calcite, among others
            were Claude&rsquo;s idea. However, this project is an
            unusual one, taking Claude well out of distribution, and it
            often took a laughably inept path through some
            implementations. But what it lacked in smarts, it made up
            for in being able to spew out code to a spec while I did
            other things.
          </p>
          <p>
            As a long-time tinkerer and coder, I do miss the romantic
            thrill of cobbling code together by hand, rolling the dice
            on it, and feeling that pay-off (or letdown). Perhaps this
            is the mindset of an old fogey, but there&rsquo;s something
            about creating with your own two hands that&rsquo;s lost
            when you order a minion to do it for you, no matter how
            beautiful the end product. The ideas are mostly mine, but I
            didn&rsquo;t execute them.
          </p>
          <p>
            But. This project wouldn&rsquo;t exist without AI, full
            stop. I am 100% sure my patience would have run out before
            the machine booted. I don&rsquo;t know Rust well, and
            couldn&rsquo;t have coded Calcite myself. Claude made
            optimisations in it that I don&rsquo;t fully understand. In
            fact, the day Fable 5 was released, it doubled or tripled
            Calcite&rsquo;s performance in a single commit.
            There&rsquo;s something lovely about that, although some
            part of me wishes I was the one who did it.
          </p>
          <p>
            There&rsquo;s a tension: accessibility / convenience /
            frictionlessness versus challenge / satisfaction /
            ownership. A game that offered you a button to immediately
            skip every level would be pointless. But what about
            skipping <i>one</i> level? What if the option only appeared
            after being stuck on it for a while first? What if it cost a
            bit of money, so you couldn&rsquo;t do it willy nilly? When
            does that kind of option turn into a net positive?
          </p>
          <p>
            Some part of me often wishes for less choice, to have
            challenge forced upon me. Dark Souls has no level-skipping.
            If it did I would have crumbled, sullying the achievement
            with an asterisk. But a lot of people have completed Dark
            Souls, and nobody has <i>ever</i> run a full OS in CSS. It
            would have been tempting to declare this project impossible
            and quit. Doing five out of six levels and seeing the end
            is arguably better than giving up.
          </p>
          <p>
            Shunning LLMs feels like throwing the baby out with the
            bathwater. Maybe I&rsquo;m spoiled, but considering
            brainlessly editing the CSS of this website myself has
            started to feel menial in an old-timey way, like washing
            clothes by hand or emptying the chamber pot. Maybe
            because I&rsquo;ve had a taste of AI coding, or maybe
            I&rsquo;ve had a taste of the depraved stuff and ordinary
            CSS doesn&rsquo;t turn me on any more. Either way, I do want
            to automate centering divs and fiddling with line heights.
            That part is just an obstruction, a waste of time. Can
            someone make an AI model, that either teaches you new
            skills or automates things you can already do, rather than
            doing things entirely for you? I&rsquo;d subscribe to that.
          </p>
          <p>
            Until then, I hope for the restraint to use tools to reach
            higher places, not to avoid getting off my arse at all.
          </p>
        </Foldable>

        <Foldable>
          {#snippet summary()}Can I contribute/donate?{/snippet}
          <p>
            <b>Code</b>: both projects (CSS-DOS and Calcite) are
            open-source, and I&rsquo;d welcome code contributions. Huge
            performance gains are on the table for Calcite, which is
            currently written in a sub-optimal way and needs a
            ground-up refactor. Not for the faint of heart. Interested
            contributors could also fix bugs that prevent other DOS
            games&rsquo; compatibility &mdash; many programs still
            crash, hang or run too slowly to be playable.
          </p>
          <p>
            <b>Cash</b>: I earn enough from my day job &mdash; if you
            like this work, please direct any cash you can spare to
            <a href="https://adhduk.co.uk/donate-to-adhd-uk/" class="ext-link" target="_blank" rel="noopener">ADHD UK</a>
            instead of to me.
          </p>
        </Foldable>

        <Foldable>
          {#snippet summary()}I have a question that isn&rsquo;t answered here.{/snippet}
          <p>
            Email me &mdash; <b>ahmed.elhadi.amer&nbsp;[at]&nbsp;gmail&nbsp;(dot)&nbsp;com</b>.
            I&rsquo;d love to hear from interested people.
          </p>
        </Foldable>

        <Foldable>
          {#snippet summary()}Can I get in touch with you for press/videos/podcasts/etc.?{/snippet}
          <p>
            Email me &mdash; <b>ahmed.elhadi.amer&nbsp;[at]&nbsp;gmail&nbsp;(dot)&nbsp;com</b>.
            I&rsquo;d be happy to contribute to press, YouTube videos,
            and whatever else.
          </p>
        </Foldable>
      </div>
    </div>
  {:else if nav.sub === 7}
    <!-- Credits (restored 2026-07-04 from the retired How-it-works route) -->
    <div class="subpage" data-subpage="7">
      <h1>Credits &amp; thanks</h1>
      <p>
        CSS-DOS stands on the shoulders of people who proved, piece by
        piece, that a browser&rsquo;s style engine could be a computer.
      </p>

      <h3 class="credits-head">Prior art &amp; kindred projects</h3>
      <ul class="credits-list">
        <li>
          <a href="https://lyra.horse/x86css/" class="ext-link" target="_blank" rel="noopener">x86CSS</a>
          &mdash; Lyra Rebane
          (<a href="https://github.com/rebane2001/x86css" class="ext-link" target="_blank" rel="noopener">rebane2001</a>).
          A working 16-bit x86 CPU in pure CSS &mdash; the original
          demonstration that the trick is possible at all. CSS-DOS grew
          out of it.
        </li>
        <li>
          <a href="https://dev.to/janeori/expert-css-the-cpu-hack-4ddj" class="ext-link" target="_blank" rel="noopener">The CSS CPU Hack</a>
          &mdash; Jane Ori. The writeup for doing real computation in CSS.
        </li>
        <li>
          <a href="https://github.com/nicknisi/emu8" class="ext-link" target="_blank" rel="noopener">emu8</a>
          &mdash; the reference 8086 emulator CSS-DOS checks itself against.
        </li>
      </ul>

      <h3 class="credits-head">Operating system</h3>
      <ul class="credits-list">
        <li>
          The booted OS for most programs is <b>EDR-DOS</b>, from the
          <a href="https://svardos.org/" class="ext-link" target="_blank" rel="noopener">SvarDOS</a>
          build &mdash; an open, freely-distributable DR-DOS descendant. CSS-DOS
          ships its <code>kernel.sys</code> and <code>command.com</code> on the
          emulated floppy.
        </li>
        <li>
          Also included is the real <b>MS-DOS 4.00</b> by Microsoft
          &mdash; <a href="https://github.com/microsoft/MS-DOS" class="ext-link" target="_blank" rel="noopener">open-sourced in 2024</a>
          under the MIT licence. CSS-DOS boots it unmodified from its own
          emulated floppy, alongside <b>FreeDOS EDIT</b>
          (<a href="https://www.freedos.org/" class="ext-link" target="_blank" rel="noopener">freedos.org</a>)
          as its text editor.
        </li>
      </ul>

      <h3 class="credits-head">Assets</h3>
      <ul class="credits-list">
        <li>
          Font (headings, code, chrome): &ldquo;Web437 IBM VGA&rdquo; by
          VileR, from the
          <a href="https://int10h.org/oldschool-pc-fonts/" class="ext-link" target="_blank" rel="noopener">Oldschool PC Font Pack</a>
          (int10h.org) &mdash; CC&nbsp;BY-SA&nbsp;4.0.
        </li>
        <li>
          Font (body text): &ldquo;<a href="https://laemeur.sdf.org/fonts/" class="ext-link" target="_blank" rel="noopener">More Perfect DOS VGA</a>&rdquo;
          by L&AElig;MEUR, remastering Zeh Fernando&rsquo;s
          &ldquo;Perfect DOS VGA 437&rdquo;; IBM designed the glyphs.
          Free for all use.
        </li>
      </ul>
    </div>
  {/if}

  </section>
</Wizard>
