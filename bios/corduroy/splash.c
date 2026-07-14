/* splash.c -- mode 13h splash with CSS-DOS logo and POST lines. */
#include "splash.h"
#include "font.h"

#define VGA_SEG 0xA000u

extern const unsigned char logo_bin[1024];

/* CGA-16 palette matching tools/png-to-vga.py. VGA DAC uses 6-bit values
   (0-63), so each channel is the CGA byte >> 2. */
static const unsigned char cga_dac[16][3] = {
    { 0x00, 0x00, 0x00 }, /* 0  black */
    { 0x00, 0x00, 0x2A }, /* 1  blue */
    { 0x00, 0x2A, 0x00 }, /* 2  green */
    { 0x00, 0x2A, 0x2A }, /* 3  cyan */
    { 0x2A, 0x00, 0x00 }, /* 4  red */
    { 0x2A, 0x00, 0x2A }, /* 5  magenta */
    { 0x2A, 0x15, 0x00 }, /* 6  brown */
    { 0x2A, 0x2A, 0x2A }, /* 7  light gray */
    { 0x15, 0x15, 0x15 }, /* 8  dark gray */
    { 0x15, 0x15, 0x3F }, /* 9  light blue */
    { 0x15, 0x3F, 0x15 }, /* 10 light green */
    { 0x15, 0x3F, 0x3F }, /* 11 light cyan */
    { 0x3F, 0x15, 0x15 }, /* 12 light red */
    { 0x3F, 0x15, 0x3F }, /* 13 light magenta */
    { 0x3F, 0x3F, 0x15 }, /* 14 yellow */
    { 0x3F, 0x3F, 0x3F }, /* 15 white */
};

static void outb(unsigned int port, unsigned char val);
#pragma aux outb = "out dx, al" parm [dx] [al] modify exact [];

static void sti(void);
#pragma aux sti = "sti" modify exact [];

static void int10_ax(unsigned int ax);
#pragma aux int10_ax = "int 0x10" parm [ax] modify exact [ax bx cx dx];

/* REP STOSB into ES:DI. Parameters: segment, offset, value, count.
   Calcite pattern-recognises this shape (addr++, counter--, mem[addr]=val)
   and lowers it to a single MemoryFill op - one CSS tick for the whole fill. */
static void vga_fill(unsigned int seg, unsigned int off,
                     unsigned char val, unsigned int count);
#pragma aux vga_fill =              \
    "mov es, ax"                    \
    "mov al, bl"                    \
    "rep stosb"                     \
    parm [ax] [di] [bl] [cx]        \
    modify exact [ax bx cx di es];

static void set_mode_13h(void) {
    int10_ax(0x0013);
}

static void set_mode_text(void) {
    int10_ax(0x0003);
}

static void set_palette(void) {
    unsigned int i;
    outb(0x3C8, 0);
    for (i = 0; i < 16; i++) {
        outb(0x3C9, cga_dac[i][0]);
        outb(0x3C9, cga_dac[i][1]);
        outb(0x3C9, cga_dac[i][2]);
    }
}

static void vga_pixel(unsigned int x, unsigned int y, unsigned char color) {
    unsigned char __far *fb = (unsigned char __far *)((unsigned long)VGA_SEG << 16);
    fb[(unsigned long)y * 320u + x] = color;
}

static void blit_logo(unsigned int dest_x, unsigned int dest_y, unsigned int scale) {
    unsigned int src_x, src_y, dx, dy;
    for (src_y = 0; src_y < 32; src_y++) {
        for (src_x = 0; src_x < 32; src_x++) {
            unsigned char px = logo_bin[src_y * 32 + src_x];
            if (px == 0xFF) continue;  /* transparent sentinel */
            for (dy = 0; dy < scale; dy++) {
                for (dx = 0; dx < scale; dx++) {
                    vga_pixel(dest_x + src_x * scale + dx,
                              dest_y + src_y * scale + dy,
                              px);
                }
            }
        }
    }
}

static void draw_char(unsigned int x, unsigned int y, char c, unsigned char color) {
    const unsigned char *glyph = font_glyph(c);
    unsigned int row, col;
    for (row = 0; row < FONT_HEIGHT; row++) {
        unsigned char bits = glyph[row];
        for (col = 0; col < FONT_WIDTH; col++) {
            if (bits & (0x80u >> col)) {
                vga_pixel(x + col, y + row, color);
            }
        }
    }
}

