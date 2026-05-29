@echo off
setlocal

set "ROOT=%~dp0"
set "CORE_DIR=%ROOT%pulsecast-core"
set "UI_DIR=%ROOT%pulsecast-ui"

echo PulseCast development setup
echo ===========================

where cargo >nul 2>nul
if errorlevel 1 (
  echo [error] Rust/Cargo was not found in PATH.
  echo Install Rust from https://rustup.rs/ and run this script again.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [error] Node.js/npm was not found in PATH.
  echo Install Node.js from https://nodejs.org/ and run this script again.
  pause
  exit /b 1
)

if not exist "%CORE_DIR%\Cargo.toml" (
  echo [error] Backend project not found at "%CORE_DIR%".
  pause
  exit /b 1
)

if not exist "%UI_DIR%\package.json" (
  echo [error] Frontend project not found at "%UI_DIR%".
  pause
  exit /b 1
)

echo Preparing frontend dependencies...
if not exist "%UI_DIR%\node_modules" (
  echo Installing frontend packages. This can take a minute...
  cd /d "%UI_DIR%" || exit /b 1
  call npm install
  if errorlevel 1 (
    echo [error] Frontend dependency installation failed.
    pause
    exit /b 1
  )
) else (
  echo Frontend dependencies already installed.
)

echo.
echo Starting backend simulation core in this terminal...
pushd "%CORE_DIR%" || exit /b 1
start "PulseCast Backend" /b cmd /c "cargo run"
popd

echo Starting frontend dev server in this terminal...
echo Backend WebSocket: ws://127.0.0.1:9001/ws
echo Frontend URL will be shown below, usually http://localhost:5173/
echo.
cd /d "%UI_DIR%" || exit /b 1
call npm run dev
