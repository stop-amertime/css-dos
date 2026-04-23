; cga6_stripes.asm — CGA mode 0x06 (640x200x2) smoke test
;
; Sets video mode 0x06 and paints four horizontal bands using the only
; two colours mode 6 has: black and foreground (usually white). We
; alternate all-black rows and all-foreground rows every 25 scanlines
; so a correct decoder produces eight horizontal stripes:
;
;   rows   0.. 24 black
;   rows  25.. 49 white
;   rows  50.. 74 black
;   rows  75.. 99 white
;   rows 100..124 black
;   rows 125..149 white
;   rows 150..174 black
;   rows 175..199 white
;
; Framebuffer layout at 0xB8000:
;   B800:0000  even scanlines, 80 bytes each (640 px / 8 px per byte)
;   B800:2000  odd  scanlines
;   byte layout: bit 7 = leftmost pixel, bit 0 = rightmost
;
; Build:
;   nasm -f bin -o tests/cga6_stripes.com tests/cga6_stripes.asm

[bits 16]
[cpu 8086]
[org 0x100]

start:
    mov ax, 0x0006         ; set CGA mode 0x06
    int 0x10

    mov ax, 0xB800
    mov es, ax

    xor si, si             ; SI = row counter 0..199
.row_loop:
    ; Pick fill byte: 0x00 or 0xFF based on (row / 25) parity.
    mov ax, si
    xor dx, dx
    mov bx, 25
    div bx                 ; AX = row / 25
    test al, 1
    jz .fill_black
    mov al, 0xFF
    jmp short .have_fill
.fill_black:
    xor al, al
.have_fill:
    mov ah, al             ; replicate to full word so STOSW paints 16 px

    ; DI = (row >> 1) * 80 + (row & 1) * 0x2000
    mov bx, si
    shr bx, 1              ; BX = row >> 1 (plane-relative scanline)
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

    mov cx, 40             ; 40 words = 80 bytes = one 640-px scanline
    cld
    rep stosw

    inc si
    cmp si, 200
    jb .row_loop

.halt:
    hlt
    jmp .halt