static void draw_text(unsigned int x, unsigned int y, const char *s, unsigned char color) {
    unsigned int cx = x;
    while (*s) {
        draw_char(cx, y, *s, color);
        cx += FONT_WIDTH;
        s++;
    }
}

#define BDA_SEG_LOCAL   0x0040u
#define BDA_TICKS_LO    0x006Cu
#define BDA_MEMORY_SIZE 0x0013u

static unsigned long read_ticks(void) {
    volatile unsigned int __far *p =
        (volatile unsigned int __far *)(((unsigned long)BDA_SEG_LOCAL << 16) + BDA_TICKS_LO);
    unsigned int lo = p[0];
    unsigned int hi = p[1];
    return ((unsigned long)hi << 16) | lo;
}

/* Pace the splash on the real BDA tick counter - 18.2 Hz, advanced by
   the INT 08h ISR now that install_pit() arms PIT ch0 at POST and
   splash_show() executes STI before the first wait.

   A poll loop, not HLT: this machine's IRQ frame pushes the CURRENT
   IP, so an interrupted HLT resumes AT the HLT and re-halts forever -
   and at 2 cycles per re-executed HLT it would also burn ~5x more CSS
   ticks per guest second than polling (~10 cycles/instruction). The
   2 s minimum below costs roughly 1M CSS ticks ≈ a second or two of
   wall time under calcite - deliberate: at full speed the splash was
   gone before anyone saw it. */
static void wait_until(unsigned long target_tick) {
    while (read_ticks() < target_tick) { }
}

static void wait_ticks(unsigned int n) {
    wait_until(read_ticks() + n);
}

/* This BIOS runs with SS (0x0030 stack) != DS (BIOS data), so a stack
   buffer must never be passed as a near `char *` - the callee reads it
   via DS and sees garbage (the original buf[32] version of this drew
   nothing, silently, since day one). Literals live in DS and are fine;
   digits are drawn by value via draw_char. */
static void draw_memory_line(unsigned int x, unsigned int y, unsigned char color) {
    unsigned char __far *p = (unsigned char __far *)((unsigned long)BDA_SEG_LOCAL << 16);
    unsigned int kb = *(unsigned int __far *)(p + BDA_MEMORY_SIZE);
    char digits[8];
    unsigned int dlen = 0, j;
    draw_text(x, y, "MEMORY ....... ", color);
    x += 15 * FONT_WIDTH;
    if (kb == 0) {
        digits[dlen++] = '0';
    } else {
        while (kb > 0) {
            digits[dlen++] = (char)('0' + (kb % 10u));
            kb /= 10u;
        }
    }
    for (j = 0; j < dlen; j++) {
        draw_char(x, y, digits[dlen - 1 - j], color);
        x += FONT_WIDTH;
    }
    draw_char(x, y, 'K', color);
}

void splash_show(void) {
    set_mode_13h();
    set_palette();

    /* Fill the screen with dark gray so the logo's black outline is
       visible. REP STOSB - one CPU instruction (well, one repeated one)
       for the whole 64000-byte framebuffer. Calcite recognises this as
       an affine memory-fill and lowers it to a single MemoryFill op. */
    vga_fill(VGA_SEG, 0, 8, 64000u);

    blit_logo(20, 52, 3);
    draw_text(140, 52, "CSS-DOS",       15);
    draw_text(140, 64, "CSS-BIOS V0.1",  7);

    /* IVT, BDA, PIC and PIT are all installed by now - let the timer
       tick so the waits below advance. entry.asm's own STI after
       bios_init returns is then a no-op. */
    sti();

    /* 12px line pitch (8px glyphs + 4px gap), matching the title block. */
    draw_text(140,  80, "IVT ........... OK", 7);
    wait_ticks(5);
    draw_text(140,  92, "BDA ........... OK", 7);
    wait_ticks(5);
    draw_memory_line(140, 104, 7);
    wait_ticks(5);
    draw_text(140, 116, "KEYBOARD ...... OK", 7);
    wait_ticks(5);
    draw_text(140, 128, "VIDEO ......... OK", 7);

    /* Hold the finished splash. The waits are guest-time-anchored: the
       four 5-tick pauses between POST lines plus this hold total 55
       BDA ticks ≈ 3 guest seconds at 18.2 Hz - what a real 8086 would
       show. Under calcite one BDA tick of polling ≈ 10K CSS ticks
       (262,140 cycles at ~26 cycles per poll instruction), so the 55
       ticks come to ~570K CSS ticks - around a second of wall time on
       a fast host, longer on slower ones. */
    wait_ticks(35);

    set_mode_text();
}
