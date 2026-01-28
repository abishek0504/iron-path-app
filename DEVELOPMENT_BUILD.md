# Development Build Setup Guide

This guide explains how to create a development build for IronPath, which is required for native modules like `react-native-reanimated` and `@shopify/react-native-skia`.

## Prerequisites

### For iOS:
- macOS with Xcode installed
- Xcode Command Line Tools: `xcode-select --install`
- CocoaPods: `sudo gem install cocoapods`
- iOS Simulator (comes with Xcode)

### For Android:
- Android Studio installed
- Android SDK configured
- Java Development Kit (JDK)

## Option 1: Local Development Build (Recommended)

### iOS Development Build

1. **Generate native iOS project** (if not already done):
   ```bash
   npx expo prebuild --platform ios
   ```

2. **Install iOS dependencies**:
   ```bash
   cd ios
   pod install
   cd ..
   ```

3. **Build and run on simulator**:
   ```bash
   npm run ios:dev
   ```
   
   Or manually:
   ```bash
   npx expo run:ios
   ```

4. **Build and run on specific device**:
   ```bash
   npx expo run:ios --device "iPhone 17 Pro Max"
   ```

### Android Development Build

1. **Generate native Android project**:
   ```bash
   npx expo prebuild --platform android
   ```

2. **Build and run**:
   ```bash
   npm run android:dev
   ```
   
   Or manually:
   ```bash
   npx expo run:android
   ```

## Option 2: EAS Build (Cloud Build)

EAS Build creates development builds in the cloud. Useful if you don't want to set up local build tools.

### Setup EAS Build

1. **Install EAS CLI**:
   ```bash
   npm install -g eas-cli
   ```

2. **Login to Expo**:
   ```bash
   eas login
   ```

3. **Configure EAS** (creates `eas.json`):
   ```bash
   eas build:configure
   ```

4. **Create development build**:
   ```bash
   eas build --profile development --platform ios
   ```

5. **Install on device**:
   - Download the build from the EAS dashboard
   - Install via TestFlight (iOS) or direct download (Android)

## Running the Development Server

After building, start the Metro bundler:

```bash
npm start
```

Or with specific options:
```bash
npx expo start --dev-client
```

The `--dev-client` flag tells Expo to connect to your development build instead of Expo Go.

## Troubleshooting

### iOS Issues

**"No .xcworkspace found"**
- Run `npx expo prebuild --platform ios` first

**Pod install fails**
- Update CocoaPods: `sudo gem install cocoapods`
- Clean and retry: `cd ios && rm -rf Pods Podfile.lock && pod install`

**Build errors**
- Clean build folder: In Xcode, Product → Clean Build Folder (Shift+Cmd+K)
- Reset Metro cache: `npx expo start --clear`

### Android Issues

**Gradle sync fails**
- Ensure Android SDK is properly configured
- Check `android/local.properties` has correct SDK path

**Build fails**
- Clean: `cd android && ./gradlew clean`
- Rebuild: `npx expo run:android`

## Development vs Production

- **Development Build**: Includes debugging tools, hot reload, connects to Metro
- **Production Build**: Optimized, no debugging, standalone app

For development, always use development builds. For App Store/Play Store, create production builds.

## Next Steps

Once your development build is running:
1. Start the Metro bundler: `npm start`
2. The app will automatically connect to Metro
3. You can now use all native modules (Reanimated, Skia, etc.)
