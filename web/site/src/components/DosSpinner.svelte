<script>
  // Old-school DOS wait throbber: the | / - \ spinner every DOS-era
  // utility drew while working, one character rotating in place.
  // Pure text - inherits font and colour from where it sits. Any
  // "loading" wording belongs to the caller; this is just the char.
  const FRAMES = ['|', '/', '-', '\\'];
  let i = $state(0);
  $effect(() => {
    const t = setInterval(() => (i = (i + 1) % FRAMES.length), 120);
    return () => clearInterval(t);
  });
</script>

<span class="dos-spinner" aria-hidden="true">{FRAMES[i]}</span>

<style>
  .dos-spinner {
    /* Fixed 1ch cell so the frames don't jitter the line width. */
    display: inline-block;
    width: 1ch;
    text-align: center;
  }
</style>
