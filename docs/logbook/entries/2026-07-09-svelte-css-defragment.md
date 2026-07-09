# Svelte CSS defragment: fragments → scoped component styles

Moved 15 single-owner `web/site/src/styles/_fragments/*.css` files into
their owning component's `<style>` block (port-artifact fragments were
causing specificity/import-order collisions; owner wants components to
own their styles). Converted: foldable, moon-viz, tick-clock, ram-write,
css-demo, term, step-dots, sign-demo, kbd-demo, file-map, pixel-screen,
split-pane, result-floppy, build-progress, env-notice. `cart-grid.css`
split across its 3 real owners (CartGrid/CartCard/CustomPanel.svelte),
since markup for `.cart-card`/`.cart-cover*` and `.custom-panel*` lives
in sibling components, not CartGrid itself. Two dead-code blocks
dropped (unreferenced anywhere): `#stages`/`.log-pre` (build-progress),
`.cart-list*`/`.cart-selected-line` (cart-grid).

`cabinet-bar.css` kept (slimmed): `.hint-overlay` + `.anatomy-pane` are
rendered by `routes/About.svelte` as siblings of `<CabinetBar>`, not
inside its own template, so they can't be scoped there — everything
else CabinetBar draws is now in `CabinetBar.svelte`'s `<style>`.

Left alone per brief: `about.css`, `anatomy.css`, `build.css`,
`play.css`, `UNPLACED.css` (multi-consumer), `pipeline.css` (dead, no
importer — out of scope, not deleted).

Verified via Playwright screenshot diff (fresh tab, zero console
errors) across home/about-why/how/file/faqs/build/build-configure/play,
including Foldable open state, the `fold-bg` variant, and the
`.foldable.advanced` external-theme variant — all pixel-identical.
