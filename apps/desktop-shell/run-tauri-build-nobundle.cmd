@echo off
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
set PATH=C:\Users\tiany\.cargo\bin;%PATH%
cd /d %~dp0
npm.cmd run tauri build -- --no-bundle
