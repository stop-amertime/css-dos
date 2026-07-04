<script>
  // Term — an inline defined word: reads as normal text with a subtle
  // dotted underline; hovering, tapping or focusing it shows the
  // definition in a small card. The card is position:fixed (anchored
  // off getBoundingClientRect) so the wizard's scroll band can't clip
  // it; any scroll or outside tap closes it. Definitions live in
  // lib/terms.js.
  import '../styles/_fragments/term.css';
  import { TERMS } from '../lib/terms.js';

  let { t, children } = $props();
  let el;
  let tip = $state(null); // {x, bottom} fixed-position anchor, null = closed

  const W = 272; // card max-width + margin, for the horizontal clamp

  function open() {
    const r = el.getBoundingClientRect();
    tip = {
      x: Math.round(Math.max(8, Math.min(r.left, window.innerWidth - W))),
      bottom: Math.round(window.innerHeight - r.top + 5),
    };
  }
  const close = () => (tip = null);

  $effect(() => {
    if (!tip) return;
    // The card is viewport-anchored: close it when the text scrolls
    // away underneath it, or when anything else is tapped.
    const away = (e) => { if (!el.contains(e.target)) close(); };
    window.addEventListener('scroll', close, true);
    window.addEventListener('pointerdown', away, true);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('pointerdown', away, true);
    };
  });
</script>

<span bind:this={el} class="term" tabindex="0"
      onmouseenter={open} onmouseleave={close}
      onfocus={open} onblur={close}
      onclick={open}
      onkeydown={(e) => e.key === 'Escape' && close()}
      >{@render children()}</span>{#if tip}<div class="term-tip" role="tooltip"
    style="left:{tip.x}px; bottom:{tip.bottom}px">{TERMS[t]}</div>{/if}
