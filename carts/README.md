# Example carts

Maintained carts shipped with the repo. Each folder is a cart the
builder can turn into a cabinet. (The lineup is in flux - see the
licensing re-cut in `docs/logbook/STATUS.md` active work.)

| Cart | What it is | Boots into |
|---|---|---|
| `doom8088/` | Doom8088 (8088 build of Doom) + shareware WAD | game |
| `dos-shell/` | Nine FreeDOS utilities (EDIT, DEBUG, MEM, TREE, …) | `A:\>` prompt |
| `pop1_4/` | Prince of Persia 1.4 | game |
| `prince-of-persia/` | Prince of Persia (older cut) | game |
| `rogue1_0/` | Rogue 1.0 | game |
| `sokoban/` | Sokoban | game |
| `zork1/` | Zork I under FROTZ | game |
| `test-carts/` | Tiny conformance/smoke carts (not featured) | varies |

To build one:

```
node builder/build.mjs carts/dos-shell -o dos-shell.css
```

To run the cabinet:

- Start the site (`npm run dev`), open the Build page, pick a cart -
  or point the player at your built `.css` directly.
- Or run it fast: `../calcite/target/release/calcite-cli -i dos-shell.css`.

## Adding your own

Drop a folder (or zip) containing a DOS `.COM`/`.EXE` - the builder infers
sensible defaults without a `program.json`. See `docs/cart-format.md` for
the cart schema and `docs/building.md` for the walkthrough. To feature a
cart on the site's landing grid, give it `display.cover` (boxart) or
`display.bullets` (text card) in its `program.json`.
