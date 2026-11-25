@echo off
setlocal enabledelayedexpansion
title MUET Academic Credential Verification System (CS-491)
color 0B

echo ===============================================================================
echo   MEHRAN UNIVERSITY OF ENGINEERING AND TECHNOLOGY (MUET), JAMSHORO
echo   Department of Computer Systems Engineering
echo   Course: Blockchain Technologies & Applications (CS-491)
echo   Project: Decentralized Academic Credential Verification System
echo   Candidate: Roll Number 22CS102
echo ===============================================================================
echo.

:: 1. Isolate AppData to workspace to avoid Windows roaming permission locks
set "APPDATA=%~dp0.appdata"
set "LOCALAPPDATA=%~dp0.localappdata"
if not exist "%APPDATA%" mkdir "%APPDATA%"
if not exist "%LOCALAPPDATA%" mkdir "%LOCALAPPDATA%"

:: 2. Verify Node.js prerequisite
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found in your system PATH!
    echo Please install Node.js (v18+) to launch the local blockchain node and frontend.
    pause
    exit /b 1
)

echo [1/4] Starting Local Hardhat Blockchain Node on port 8545 (Chain ID 1337)...
start "MUET Hardhat Blockchain Node" cmd.exe /k "cd /d %~dp0 && set APPDATA=%~dp0.appdata && set LOCALAPPDATA=%~dp0.localappdata && npx.cmd hardhat node"

echo [2/4] Waiting for local blockchain node to initialize...
powershell -Command "for ($i=0; $i -lt 30; $i++) { try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:8545' -Method Post -Body '{\"jsonrpc\":\"2.0\",\"method\":\"eth_blockNumber\",\"params\":[],\"id\":1}' -ContentType 'application/json' -TimeoutSec 2 -UseBasicParsing; if ($r.StatusCode -eq 200) { exit 0 } } catch {}; Start-Sleep -Milliseconds 500 }; exit 1"

if %errorlevel% neq 0 (
    echo [NOTE] Hardhat node initialization taking longer; proceeding with deployment...
) else (
    echo    -> Local blockchain node is online and ready.
)

echo.
echo [3/4] Deploying Smart Contracts Suite & Registering Accredited Institutions...
cd /d "%~dp0"
call npx.cmd hardhat run scripts/deploy.js --network localhost
if %errorlevel% neq 0 (
    echo [ERROR] Contract deployment failed. Check the Hardhat node window for details.
    pause
    exit /b 1
)

echo.
echo [4/4] Starting React / Vite Frontend Web Portal...
start "MUET Credential Web Portal" cmd.exe /k "cd /d %~dp0frontend && npm.cmd run dev"

echo.
echo Waiting for frontend server to become accessible on port 3000...
powershell -Command "for ($i=0; $i -lt 25; $i++) { try { $r = Invoke-WebRequest -Uri 'http://localhost:3000' -TimeoutSec 2 -UseBasicParsing; if ($r.StatusCode -eq 200) { exit 0 } } catch {}; Start-Sleep -Milliseconds 500 }; exit 0"

echo.
echo ===============================================================================
echo   ACADEMIC CREDENTIAL VERIFICATION SYSTEM IS ONLINE!
echo ===============================================================================
echo   Local Blockchain Node : http://127.0.0.1:8545 (Chain ID 1337)
echo   Web Portal Interface  : http://localhost:3000
echo   Candidate Profile     : Roll Number 22CS102 (B.E. Computer Systems)
echo ===============================================================================
echo.
echo Opening browser to http://localhost:3000 ...
start http://localhost:3000

echo.
echo [INFO] Both services are running in their respective background console windows.
echo To stop the system at any time, simply close the opened command prompt windows.
echo.
pause
