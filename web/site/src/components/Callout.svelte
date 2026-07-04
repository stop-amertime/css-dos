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
