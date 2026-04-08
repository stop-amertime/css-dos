; fib.asm — Fibonacci sequence via DOS INT 21h
; Assembles to a .COM file (org 0x100)
; Prints: Fibonacci: 0 1 1 2 3 5 8 13 21 34 55 89 144

org 0x100

start:
    ; Print header
    mov si, header
    call print_string

    ; Initialize: prev=0, curr=1, count=13
    xor bx, bx          ; BX = prev = 0
    mov cx, 1            ; CX = curr = 1
    mov byte [count], 13

    ; Print first number (0)
    mov ax, bx
    call print_number
    call print_space

.loop:
    ; Print current number
    mov ax, cx
    call print_number
    call print_space

    ; Compute next = prev + curr
    mov ax, bx
    add ax, cx
    ; Shift: prev = curr, curr = next
    mov bx, cx
    mov cx, ax

    dec byte [count]
    jnz .loop

    ; Print newline and exit
    mov dl, 10
    mov ah, 02h
    int 21h

    mov ah, 4Ch
    int 21h

; --- print_number: print AX as unsigned decimal ---
print_number:
    push bx
    push cx
    push dx
    mov cx, 0            ; digit count
    mov bx, 10

.divide:
    xor dx, dx
    div bx               ; AX = AX/10, DX = AX%10
    push dx              ; save digit
    inc cx
    test ax, ax
    jnz .divide

.print_digits:
    pop dx
    add dl, '0'
    mov ah, 02h
    int 21h
    loop .print_digits

    pop dx
    pop cx
    pop bx
    ret

; --- print_space: print a space ---
print_space:
    mov dl, ' '
    mov ah, 02h
    int 21h
    ret

; --- print_string: print null-terminated string at SI ---
print_string:
    lodsb
    test al, al
    jz .done
    mov dl, al
    mov ah, 02h
    int 21h
    jmp print_string
.done:
    ret

; --- data ---
header: db 'Fibonacci: ', 0
count:  db 0
