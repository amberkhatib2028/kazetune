# App Store listing — KazeTune (copy-paste ready)

Everything you paste into **App Store Connect** when creating the app
listing. Fill the few `[bracketed]` spots. Bundle ID: **app.kazetune**.

---

## Basics

- **Name:** KazeTune
- **Subtitle** (max 30 chars): `Pin songs to places`
- **Primary category:** Music
- **Secondary category:** Social Networking
- **Bundle ID:** app.kazetune
- **Support URL:** https://kazetune.app
- **Marketing URL:** https://kazetune.app
- **Privacy Policy URL:** https://kazetune.app/privacy

## Promotional text (max 170 chars — editable anytime without review)

> Pin a song to the exact place it means something, trim it to the perfect
> moment, and let your playlists play themselves as you walk the city.

## Description

> KazeTune turns music into a map of your life.
>
> Pin a song to the exact place it belongs — the café where you first heard
> it, the bridge you crossed on repeat — trim it to the precise moment that
> matters, and add a note about why it's yours.
>
> Then walk your playlists. As you move through a city, each pin plays its
> clip the instant you arrive, turning an ordinary walk into a personal
> soundtrack.
>
> • Pin any song to any place, down to the exact seconds
> • "Walk" your playlists — clips trigger by location as you go
> • Follow friends and discover the songs strangers tied to places near you
> • Choose who sees each pin: just you, friends, or everyone
> • Like and comment on pins; build a shared map of music and memory
>
> KazeTune plays full songs through your own Spotify account and requires
> Spotify Premium. Not affiliated with Spotify.

## Keywords (max 100 chars, comma-separated, no spaces)

`music,map,pin,song,playlist,spotify,location,walk,share,discover,places,soundtrack,friends,memory`

## What's New (version 1.0.0)

> The first release of KazeTune. Pin songs to places, walk your playlists,
> and share your map of music with friends.

---

## Age rating

Answer the questionnaire so it lands at **12+** (social app with
user-generated content + a way to report/block, which we have):

- Unrestricted Web Access: **No**
- User-Generated Content: **Yes** → confirm the app has content
  moderation, reporting, and blocking (it does).
- All violence/sexual/mature/gambling categories: **None**
- Result should be **12+**.

## App Privacy ("nutrition label") — data you collect

For each, purpose = **App Functionality** (not tracking, not ads). Nothing
is used to track users across apps.

| Data type | Collected | Linked to user | Notes |
|---|---|---|---|
| Name | Yes | Yes | Spotify display name |
| Email address | Yes | Yes | From Spotify sign-in |
| Photos | Yes | Yes | Optional pin/playlist/profile pictures |
| Precise Location | Yes | Yes | To trigger pins as you walk (incl. background) |
| User Content (pins, comments) | Yes | Yes | The content you create |
| User ID | Yes | Yes | Account identifier |
| Contacts | No | — | — |
| Usage Data / Analytics | No | — | — |

- **Do you use data to track users?** No.
- **Third parties:** Spotify (auth + playback), Supabase (hosting). Data
  is not sold.

---

## App Review notes (CRITICAL — read this)

KazeTune is **Spotify-Premium-only**, so Apple's reviewer **cannot test it
without a Premium Spotify login.** In the "App Review Information" notes,
provide a working demo account:

> KazeTune requires a Spotify Premium account to sign in and play music.
> Please use this test account:
>   Spotify email: [premium test account email]
>   Password: [password]
> Steps: Tap "Sign in with Spotify" → approve → you'll land on the map.
> To hear playback, open the Spotify app first (the app prompts you with
> "Open Spotify"), then tap Play on any pin.

- **Set up a dedicated Premium test account** for this (don't use your
  personal one). Also add that account to your Spotify app's User
  Management allowlist so it can authenticate in Development Mode, and keep
  it allow-listed until Extended Quota is approved.
- Add the reviewer's note about location: the app uses background location
  to play song clips as you walk — this is the core feature.

---

## Screenshots to capture (6.9" iPhone required, e.g. your 16 Pro Max)

Take these on the device (they must show the app, no device frame needed —
App Store Connect handles sizing). Aim for 3–5:

1. **The map** with colorful pins (turn on "Everyone" filter for a full map)
2. **A pin's detail** — album art, "why here" note, the clip waveform
3. **The clip picker** on New Pin (the Instagram-style slider)
4. **A playlist / "Walk this playlist"** screen
5. **Feed → Discover** or a profile

Tip: use nice-looking pins (real songs, real places) before screenshotting.

---

## Pre-submission checklist

- [ ] DNS pointed so kazetune.app/privacy + /terms load (Apple checks them)
- [ ] Premium demo account created + allow-listed in Spotify
- [ ] Screenshots captured
- [ ] Seed/test data wiped (Casey, Jordan, Test Friend) — ask Claude
- [ ] Production build uploaded via EAS (see eas-build-setup.md)
- [ ] App Privacy answers filled per the table above
- [ ] Age rating completed → 12+
