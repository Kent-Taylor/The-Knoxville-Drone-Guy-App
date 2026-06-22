# TestFlight Setup

This app is configured for an internal TestFlight smoke test through EAS Build.

## Current App Identity

- App name: The Knoxville Drone Guy
- Bundle ID: `com.theknoxvilledroneguy.app`
- First target: internal TestFlight only

## One-Time Setup

1. Sign in to Expo:

   ```sh
   npm run eas:login
   ```

2. Link this repo to an EAS project:

   ```sh
   npm run eas:init
   ```

   Let EAS manage Apple signing credentials unless there is a specific reason not to.

3. Push local build-time environment variables to EAS production:

   ```sh
   npm run eas:env:push:production
   ```

   This uses `.env.local`, which is intentionally not committed to Git.

4. In App Store Connect, create the app record:

   - Name: The Knoxville Drone Guy
   - Bundle ID: `com.theknoxvilledroneguy.app`
   - Platform: iOS

## Build And Submit

Build only:

```sh
npm run testflight:build
```

Submit the latest successful iOS build:

```sh
npm run testflight:submit
```

Build and auto-submit in one command:

```sh
npm run testflight
```

## Internal Smoke Test Checklist

- Email/password sign-in works.
- Admin account shows Admin.
- Project creation works.
- Client project requests save to Firebase.
- Chat sends and receives messages.
- Media upload and viewer work.
- Push notification permission prompt works.
- Apple Sign-In works, or is temporarily hidden if Apple configuration blocks it.
- Google Sign-In is tested in the native build, not Expo Go.
