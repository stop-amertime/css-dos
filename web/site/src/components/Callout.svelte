<script>
  // Callout — the boxed asides. Replaces the old bare "NOTE" chip
  // with a per-kind pixel icon + label: info (blue), tip (yellow
  // lightbulb), warn (red). Icons from pixelarticons via
  // unplugin-icons.
  import IconInfo from '~icons/pixelarticons/info-box';
  import IconTip from '~icons/pixelarticons/lightbulb-on';
  import IconWarn from '~icons/pixelarticons/warning-box';

  let { kind = 'info', label = '', children } = $props();
  const ICONS = { info: IconInfo, tip: IconTip, warn: IconWarn };
  const DEFAULT_LABELS = { info: 'Note', tip: 'Tip', warn: 'Heads up' };
  const Icon = $derived(ICONS[kind] ?? IconInfo);
</script>

<div class="callout callout-{kind}">
  <span class="callout-head">
    <Icon class="callout-icon" aria-hidden="true" />
    <span class="callout-label">{label || DEFAULT_LABELS[kind]}</span>
  </span>
  {@render children()}
</div>

<style>
  /* DOS-setup style callout: a bordered note with a floating head chip
     (pixel icon + label), colour per kind (info blue / tip yellow /
     warn red). */
  .callout {
    margin: 18px 0 14px;
    padding: 14px 14px 12px;
    border: 1px solid var(--edit-black);
    background: var(--edit-white);
    box-shadow: 4px 4px 0 var(--edit-black);
    position: relative;
    max-width: 660px;
  }
  .callout-head {
    position: absolute;
    top: -10px;
    left: 10px;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 1px 8px 1px 6px;
    font-family: 'WebVGA', monospace;
    letter-spacing: normal;
    font-size: 13px;
    line-height: 15px;
    background: var(--edit-black);
    color: var(--edit-yellow);
  }
  .callout :global(.callout-icon) { width: 13px; height: 13px; flex: none; }
  .callout-info .callout-head { background: var(--edit-blue); color: var(--edit-white); }
  .callout-tip .callout-head { background: var(--edit-black); color: var(--edit-yellow); }
  .callout-warn .callout-head { background: var(--edit-red); color: var(--edit-white); }
  .callout-info { border-color: var(--edit-blue); box-shadow: 4px 4px 0 var(--edit-blue); }
  .callout-warn { border-color: var(--edit-red); box-shadow: 4px 4px 0 var(--edit-red); }
  /* The body copy is authored by the caller — hence :global. */
  .callout :global(p) { margin: 0 0 6px; }
  .callout :global(p:last-child) { margin-bottom: 0; }
</style>
