; cga5_stripes.asm — CGA mode 0x05 (320x200x4 mono) smoke test
;
; Sets video mode 0x05 and deliberately writes palette-reg bits 4/5
; (bright + palette-1) via port 0x3D9. On real CGA composite hardware
; mode 5 disables the colour-burst signal so those palette bits are
; electrically ignored — the output collapses to four shades of grey.
; Our renderer honours that: decodeCga4(..., { mono: true }) ignores
; bank/intensity and returns black / dark-grey / light-grey / white.
;
; A working decoder should render:
;   rows   0.. 49 black       (colour 0 = bg from palette reg low nibble)
;   rows  50.. 99 dark grey   (colour 1, VGA index 8)
;   rows 100..149 light grey  (colour 2, VGA index 7)
;   rows 150..199 white       (colour 3, VGA index 15)
;
; The smoke value of this cart is that it LOOKS NOTHING like the
; cga4-stripes cart even though it writes the same palette byte. If
; it comes out cyan/magenta/white, mode 5 is being rendered as mode 4.
;
; Framebuffer layout: identical to mode 4 (2 bpp at 0xB8000, even/odd
; scanlines at 0x0000/0x2000, 80 bytes per row).

[bits 16]
[cpu 8086]
[org 0x100]

start:
    mov ax, 0x0005         ; set CGA mode 0x05 (mono)
    int 0x10

    ; Write palette-reg = 0x30 (palette 1 + intensity, bg=black).
    ; In mode 4 this gives bright cyan/magenta/white; in mode 5 it
    ; must be ignored so we can prove the renderer honours monoflag.
    mov dx, 0x3D9
    mov al, 0x30
    out dx, al

    mov ax, 0xB800
    mov es, ax

    xor si, si
.row_loop:
    xor bl, bl
    cmp si, 50
    jb .have_colour
    mov bl, 1
    cmp si, 100
    jb .have_colour
    mov bl, 2
    cmp si, 150
    jb .have_colour
    mov bl, 3
.have_colour:
    mov al, bl
    mov bh, 0x55
    mul bh                 ; AX = c * 0x55 (colour replicated across byte)
    mov ah, al

    mov bx, si
    shr bx, 1
    mov di, bx
    shl di, 1
    shl di, 1
    shl di, 1
    shl di, 1              ; DI = BX*16
    mov cx, bx
    shl cx, 1
    shl cx, 1
    shl cx, 1
    shl cx, 1
    shl cx, 1
    shl cx, 1              ; CX = BX*64
    add di, cx             ; DI = BX*80
    mov bx, si
    and bx, 1
    jz .even_plane
    add di, 0x2000
.even_plane:

    mov cx, 40
    cld
    rep stosw

    inc si
    cmp si, 200
    jb .row_loop

.halt:
    hlt
    jmp .halt
