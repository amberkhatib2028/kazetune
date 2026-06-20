# Spotify Extended Quota Mode — Application Prep

This is a ready-to-paste set of answers for Spotify's Extended Quota Mode
request, submitted from the **Spotify Developer Dashboard → your app →
Settings → "Request extension"**. Extended Quota lifts the 25-user
allowlist and the Development-Mode rate/search limits so KazeTune can
launch publicly.

> Only you can submit this (it's tied to your Spotify Developer account).
> Copy the answers below into the form, attach the demo materials, and
> review the compliance checklist first.

---

## App details

**App name:** KazeTune

**What does your app do? (description)**

> KazeTune lets people pin a specific moment of a song to a real-world
> place. You choose a track, trim it to the exact clip that matters, and
> drop it on the map at a meaningful location. You can group pins into
> playlists and "walk" them — as you physically move near a pin, KazeTune
> plays that song's clip on your Spotify Premium account, turning a walk
> into a personal, location-aware soundtrack. You can also follow friends
> and discover the songs others have tied to places around you.
>
> KazeTune is a companion experience for Spotify Premium listeners; it
> does not replace or replicate Spotify. All playback happens on the
> user's own Spotify account through the Spotify Connect Web API.

**Which Spotify platforms/SDKs do you use?** Spotify Web API (OAuth
Authorization Code flow + Web API endpoints), used from a React Native
(Expo) iOS app.

**How does your app use the Spotify API? (endpoints)**

- **Authorization Code OAuth** — users sign in with Spotify. Scopes:
  `user-read-email`, `user-read-private`, `streaming`,
  `user-modify-playback-state`, `user-read-playback-state`,
  `user-read-currently-playing`.
- **Search** (`/v1/search`) — to find tracks when a user creates a pin.
- **Get Track** (`/v1/tracks/{id}`) — to read track metadata (name,
  artist, album art, duration) for display.
- **Player endpoints** (`/v1/me/player/*`) — to start playback of a
  track seeked to the pin's start offset, pause it when the clip window
  ends, and list/transfer the active Connect device. This is how a pin's
  clip plays on the user's own device.
- **Get Current User's Profile** (`/v1/me`) — to confirm the account is
  Premium (KazeTune is Premium-only) and to populate the user's profile.

**Is your app commercial?** [Choose what's accurate — e.g. "Not currently
monetized; may add a subscription later."]

**How many users do you expect?** [Give a realistic estimate, e.g.
"Initially a few hundred; potentially scaling to several thousand."]

---

## Why we need Extended Quota

> KazeTune is feature-complete and we're preparing an App Store release.
> Development Mode caps us at 25 manually-added users and limits search
> results, which prevents a public launch. We're requesting Extended
> Quota so any Spotify Premium user can sign in and use the app.

---

## Compliance — review BEFORE submitting

Spotify reviews against its **Developer Policy** and **Design
Guidelines**. Confirm each of these is true of KazeTune:

- [x] **Premium-only playback** — the app gates sign-in to Premium
      accounts and controls playback only on the user's own account.
- [x] **No downloading or caching of audio.** KazeTune never downloads,
      records, or stores Spotify audio. Playback is live via Spotify
      Connect.
- [x] **No modifying Spotify content.** Track/artist/album names and
      album art are displayed as provided, unedited.
- [x] **Not a competing service.** KazeTune does not let users stream a
      full music catalog independently of Spotify; it's a
      location/discovery layer on top of the user's Spotify.
- [x] **No synchronization with video / no use as a sync-licensing tool.**
- [x] **Attribution & "Open in Spotify"** — the pin detail screen has an
      "Open in Spotify" action that links back to the track
      (`https://open.spotify.com/track/{id}`), and the track-search
      screens show a "Search powered by Spotify" attribution in Spotify
      green.
- [ ] **Spotify branding/logos** — *recommended polish:* swap the plain
      text attribution / login button for the official Spotify logo per
      the Design Guidelines (correct logo asset, color, and clear space).
      Text attribution is in place now; the official logo is a nice-to-have
      that further strengthens the submission.

### Optional polish before submitting

The functional attribution requirements are met. For an even stronger
submission you can later add the official Spotify logo (instead of plain
text) on the login button and next to track metadata, following Spotify's
Design Guidelines for logo usage.

---

## Demo materials to attach

Spotify usually wants to see the app working:

1. **A short screen-recording (1–3 min)** showing: signing in with
   Spotify, searching for a track, creating a pin, and a clip playing on
   your Spotify Premium device. Show the Spotify branding/attribution.
2. **A few screenshots** of the main screens (map, pin detail, create
   pin, profile).

Record these on your device once the attribution items above are in.

---

## Submission steps

1. Make sure the app's **Redirect URIs** in the Dashboard match what the
   app uses (the Supabase OAuth callback).
2. Complete the attribution follow-ups and record the demo.
3. Open Developer Dashboard → KazeTune → **Request extension**, paste the
   answers above, attach the demo video + screenshots, and submit.
4. Review can take a couple of weeks — submit early.
