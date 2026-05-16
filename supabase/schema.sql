-- ====================================================================
-- kazetune schema
-- ====================================================================
-- Apply this in the Supabase SQL Editor (Dashboard > SQL Editor > New).
-- Idempotent: safe to re-run; everything uses IF NOT EXISTS / OR REPLACE.
--
-- Tables
--   profiles        - app-level user data, joined 1:1 to auth.users
--   pins            - a song clip pinned to a geographic point
--   playlists       - a named, ordered collection of pins
--   playlist_pins   - join table; which pins are in which playlist
--   friendships     - directed friend graph (status: pending/accepted)
--
-- Auth model
--   Supabase manages auth.users. We mirror each row into `profiles`
--   automatically via a trigger so we have a stable foreign-key target.
-- ====================================================================


-- ---------- Tables --------------------------------------------------

CREATE TABLE IF NOT EXISTS profiles (
    id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    spotify_id   TEXT,
    display_name TEXT,
    email        TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS pins (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    location         GEOGRAPHY(Point, 4326) NOT NULL,
    place_name       TEXT,
    spotify_track_id TEXT NOT NULL,
    track_name       TEXT NOT NULL,
    artist_name      TEXT NOT NULL,
    start_seconds    INTEGER NOT NULL DEFAULT 0,
    duration_seconds INTEGER NOT NULL,
    is_public        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (duration_seconds >= 20),
    CHECK (start_seconds >= 0)
);

CREATE INDEX IF NOT EXISTS idx_pins_location ON pins USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_pins_user     ON pins (user_id);


CREATE TABLE IF NOT EXISTS playlists (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    description TEXT,
    is_public   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS playlist_pins (
    playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    pin_id      UUID NOT NULL REFERENCES pins(id)      ON DELETE CASCADE,
    position    INTEGER NOT NULL,
    PRIMARY KEY (playlist_id, pin_id)
);


CREATE TABLE IF NOT EXISTS friendships (
    user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    friend_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status     TEXT NOT NULL CHECK (status IN ('pending', 'accepted')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, friend_id),
    CHECK (user_id <> friend_id)
);


-- ---------- Auto-create profile on signup ---------------------------
-- Supabase OAuth puts provider data in auth.users.raw_user_meta_data.
-- For Spotify, we get `provider_id` (Spotify user ID), `name`, and
-- `email`. This trigger mirrors a new auth user into profiles.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, spotify_id, display_name, email)
    VALUES (
        NEW.id,
        NEW.raw_user_meta_data->>'provider_id',
        COALESCE(
            NEW.raw_user_meta_data->>'name',
            NEW.raw_user_meta_data->>'full_name',
            NEW.email
        ),
        NEW.email
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ---------- Row Level Security --------------------------------------
-- Without RLS, anyone with the anon API key can read/write every row.
-- These policies enforce ownership and public/private visibility.

ALTER TABLE profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE pins          ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlists     ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlist_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships   ENABLE ROW LEVEL SECURITY;


-- profiles: any authenticated user can see all profiles (needed for
-- friend search). You can only update your own.
DROP POLICY IF EXISTS "profiles_read"   ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_read"   ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE TO authenticated
    USING (auth.uid() = id) WITH CHECK (auth.uid() = id);


-- pins: read your own + anything marked public; write only your own.
DROP POLICY IF EXISTS "pins_read"   ON pins;
DROP POLICY IF EXISTS "pins_insert" ON pins;
DROP POLICY IF EXISTS "pins_update" ON pins;
DROP POLICY IF EXISTS "pins_delete" ON pins;
CREATE POLICY "pins_read"   ON pins FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR is_public);
CREATE POLICY "pins_insert" ON pins FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());
CREATE POLICY "pins_update" ON pins FOR UPDATE TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "pins_delete" ON pins FOR DELETE TO authenticated
    USING (user_id = auth.uid());


-- playlists: same shape as pins.
DROP POLICY IF EXISTS "playlists_read"   ON playlists;
DROP POLICY IF EXISTS "playlists_insert" ON playlists;
DROP POLICY IF EXISTS "playlists_update" ON playlists;
DROP POLICY IF EXISTS "playlists_delete" ON playlists;
CREATE POLICY "playlists_read"   ON playlists FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR is_public);
CREATE POLICY "playlists_insert" ON playlists FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());
CREATE POLICY "playlists_update" ON playlists FOR UPDATE TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "playlists_delete" ON playlists FOR DELETE TO authenticated
    USING (user_id = auth.uid());


-- playlist_pins: read if you can see the parent playlist; write only
-- if you own the parent playlist.
DROP POLICY IF EXISTS "playlist_pins_read"  ON playlist_pins;
DROP POLICY IF EXISTS "playlist_pins_write" ON playlist_pins;
CREATE POLICY "playlist_pins_read"  ON playlist_pins FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM playlists p
        WHERE p.id = playlist_pins.playlist_id
          AND (p.user_id = auth.uid() OR p.is_public)
    ));
CREATE POLICY "playlist_pins_write" ON playlist_pins FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM playlists p
        WHERE p.id = playlist_pins.playlist_id AND p.user_id = auth.uid()
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM playlists p
        WHERE p.id = playlist_pins.playlist_id AND p.user_id = auth.uid()
    ));


-- friendships: visible/editable by either party.
DROP POLICY IF EXISTS "friendships_read"   ON friendships;
DROP POLICY IF EXISTS "friendships_insert" ON friendships;
DROP POLICY IF EXISTS "friendships_update" ON friendships;
DROP POLICY IF EXISTS "friendships_delete" ON friendships;
CREATE POLICY "friendships_read"   ON friendships FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR friend_id = auth.uid());
CREATE POLICY "friendships_insert" ON friendships FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());
CREATE POLICY "friendships_update" ON friendships FOR UPDATE TO authenticated
    USING (user_id = auth.uid() OR friend_id = auth.uid());
CREATE POLICY "friendships_delete" ON friendships FOR DELETE TO authenticated
    USING (user_id = auth.uid() OR friend_id = auth.uid());
