@echo off
SETLOCAL EnableDelayedExpansion

echo ===================================================
echo 🚀 Bento AI Assistant: Expo Migration Script
echo ===================================================
echo.

:: Step 1: Create Expo Project
echo [Step 1/3] Creating new Expo project...
if exist bento-mobile (
    echo Cleaning up existing 'bento-mobile' folder...
    rmdir /s /q bento-mobile
)

:: We remove --no-install to ensure 'expo' package is installed before Step 3
call npx create-expo-app@latest bento-mobile --template blank-typescript --yes
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Error: Failed to create Expo app.
    pause
    exit /b %ERRORLEVEL%
)
cd bento-mobile

:: Step 2: Move Files
echo [Step 2/3] Moving Shared Logic and Native Preview...
mkdir utils 2>nul

echo Copying transactionUtils.ts...
copy "..\src\utils\transactionUtils.ts" "utils\transactionUtils.ts" /Y

echo Copying App.native.tsx as App.tsx...
copy "..\src\App.native.tsx" "App.tsx" /Y

:: Step 3: Install Dependencies
echo [Step 3/3] Installing Native Dependencies...
:: Now that 'expo' is installed from Step 1, this will work correctly
call npx expo install expo-blur lucide-react-native @react-native-async-storage/async-storage
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Error: Failed to install dependencies.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ===================================================
echo ✅ Migration Preview Complete!
echo ===================================================
echo.
echo Your mobile app project is ready in the 'bento-mobile' folder.
echo To start the app, run:
echo    cd bento-mobile
echo    npx expo start
echo.
echo Then use Expo Go app on your phone to scan the QR Code.
echo ===================================================
pause
