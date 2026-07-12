<script>
  // The file map — the cabinet bar as a clickable map, the file's
  // sections as a carousel. The current section lives on the router
  // (nav.section) so it's addressable — #about/file/clock deep-links.
  import { fly } from 'svelte/transition';
  import { nav, FILE_SECTIONS } from '../../lib/router.svelte.js';
  import CabinetBar from '../../components/anatomy/CabinetBar.svelte';
  import { GROUPS } from '../../components/anatomy/groups.js';
  import SectionMap from '../../components/anatomy/SectionMap.svelte';
  import SectionUtil from '../../components/anatomy/SectionUtil.svelte';
  import SectionCpu from '../../components/anatomy/SectionCpu.svelte';
  import SectionChipset from '../../components/anatomy/SectionChipset.svelte';
  import SectionKeys from '../../components/anatomy/SectionKeys.svelte';
  import SectionScreen from '../../components/anatomy/SectionScreen.svelte';
  import SectionMemDecl from '../../components/anatomy/SectionMemDecl.svelte';
  import SectionMemWrite from '../../components/anatomy/SectionMemWrite.svelte';
  import SectionMemRead from '../../components/anatomy/SectionMemRead.svelte';
  import SectionDisk from '../../components/anatomy/SectionDisk.svelte';
  import SectionClock from '../../components/anatomy/SectionClock.svelte';

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
</script>

<div class="subpage subpage-filemap">
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

<style>
  /* This subpage opts out of the centred prose column — the cabinet
     bar and anatomy pane want the full width.

     The PANE is the scroll container here, not .wiz-scroll: the bar +
     connector + pane frame stay put and only the section text scrolls,
     so the connector never detaches. The :has chain hands the band's
     height down to the pane (min-height:0 at every flex level or the
     column refuses to shrink). .wiz-scroll and .learn-step belong to
     the wizard shell, hence :global. */
  :global(.wiz-scroll:has(.subpage-filemap)) {
    overflow-y: hidden;
    display: flex;
    flex-direction: column;
  }
  :global(.wiz-scroll:has(.subpage-filemap) > .window-body),
  :global(.wiz-scroll:has(.subpage-filemap) .learn-step) {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .subpage-filemap {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  /* The section content below the topper: a box faintly tinted with
     the section's colour, tied to its bar segment by the connector
     line that CabinetBar drops onto its top edge (.drop-tick — pane
     margin-top and the tick height are matched). */
  .anatomy-pane {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    margin-top: 12px;
    border: 2px solid var(--pane-c, var(--edit-black));
    background: color-mix(in srgb, var(--pane-c, var(--edit-black)) 5%, var(--edit-white));
    padding: 12px 16px 12px;
  }

  /* Pane header: the section's title + size with the carousel
     position at the right. */
  .pane-head {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin-bottom: 18px;
  }
  .pane-title {
    margin: 0;
    font-size: 26px;
    line-height: 28px;
    font-weight: normal;
    letter-spacing: normal;
    color: var(--edit-black);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pane-title .sz { color: var(--edit-red); font-size: 19px; }
  .pane-count {
    margin-left: auto;
    flex: none;
    color: #555;
    font-size: 15px;
    line-height: 16px;
  }

  @media (max-width: 640px) {
    /* Phone: tighter chrome (window-body padding is 12px 10px here). */
    .anatomy-pane { padding: 8px 10px 8px; }
    .pane-head { margin-bottom: 12px; }
    .pane-title { font-size: 20px; line-height: 22px; }
    .pane-title .sz { font-size: 15px; }
    .pane-count { font-size: 13px; }
  }
</style>
