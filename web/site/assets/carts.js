// carts.js — visual manifest for the cart-card grid on index.html.
//
// This file is purely cosmetic: cover art, description, and a palette for
// the placeholder when no cover exists. The actual cart bytes are loaded
// by build.js from /carts/<id>/ via /_carts.json. wizard.js intersects
// this manifest with what the server reports.
//
// Cart `id` MUST match the folder name under carts/.
// Carts not in this manifest still appear (as auto-placeholder cards) so
// new carts under carts/ don't need a code change to be visible.

window.CARTS = [
  {
    id: 'doom8088',
    name: 'Doom (8088)',
    desc: 'id Software, 1993. 8088-class port by FrenkelS. Cacodemons in mode 13h.',
    cover: '/assets/boxart/doom.jpg',
  },
  {
    id: 'prince-of-persia',
    name: 'Prince of Persia',
    desc: 'Brøderbund, 1989. Jordan Mechner. Rotoscoped platformer, original DOS release.',
    cover: '/assets/boxart/persia.jpg',
  },
  {
    id: 'zork1',
    name: 'Zork I',
    desc: 'Infocom, 1980. The Great Underground Empire. Z-machine interpreter, text only.',
    cover: '/assets/boxart/zork.jpg',
  },
  {
    id: 'sokoban',
    name: 'Sokoban',
    desc: 'Push every box onto a target. Originally Hiroyuki Imabayashi, 1982.',
    cover: '/assets/boxart/sokoban.jpg',
  },
  {
    id: 'rogue',
    name: 'Rogue',
    desc: 'Michael Toy & Ken Arnold, 1980. The original dungeon-crawler. ASCII forever.',
    placeholderPalette: ['#55ff55', '#000000'],
  },
  {
    id: 'digger',
    name: 'Digger',
    desc: 'Windmill Software, 1983. Dig tunnels, dodge nobbins, collect gold. CGA classic.',
    placeholderPalette: ['#ffff55', '#aa0000'],
  },
  {
    id: 'lemmings',
    name: 'Lemmings',
    desc: 'DMA Design, 1991. Save the lemmings from themselves. Click on each one fast.',
    placeholderPalette: ['#55ffff', '#aa00aa'],
  },
  {
    id: 'montezuma',
    name: "Montezuma's Revenge",
    desc: 'Parker Bros, 1984. Find the treasure of Montezuma II. Brutal platformer.',
    placeholderPalette: ['#ff55ff', '#0000aa'],
  },
];
