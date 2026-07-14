<script>
  // The file map - the cabinet bar as a clickable map, the file's
  // sections as a carousel. The current section lives on the router
  // (nav.section) so it's addressable - /about/file/clock deep-links.
  //
  // Page anatomy (owner call, 2026-07-12): ONE code pane at the top -
  // coloured border, big header (name + size + code icon, the only
  // place they appear) with the section's real code (TreeView) inside
  // it - then, after a short gutter, the explanation on the tinted
  // background with no border. The tree data is mapped here so the
  // Section* components carry only the explanation.
  import { fly } from 'svelte/transition';
  import { nav, FILE_SECTIONS } from '../../lib/router.svelte.js';
  import CabinetBar from '../../components/anatomy/CabinetBar.svelte';
  import { GROUPS } from '../../components/anatomy/groups.js';
  import TreeView from '../../components/anatomy/tree/TreeView.svelte';
  import IconCodeFile from '~icons/pixelarticons/script-text';
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
  import { UTIL_TREE } from '../../components/anatomy/tree/util-tree.js';
  import { CPU_TREE } from '../../components/anatomy/tree/cpu-tree.js';
  import { CHIPSET_TREE } from '../../components/anatomy/tree/chipset-tree.js';
  import { KEYS_TREE } from '../../components/anatomy/tree/keys-tree.js';
  import { SCREEN_TREE } from '../../components/anatomy/tree/screen-tree.js';
  import { DECL_TREE } from '../../components/anatomy/tree/decl-tree.js';
  import { MEMW_TREE } from '../../components/anatomy/tree/memw-tree.js';
  import { MEMR_TREE } from '../../components/anatomy/tree/memr-tree.js';
  import { DISK_TREE } from '../../components/anatomy/tree/disk-tree.js';
  import { CLOCK_TREE } from '../../components/anatomy/tree/clock-tree.js';

  const SECTIONS = {
    map: SectionMap, util: SectionUtil, cpu: SectionCpu,
    chipset: SectionChipset, keys: SectionKeys,
    screen: SectionScreen, decl: SectionMemDecl, memw: SectionMemWrite,
    memr: SectionMemRead, disk: SectionDisk, clock: SectionClock,
  };
  const TREES = {
    util: UTIL_TREE, cpu: CPU_TREE, chipset: CHIPSET_TREE,
    keys: KEYS_TREE, screen: SCREEN_TREE, decl: DECL_TREE,
    memw: MEMW_TREE, memr: MEMR_TREE, disk: DISK_TREE, clock: CLOCK_TREE,
  };
  // The map page isn't a file section (no bytes, no bar segment) - it
  // gets a header-only code pane and leaves the whole bar lit.
  const MAP_GROUP = { id: 'map', label: 'The whole file', size: '309 MB', c: '#555555' };
  const curGroup = $derived(GROUPS.find((x) => x.id === nav.section) ?? MAP_GROUP);
  const CurSection = $derived(SECTIONS[nav.section]);
  const curTree = $derived(TREES[nav.section] ?? null);
  // First-visit hint: shown on every page of the carousel until the
  // reader dismisses it (dismissal persists - router.svelte.js).
  const hintLive = $derived(!nav.hintDismissed);
</script>

