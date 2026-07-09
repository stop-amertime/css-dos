<script>
  // A DOS-styled disclosure: a [+]/[-] toggle glyph (blue) followed by a
  // caller-supplied summary, and folded-away body content. Replaces the
  // two ad-hoc <details> widgets (Build's "Advanced configuration" and
  // Play's "Is this cheating?").
  //
  //   <Foldable>
  //     {#snippet summary()}…{/snippet}
  //     …body…
  //   </Foldable>
  //
  // `open` binds the current state; `class` lets a caller theme the frame
  // (e.g. a coloured border) without re-implementing the glyph.
  let { summary, children, open = $bindable(false), class: klass = '' } = $props();
</script>

<details class="foldable {klass}" bind:open>
  <summary>
    <span class="fold-glyph" aria-hidden="true"></span>
    <span class="fold-summary">{@render summary()}</span>
  </summary>
  <div class="fold-body">
    {@render children()}
  </div>
</details>

<style>
  .foldable {
    /* Blocky shadow instead of a 1px outline (hairlines read hi-res). */
    box-shadow: 3px 3px 0 var(--edit-black);
    background: var(--edit-white);
  }
  .foldable > summary {
    list-style: none;
    cursor: pointer;
    user-select: none;
    padding: 10px 14px;
    /* A soft blue-grey so the fold reads as its own control instead of
       blending into the dialog-gray page (glyph is blue — same family). */
    background: #ccd3e8;
    color: var(--edit-black);
    font-size: 16px;
    line-height: 16px;
    display: flex;
    gap: 8px;
    align-items: baseline;
    flex-wrap: wrap;
  }
  .foldable > summary::-webkit-details-marker { display: none; }
  .foldable > summary:hover { background: #dbe1f2; }

  /* The toggle glyph — blue, so it reads as the interactive affordance. */
  .foldable .fold-glyph { color: var(--edit-blue); flex: none; }
  .foldable .fold-glyph::before { content: '[+]'; }
  .foldable[open] .fold-glyph::before { content: '[-]'; }

  .foldable .fold-summary { flex: 1 1 auto; min-width: 0; }

  /* No divider under the open summary: the tinted band vs white body
     already separates them (bands, not hairlines). */

  /* Background-primer variant (`class="fold-bg"`): holds prerequisite
     knowledge some readers won't need — warm tint + [?] glyph so it reads
     as "open if new to this", distinct from the deep-dive folds. Delivered
     via the `class` prop onto this component's own root element. */
  .foldable.fold-bg > summary { background: #e6dcc3; }
  .foldable.fold-bg > summary:hover { background: #f0e8d3; }
  .foldable.fold-bg:not([open]) .fold-glyph::before { content: '[?]'; }
  .foldable .fold-body {
    padding: 12px 16px;
    background: var(--edit-white);
  }
</style>
