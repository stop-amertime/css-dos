# Player fonts

`Web437_IBM_VGA_8x16.woff` — the IBM VGA 8×16 webfont from VileR's
**Oldschool PC Font Pack v2.2** (<https://int10h.org/oldschool-pc-fonts/>),
licensed **CC BY-SA 4.0** (see `FONT-LICENSE.TXT`; attribution: "VileR,
int10h.org"). Self-hosted (sha256 `0f0969…32c5a3`, bit-identical to the
official pack) — previously hotlinked from a third-party CDN mirror with
no attribution, which violated the license. Used by the player and site
pages via `@font-face` as `WebVGA`.

`vga-8x16.bin` — the standard IBM VGA 8×16 ROM font (codepage 437).
4096 bytes: 256 glyphs × 16 rows, each row is one byte, bit 7 = leftmost
pixel. Fetched from <https://github.com/spacerace/romfont> which collects
public-domain VGA BIOS ROM fonts. No transformation applied — this is
the raw bitmap the real BIOS would expose.

Loaded once by the player at startup and rasterised into a pixel canvas
for text modes 0x01 and 0x03.
