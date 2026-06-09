# KazeTune 🍃🎵

> Go where the wind takes you.

KazeTune pins songs to places. Drop a Spotify track at a spot that means
something, choose the exact part of the song to play there, and build
playlists you can **walk** — as you move through the world, the clip tied to
each location starts playing. Make pins public to share them with friends and
see what songs live where.

The name is *kaze* (風, “wind”) + *tune*.

---

## Features

- 🗺️ **Map of song pins** — long-press the map to drop a pin; tap one to play it.
- 🎚️ **Instagram-style clip picker** — drag a window over the song to pick the
  exact part that plays, and hear it as you scrub.
- ▶️ **Full-track playback** through your own Spotify (Premium).
- 📂 **Playlists** + “Walk this playlist” with an optimized walking route.
- 🚶 **Background geofencing** — clips trigger automatically as you reach each pin,
  even with the phone locked.
- 👥 **Friends** — search, requests, and QR codes — plus a friend-activity feed.
- 🧑 **Profiles** with usernames and avatars, dark mode, and onboarding.

---

## Tech stack

- **App:** Expo SDK 55 · React Native 0.83 · React 19 · TypeScript · expo-router
- **Backend:** Supabase — Postgres + PostGIS (geo queries), Auth, Storage
- **Music:** Spotify Web API (search + Connect playback)
- **Native:** react-native-maps · expo-location · expo-task-manager · expo-audio

No custom server — the app talks to Supabase directly, and all data rules live
in Postgres Row-Level Security policies and RPCs.

---

## Project layout

```
mobile/                 Expo app
  app/                  screens (expo-router file-based routes)
  components/           shared UI (maps, clip slider, avatars, …)
  lib/                  data + integrations (supabase, spotify, playback, geofencing)
supabase/               SQL — schema, RPCs, migrations, storage setup
```

---

## Getting started

### Prerequisites

- Node.js and the Expo CLI (`npx expo`)
- **Xcode** (for iOS) — KazeTune uses native modules, so it runs as a **dev
  build**, not in Expo Go
- A **Supabase** project
- A **Spotify** account (Premium for playback) and a Spotify developer app for OAuth

### 1. Set up the backend (Supabase)

In the Supabase dashboard → **SQL Editor**, run the files in `supabase/` in this
order (everything is idempotent, so re-running is safe):

1. `schema.sql` — tables, RLS policies, the new-user trigger
2. Base RPCs: `create_pin_rpc.sql`, `list_pins_rpc.sql`, `update_pin_rpc.sql`,
   `playlist_rpcs.sql`, `friend_rpcs.sql`, `friend_activity_rpc.sql`
3. `storage_bucket_setup.sql` — image storage buckets + policies
4. Migrations, in order (each file’s header notes its dependencies):
   `preview_url_migration.sql` → `album_image_url_migration.sql` →
   `user_images_migration.sql` → `username_migration.sql` →
   `pin_description_migration.sql`

Then enable Spotify auth: **Authentication → Providers → Spotify**, add your
Spotify app’s Client ID/Secret, and add `kazetune://` as an allowed redirect URL.

### 2. Configure environment variables

Create `mobile/.env.local`:

```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

### 3. Run the app

```bash
cd mobile
npm install
npx expo run:ios --device     # physical iPhone (needed for walk-mode)
# or
npx expo run:ios              # iOS simulator
```

---

## Playback notes

KazeTune plays the **full track from your own Spotify** so it can start at the
exact moment you picked — which means a few things to know:

- **Spotify Premium is required** for playback (the Spotify Connect API won’t
  control free accounts).
- **Open Spotify first.** The app controls your *active* Spotify device rather
  than producing audio itself, so open the Spotify app (or desktop) and play
  something once so it registers as active.
- **Sessions last ~60 minutes.** The Spotify access token currently expires
  after an hour; silent token refresh is on the roadmap.

---

## Status

A work-in-progress personal project. Core flows — pinning, the clip picker,
playlists, walking mode, and the social layer — are built. On the roadmap:
Spotify token refresh, push notifications, pin sharing, account deletion, and
public discovery.
