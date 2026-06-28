# Push notifications — status & how to finish remote push

KazeTune uses `expo-notifications`. There are two layers:

## ✅ Local notifications (done, working now)

On-device notifications the app schedules itself — **no Apple Developer
account needed**. Implemented in `mobile/lib/localNotifications.ts`:

- A notification handler shows banners even in the foreground.
- `ensureNotificationPermission()` is requested when a walk starts.
- When a pin fires during a **background walk** (phone pocketed), the
  geofence task calls `notifyPinNearby()` → a "🎵 now playing here"
  banner. See `lib/backgroundGeofencing.ts`.

> Requires a native rebuild to take effect (expo-notifications is a
> native module): `npx expo run:ios` or an EAS build.

## 🔴 Remote push (needs your Apple Developer account)

Alerts delivered when the app is **fully closed** — e.g. "X sent you a
friend request", "X liked your pin". These require **APNs credentials**,
which only exist once you have a **paid Apple Developer account**. Steps
to finish, once enrolled:

1. **Register for a push token** on the device after login:
   ```ts
   import * as Notifications from 'expo-notifications';
   const token = (await Notifications.getExpoPushTokenAsync({
     projectId: '<your eas projectId>',
   })).data; // ExponentPushToken[…]
   ```
   Store it on the user's `profiles` row (add a `push_token text` column).

2. **APNs key in EAS** — `eas credentials` → iOS → set up a Push Key
   (.p8) from the Apple Developer portal. EAS can create/manage it once
   your account is linked.

3. **Send pushes server-side** from an Edge Function (mirror the
   `spotify-refresh` pattern): on a new friend request / like, look up
   the recipient's `push_token` and POST to Expo's push API
   `https://exp.host/--/api/v2/push/send` with `{ to, title, body }`.
   Trigger the function from a Postgres trigger or call it from the RPC.

4. **Handle taps** — add a `Notifications.addNotificationResponseReceived`
   listener to deep-link into the relevant screen.

Everything except steps tied to APNs (1, 4) can be built ahead of time;
2 and 3's delivery only work once the Apple account + APNs key exist.
