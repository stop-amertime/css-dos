<script>
  import '../styles/_fragments/foldable.css';
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
