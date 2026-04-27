echo off
rem
rem PC-Lemmings dispatch program
rem

rem goto usage

autodet
if errorlevel 6 goto finish
if errorlevel 5 goto vga
if errorlevel 3 goto ega
if errorlevel 2 goto cga
if errorlevel 0 goto tandy
goto finish

:tandy
echo TANDY version loading
lemtga.com %1 %2 %3
goto finish

:cga
echo CGA version loading
lemcga.com %1 %2 %3
goto finish

:ega
echo EGA version loading
lemvga.com /e %1 %2 %3
goto finish

:vga
echo VGA version loading
lemvga.com /v %1 %2 %3
goto finish

:usage

echo Insert Disk 1 and type 'lemmings'

:finish
