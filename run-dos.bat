@echo off
REM run-dos.bat — Generate CSS for a .COM program and boot it via DOS
REM Usage: run-dos.bat program.com [ticks]

setlocal

set PROGRAM=%1
set TICKS=%2
if "%PROGRAM%"=="" (
    echo Usage: run-dos.bat program.com [ticks]
    echo   ticks defaults to 500000
    exit /b 1
)
if "%TICKS%"=="" set TICKS=500000

set CALCITE=..\calcite\target\release\calcite-cli.exe
set CSS=%~n1-dos.css

echo Generating CSS (DOS + %PROGRAM%)...
node --max-old-space-size=8192 transpiler\generate-dos.mjs %PROGRAM% -o %CSS%
if errorlevel 1 (
    echo FAILED: CSS generation
    exit /b 1
)

title CSS-DOS: %PROGRAM%
cls
%CALCITE% --input %CSS% --ticks %TICKS% --halt 0x0504 --screen 0xB8000 80x25 --screen-interval 500
