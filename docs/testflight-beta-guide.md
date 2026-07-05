# TestFlight beta testing — KazeTune

TestFlight is Apple's beta system. You upload a build, invite people, they
install the **TestFlight** app and get KazeTune. Two kinds of testers:

- **Internal testers** (up to 100): people on your App Store Connect team.
  Get builds **instantly, no Apple review**. Perfect for you + your brother.
- **External testers** (up to 10,000): invited by email or a **public
  link**. The *first* build needs a quick **Beta App Review** (~1 day);
  after that, updates are instant. Use this for friends.

Builds expire after **90 days**.

---

## Prerequisites (do these with your brother, once)

1. **Get on his Apple Developer account.** In App Store Connect →
   **Users and Access → (+) Invite** → your Apple ID → role **App Manager**
   (or Admin). Accept the email invite.
2. **Create the app record.** App Store Connect → **Apps → (+) → New App**:
   - Platform: iOS
   - Name: **KazeTune**
   - Primary language: English
   - Bundle ID: **app.kazetune** (pick it from the dropdown; if it's not
     there yet, the first EAS build in step below registers it, then come
     back and create the app)
   - SKU: anything, e.g. `kazetune-001`
3. **Free Expo account** for building — sign up at expo.dev if you don't
   have one.

---

## Build + upload to TestFlight (do this WITH Claude)

From `mobile/` — Claude can run these; the Apple login prompt is yours:

```bash
npm install -g eas-cli
eas login                      # your Expo account
eas init                       # links the project (writes projectId)
eas build -p ios --profile production
```
- During the build, EAS asks to **log into the Apple Developer account**
  (use your brother's, or yours if you're an Admin on his team) and offers
  to **create the signing credentials for you** — say **yes**, it manages
  everything.
- The build runs in Apple/EAS's cloud (~15–20 min). No Xcode needed.

Then upload it to TestFlight:
```bash
eas submit -p ios --latest
```
This pushes the finished build to App Store Connect → TestFlight.

---

## Invite testers

In **App Store Connect → your app → TestFlight**:

1. First time, fill **Test Information**: what to test, feedback email,
   and answer the **Export Compliance** question (standard HTTPS only →
   usually "No" to the encryption question).
2. **Your brother (internal):** make sure he's in **Users and Access**,
   then add him under **Internal Testing**. He gets it instantly.
3. **Friends (external):** create an **External** group → either add their
   emails or turn on the **Public Link** and share it. (First build waits
   on the ~1-day Beta App Review.)

## What testers do
1. Install **TestFlight** from the App Store.
2. Tap your invite/link → **Install** KazeTune.
3. **Important:** they need **Spotify Premium** AND their Spotify account
   must be on your app's **User Management allowlist** (Spotify Dashboard,
   25-user cap) until Extended Quota is approved — otherwise sign-in fails.

## Shipping updates to testers
Just rebuild + resubmit; internal testers get it instantly, external after
the first review:
```bash
eas build -p ios --profile production && eas submit -p ios --latest
```
