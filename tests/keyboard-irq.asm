; keyboard-irq.asm — Test keyboard IRQ → BDA buffer → INT 16h path
; Unmasked IRQ 1, waits for a key via INT 16h AH=00h, stores AX, halts.
; When run with --key-events=50:0x1E61,100:0 the expected result is AX=0x1E61.

org 0x100

start:
    ; Enable interrupts
    sti

    ; Unmask IRQ 1 on PIC (clear bit 1 of mask register)
    in al, 0x21         ; read current mask
    and al, 0xFD        ; clear bit 1 (IRQ 1)
    out 0x21, al        ; write back

    ; Read a key via INT 16h AH=00h (blocking)
    mov ah, 0x00
    int 0x16

    ; AX now has (scancode<<8)|ascii from INT 16h
    ; Store in memory for visibility
    mov [result], ax

    ; Halt
    int 0x20

result:
    dw 0
