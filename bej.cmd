@echo off
setlocal
cd /d "%~dp0"
set "BEJ_NODE=node"
where node >nul 2>nul
if errorlevel 1 set "BEJ_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
set "BEJ_ACTION=%~1"
if "%BEJ_ACTION%"=="" set "BEJ_ACTION=demo"
if /i "%BEJ_ACTION%"=="demo" goto demo
if /i "%BEJ_ACTION%"=="register" goto register
if /i "%BEJ_ACTION%"=="start" goto start
if /i "%BEJ_ACTION%"=="check" goto check
if /i "%BEJ_ACTION%"=="test" goto test
if /i "%BEJ_ACTION%"=="live-test" goto live-test
if /i "%BEJ_ACTION%"=="office" goto office
if /i "%BEJ_ACTION%"=="supabase-check" goto supabase-check
if /i "%BEJ_ACTION%"=="supabase-sync-check" goto supabase-sync-check
echo Usage: bej.cmd [demo^|register^|start^|check^|test^|live-test^|office^|supabase-check^|supabase-sync-check]
exit /b 1
:demo
"%BEJ_NODE%" node_modules/tsx/dist/cli.mjs src/demo.ts
exit /b %errorlevel%
:register
"%BEJ_NODE%" node_modules/tsx/dist/cli.mjs --env-file=.env src/register.ts
exit /b %errorlevel%
:start
"%BEJ_NODE%" node_modules/tsx/dist/cli.mjs --env-file=.env src/bot.ts
exit /b %errorlevel%
:check
"%BEJ_NODE%" node_modules/typescript/bin/tsc --noEmit
exit /b %errorlevel%
:test
"%BEJ_NODE%" node_modules/tsx/dist/cli.mjs --test tests/*.test.ts
exit /b %errorlevel%
:live-test
"%BEJ_NODE%" node_modules/tsx/dist/cli.mjs --env-file=.env src/live-test.ts
exit /b %errorlevel%
:office
"%BEJ_NODE%" node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3000
exit /b %errorlevel%
:supabase-check
"%BEJ_NODE%" node_modules/tsx/dist/cli.mjs --env-file=.env src/supabase-check.ts
exit /b %errorlevel%
:supabase-sync-check
"%BEJ_NODE%" node_modules/tsx/dist/cli.mjs --env-file=.env src/supabase-sync-check.ts
exit /b %errorlevel%