<div class="subpage subpage-filemap">
  <CabinetBar selected={nav.section === 'map' ? null : nav.section}
              hint={hintLive}
              onselect={(g) => nav.sectionJump(g)}
              ondismiss={() => nav.dismissHint()} />

  <div class="anatomy-pane" style="--pane-c:{curGroup.c}">
    {#key nav.section}
      <div class="sec-body" in:fly={{ x: 44 * nav.sectionDir, duration: 180 }}>
        <div class="code-pane">
          <div class="pane-head">
            <IconCodeFile class="pane-icon" aria-hidden="true" />
            <h2 class="pane-title">
              {curGroup.label} <span class="sz">{curGroup.size}</span>
            </h2>
            <span class="pane-count">{nav.sectionIdx() + 1} / {FILE_SECTIONS.length}</span>
          </div>
          {#if curTree}
            <TreeView nodes={curTree} title={curGroup.label} />
          {/if}
        </div>
        <div class="explain">
          <div class="explain-inner">
            <CurSection />
          </div>
        </div>
      </div>
    {/key}
  </div>
</div>

<style>
  /* This subpage opts out of the centred prose column - the cabinet
     bar and anatomy pane want the full width.

     The PANE is the scroll container here, not .wiz-scroll: the bar +
     connector stay put and only the section content scrolls, so the
     connector never detaches. The :has chain hands the band's height
     down to the pane (min-height:0 at every flex level or the column
     refuses to shrink). .wiz-scroll and .learn-step belong to the
     wizard shell, hence :global. The window-body padding also drops
     here - the default 24/28px ring squeezed the pane. */
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
  :global(.wiz-scroll:has(.subpage-filemap) > .window-body) {
    padding: 12px 14px 10px;
  }
  .subpage-filemap {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  /* The scroll container below the bar. No chrome of its own - the
     code pane and explanation carry the colour. margin-top matches
     the connector tick CabinetBar drops onto its top edge. */
  .anatomy-pane {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    margin-top: 12px;
  }
  .sec-body {
    padding-right: 6px;   /* breathing room against the scrollbar */
  }

  /* The code pane: the section's coloured border, one big header -
     icon, title, size, carousel position - and the real code below a
     tinted separator. */
  .code-pane {
    border: 2px solid var(--pane-c, var(--edit-black));
    background: var(--edit-white);
    padding: 10px 14px 12px;
  }
  .pane-head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 1px solid color-mix(in srgb, var(--pane-c, var(--edit-black)) 35%, var(--edit-white));
  }
  /* Header-only pane (the map page has no tree): no separator, no
     hollow band under the title. */
  .pane-head:last-child {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
  }
  /* Header text takes the section's colour, darkened: the title a
     lot, the size less so, the icon matching the size (owner call,
     2026-07-12 - plain black + red beside a coloured border read as
     random). */
  .code-pane :global(.pane-icon) {
    width: 22px;
    height: 22px;
    color: color-mix(in srgb, var(--pane-c, var(--edit-black)) 70%, black);
    flex: none;
  }
  .pane-title {
    margin: 0;
    font-size: 26px;
    line-height: 28px;
    font-weight: normal;
    letter-spacing: normal;
    color: color-mix(in srgb, var(--pane-c, var(--edit-black)) 45%, black);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pane-title .sz {
    color: color-mix(in srgb, var(--pane-c, var(--edit-black)) 70%, black);
    font-size: 19px;
  }
  .pane-count {
    margin-left: auto;
    flex: none;
    color: #555;
    font-size: 15px;
    line-height: 16px;
  }

  /* The explanation: tinted with the section's colour, borderless,
     after a short gutter. The inner column centres the prose and
     widgets instead of leaving them hugging the left edge. */
  .explain {
    margin-top: 10px;
    background: color-mix(in srgb, var(--pane-c, var(--edit-black)) 5%, var(--edit-white));
    padding: 16px 16px 8px;
  }
  .explain-inner {
    max-width: 680px;
    margin-inline: auto;
  }

  @media (max-width: 640px) {
    /* Phone: tighter chrome all round. */
    :global(.wiz-scroll:has(.subpage-filemap) > .window-body) {
      padding: 8px 8px 8px;
    }
    .code-pane { padding: 8px 8px 10px; }
    .pane-head { margin-bottom: 8px; padding-bottom: 6px; }
    .pane-title { font-size: 20px; line-height: 22px; }
    .pane-title .sz { font-size: 15px; }
    .pane-count { font-size: 13px; }
    .code-pane :global(.pane-icon) { width: 18px; height: 18px; }
    .explain { padding: 12px 10px 6px; }
  }
</style>
