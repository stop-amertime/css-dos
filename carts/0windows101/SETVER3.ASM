; SETVER3.COM - tiny SETVER-style TSR for the windows101 cart.
;
; Windows 1.01 boots fine on MS-DOS 4.00 but refuses to launch
; applications: its task loader gates on the INT 21h AH=30h version
; and only accepts DOS 2.x/3.x. The DOS internals it relies on work
; fine on 4.00 (the MS-DOS Executive itself runs) - the check is
; purely a version-number gate, verified 2026-07-13 in DOSBox-X by
; flipping only the reported version (3.30 launches, 4.00 doesn't).
;
; This TSR hooks INT 21h and answers AH=30h with 3.30 (AL=3 AH=1Eh,
; BX=CX=0), chaining everything else to the real handler. Run it in
; AUTOEXEC.BAT before WIN.
;
; Build: nasm -f bin SETVER3.ASM -o SETVER3.COM

        org 0x100

start:
        ; fetch current INT 21h vector
        mov     ax, 0x3521
        int     0x21                    ; ES:BX = old handler
        mov     [old21], bx
        mov     [old21+2], es

        ; install our hook
        mov     dx, hook
        mov     ax, 0x2521
        int     0x21

        ; terminate and stay resident (paragraphs incl. PSP)
        mov     dx, (resident_end - start + 0x100 + 15) >> 4
        mov     ax, 0x3100
        int     0x21

hook:
        cmp     ah, 0x30
        jne     .chain
        mov     ax, 0x1E03              ; AL=3 AH=30 -> DOS 3.30
        xor     bx, bx                  ; OEM 0, serial 0
        xor     cx, cx
        iret
.chain:
        jmp     far [cs:old21]

old21:  dd      0

resident_end:
