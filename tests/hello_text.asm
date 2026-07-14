; hello_text.asm - minimal text-mode smoke test for the web runner.
;
; Prints "HELLO, CSS-DOS!" via INT 10h, AH=0Eh (BIOS teletype), which
; writes directly into the VGA text buffer at 0xB8000 through Gossamer.
; Halts via INT 20h.
;
; Constraints: no 0x0F opcodes, no segment overrides (same as BIOS).
;
; Build the .com:
;   nasm -f bin -o tests/hello_text.com tests/hello_text.asm
; To turn a .com like this into a cabinet, wrap it as a hack-preset cart
; and run it through the builder - see docs/hack-path.md.
; Quick JS-reference sanity check:
;   node conformance/ref-hack.mjs tests/hello_text.com build/gossamer.bin 5000

[bits 16]
[org 0x100]

start:
    mov si, msg
.loop:
    mov al, [si]
    or  al, al                 ; null terminator?
    jz  .done
    mov ah, 0x0E
    int 0x10
    inc si
    jmp short .loop
.done:
    int 0x20

msg: db "HELLO, CSS-DOS!", 13, 10, 0
