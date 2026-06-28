# EAS Build → TestFlight setup

The build config (`mobile/eas.json`) is ready. These are the steps to run
**once your Apple Developer account is active**. Run everything from
`mobile/`.

## One-time setup

1. **Install + log in to EAS** (uses your free Expo account):
   ```bash
   npm install -g eas-cli
   eas login
   ```

2. **Link the project** — this writes `extra.eas.projectId` into app.json
   and ties the project to your Expo account:
   ```bash
   eas init
   ```

3. **Add Spotify env vars to EAS** so cloud builds have them (they live in
   `.env.local` locally, which isn't uploaded):
   ```bash
   eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value "<your url>"
   eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<your anon key>"
   ```
   (Set them for the build profiles you'll use — preview/production.)

## Build profiles (already configured in eas.json)

- **development** — dev client for the iOS Simulator (`--profile development`)
- **preview** — internal distribution, real device, no Apple review
  (great for getting it on your own phone)
- **production** — App Store build, auto-increments the build number

## Get it on your phone (TestFlight)

```bash
eas build --platform ios --profile production
```
EAS will prompt to create the iOS credentials (distribution certificate +
provisioning profile) for you — say yes; it manages them automatically.

Then submit the finished build to TestFlight / App Store Connect:
```bash
eas submit --platform ios --profile production
```
You'll need an **app record in App Store Connect** first (name "KazeTune",
bundle ID `app.kazetune`) and an **app-specific password** or App Store
Connect API key — `eas submit` walks you through it.

## Notes

- Bundle ID is already set to `app.kazetune` (iOS + Android).
- Version is `1.0.0` in app.json; `appVersionSource: remote` +
  `autoIncrement` means EAS manages the build number for production.
- KazeTune needs a development/production build (not Expo Go) because of
  native modules (maps, geofencing) — that's exactly what these profiles
  produce.
