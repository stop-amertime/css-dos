# 2026-07-10 - Machine element renamed `.cpu` → `.motherboard`; chipset split out; file reordered

Owner call during the site-copy pass: `.cpu` mislabelled the whole
machine. Kiln now emits two flat rules targeting ONE player element
(`class="window-body motherboard cpu"`): `.cpu` = decode + 14 register
tables + write slots (265 KB); `.motherboard` = everything else, incl.
a new CHIPSET block (PIT/PIC/keyboard-latch/DAC tables + peripheral/
IRQ compute; 16 KB). Nested `&.cpu` was REJECTED: calcite's parser
silently skips non-`:has` nested rules (stylesheet.rs) - flat sibling
rules on a double-classed element are the calcite-safe equivalent.
New file order: util→cpu→chipset→keys→screen→decl→memr→memw→disk→
clock; clock is now one contiguous region (buffer reads moved beside
the keyframes). Pixel rules `.motherboard #pN` cost +0.7 MB (screen
6.5→7.0 MB; sokoban total 309.8 MB). Verified: sokoban fast-shoot to
tick 3M reaches its title prompt on calcite; site build green;
raw-regen/pixels tests updated + PASS. Site: new SectionChipset.svelte
carousel page; groups.js/SEGS/ZOOM/router re-measured from the build.
