; timer-irq.asm — Test PIT timer IRQ delivery
; Programs PIT channel 0 with a short reload (100 decimal),
; installs an INT 08h handler that increments a counter,
; enables interrupts, and loops until counter >= 3.
;
; After 3 IRQs, stores the counter in AX and halts via INT 20h.

org 0x100

start:
    ; Install our INT 08h handler
    ; IVT entry for INT 08h is at 0000:0020 (vector 8 * 4 = 0x20)
    xor ax, ax
    mov es, ax
    mov word [es:0x20], handler   ; offset
    mov word [es:0x22], cs        ; segment

    ; Initialize counter
    mov byte [counter], 0

    ; Program PIT channel 0: mode 2 (rate generator), reload = 100
    ; Control word: channel 0 (bits 7-6 = 00), rw both (bits 5-4 = 11),
    ;              mode 2 (bits 3-1 = 010), binary (bit 0 = 0)
    ; = 0b00110100 = 0x34
    mov al, 0x34
    out 0x43, al

    ; Reload value = 100 (lo byte first, then hi byte)
    mov al, 100         ; lo byte
    out 0x40, al
    mov al, 0           ; hi byte
    out 0x40, al

    ; Enable interrupts
    sti

    ; Unmask IRQ 0 on PIC (clear bit 0 of mask register)
    in al, 0x21         ; read current mask
    and al, 0xFE        ; clear bit 0
    out 0x21, al        ; write back

    ; Wait for 3 timer interrupts
.wait:
    cmp byte [counter], 3
    jb .wait

    ; Done — put counter in AX for visibility in the trace
    mov al, [counter]
    xor ah, ah

    ; Halt
    int 0x20

; Timer interrupt handler
handler:
    inc byte [counter]

    ; Send EOI to PIC
    mov al, 0x20
    out 0x20, al

    iret

counter:
    db 0
