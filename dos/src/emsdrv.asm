; emsdrv.asm — minimal EMS-presence device driver for CSS-DOS.
;
; DOOM8088 (and many DOS programs) detect EMS by `open("EMMXXXX0", O_RDWR)`.
; That call succeeds iff DOS has a character device named EMMXXXX0
; registered. This driver registers that name so the open succeeds. It
; does NOT implement any actual EMS pages — the program will believe EMS
; is "present" but won't get back any usable expanded memory. For DOOM8088,
; this is enough to clear the initial gate; lump cache reads still come back
; as zeros so visuals will be wrong, but the program enters the rendering
; path instead of aborting.
;
; Loaded via `DEVICE=\EMSDRV.SYS` in CONFIG.SYS (synthesised by the builder
; when the cart manifest's `boot.ems = true`). Build:
;   nasm -f bin -o EMSDRV.SYS emsdrv.asm

[bits 16]
[org 0]

; ============================================================
; Device driver header (18 bytes)
; ============================================================
header:
    dd 0xFFFFFFFF           ; next driver pointer — patched by DOS at load time
    dw 0xC000               ; attributes: bit 15 = character device, bit 14 = IOCTL supported
    dw strategy             ; strategy entry offset
    dw interrupt            ; interrupt entry offset
    db 'EMMXXXX0'           ; 8-byte device name (the magic DOOM8088 looks for)

; ============================================================
; Strategy entry: ES:BX points to the request packet.
; Just save it for the interrupt handler.
; ============================================================
strategy:
    mov [cs:reqptr_off], bx
    mov [cs:reqptr_seg], es
    retf

; ============================================================
; Interrupt entry: process the saved request packet.
; ============================================================
; Request packet layout (header):
;   +0  byte  packet length
;   +1  byte  unit code
;   +2  byte  command code
;   +3  word  status (we set this)
;   +5  ...   command-specific data
;
; We respond success (status = 0x0100) for every command. For INIT (cmd 0)
; we also need to return the end address of the resident driver and the
; number of units (0 for char devices). For OPEN (cmd 0xD) and CLOSE
; (cmd 0xE) — which are what DOS issues during the open() call DOOM
; makes — we just return success.
interrupt:
    push ax
    push bx
    push cx
    push dx
    push si
    push di
    push ds
    push es

    push cs
    pop ds                  ; DS = our code segment

    mov bx, [reqptr_off]
    mov es, [reqptr_seg]    ; ES:BX -> request packet

    ; Status word at offset 3: 0x0100 = done | no error.
    mov word [es:bx + 3], 0x0100

    ; Branch on command code at offset 2.
    mov al, [es:bx + 2]
    cmp al, 0               ; INIT
    je .init
    ; All other commands: just status=success, return.
    jmp .done

.init:
    ; INIT request: caller wants resident-end address (DWORD at offset
    ; +14) and number of units (BYTE at +13). Char devices have 0 units.
    mov byte [es:bx + 13], 0
    ; Resident end = code segment : end_of_driver
    mov word [es:bx + 14], end_of_driver
    mov word [es:bx + 16], cs

.done:
    pop es
    pop ds
    pop di
    pop si
    pop dx
    pop cx
    pop bx
    pop ax
    retf

reqptr_off: dw 0
reqptr_seg: dw 0

end_of_driver:
