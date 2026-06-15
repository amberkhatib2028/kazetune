-- ====================================================================
-- pin_visibility_migration.sql
-- ====================================================================
-- Replaces the single is_public boolean on pins with a 3-level
-- visibility:
--   'private'  — only the owner
--   'friends'  — the owner + accepted friends
--   'public'   — anyone (the whole world can pick it up)
--
-- is_public is KEPT and auto-synced (= visibility = 'public') by a
-- trigger, so older code/badges that read is_public still work. The new
-- source of truth is `visibility`.
--
-- Run order: after pin_description_migration.sql. Idempotent.
-- Apply: `npm run db:push`.
-- ====================================================================

ALTER TABLE pins ADD COLUMN IF NOT EXISTS visibility text;

UPDATE pins
SET visibility = CASE WHEN is_public THEN 'public' ELSE 'private' END
WHERE visibility IS NULL;

ALTER TABLE pins ALTER COLUMN visibility SET DEFAULT 'private';
ALTER TABLE pins ALTER COLUMN visibility SET NOT NULL;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'pins_visibility_check'
    ) THEN
        ALTER TABLE pins ADD CONSTRAINT pins_visibility_check
            CHECK (visibility IN ('private', 'friends', 'public'));
    END IF;
END $$;

-- Keep is_public in lockstep with visibility no matter how a row is
-- written (RPC or a direct update from the client).
CREATE OR REPLACE FUNCTION public.sync_pin_is_public()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.is_public := (NEW.visibility = 'public');
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pins_sync_is_public ON pins;
CREATE TRIGGER pins_sync_is_public
    BEFORE INSERT OR UPDATE ON pins
    FOR EACH ROW EXECUTE FUNCTION public.sync_pin_is_public();


-- ---- RLS: read access follows visibility ---------------------------
DROP POLICY IF EXISTS "pins_read" ON pins;
CREATE POLICY "pins_read" ON pins FOR SELECT TO authenticated
USING (
    user_id = auth.uid()
    OR visibility = 'public'
    OR (
        visibility = 'friends'
        AND EXISTS (
            SELECT 1 FROM friendships f
            WHERE f.status = 'accepted'
              AND (
                (f.user_id = pins.user_id AND f.friend_id = auth.uid())
                OR (f.user_id = auth.uid() AND f.friend_id = pins.user_id)
              )
        )
    )
);


-- ====================================================================
-- create_pin (p_visibility replaces p_is_public)
-- ====================================================================
-- Drop the prior boolean-param version AND any existing text-param
-- version, so this migration is safe to re-run (db:push runs all files
-- every time, and pin_description recreates the boolean one).
DROP FUNCTION IF EXISTS public.create_pin(
    double precision, double precision, text, text, text, text,
    integer, integer, boolean, text, text, text, text
);
DROP FUNCTION IF EXISTS public.create_pin(
    double precision, double precision, text, text, text, text,
    integer, integer, text, text, text, text, text
);

CREATE FUNCTION public.create_pin(
    p_latitude         double precision,
    p_longitude        double precision,
    p_place_name       text,
    p_spotify_track_id text,
    p_track_name       text,
    p_artist_name      text,
    p_start_seconds    integer,
    p_duration_seconds integer,
    p_visibility       text DEFAULT 'private',
    p_preview_url      text DEFAULT NULL,
    p_album_image_url  text DEFAULT NULL,
    p_image_url        text DEFAULT NULL,
    p_description      text DEFAULT NULL
) RETURNS pins
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    new_pin pins;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    IF p_duration_seconds < 20 THEN
        RAISE EXCEPTION 'Clip must be at least 20 seconds.';
    END IF;

    INSERT INTO pins (
        user_id, location, place_name, spotify_track_id, track_name,
        artist_name, start_seconds, duration_seconds, visibility,
        preview_url, album_image_url, image_url, description
    ) VALUES (
        auth.uid(),
        ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography,
        NULLIF(p_place_name, ''),
        p_spotify_track_id,
        p_track_name,
        p_artist_name,
        p_start_seconds,
        p_duration_seconds,
        COALESCE(NULLIF(p_visibility, ''), 'private'),
        NULLIF(p_preview_url, ''),
        NULLIF(p_album_image_url, ''),
        NULLIF(p_image_url, ''),
        NULLIF(p_description, '')
    )
    RETURNING * INTO new_pin;

    RETURN new_pin;
END;
$$;


-- ====================================================================
-- update_pin (p_visibility replaces p_is_public)
-- ====================================================================
DROP FUNCTION IF EXISTS public.update_pin(
    uuid, double precision, double precision, text, integer, integer,
    boolean, text, text
);
DROP FUNCTION IF EXISTS public.update_pin(
    uuid, double precision, double precision, text, integer, integer,
    text, text, text
);

CREATE FUNCTION public.update_pin(
    p_pin_id           uuid,
    p_latitude         double precision,
    p_longitude        double precision,
    p_place_name       text,
    p_start_seconds    integer,
    p_duration_seconds integer,
    p_visibility       text,
    p_image_url        text DEFAULT NULL,
    p_description      text DEFAULT NULL
) RETURNS pins
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    updated_pin pins;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    IF p_duration_seconds < 20 THEN
        RAISE EXCEPTION 'Clip must be at least 20 seconds.';
    END IF;

    UPDATE pins
    SET
        location         = ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography,
        place_name       = NULLIF(p_place_name, ''),
        start_seconds    = p_start_seconds,
        duration_seconds = p_duration_seconds,
        visibility       = COALESCE(NULLIF(p_visibility, ''), 'private'),
        image_url        = NULLIF(p_image_url, ''),
        description      = NULLIF(p_description, ''),
        updated_at       = NOW()
    WHERE id = p_pin_id
    RETURNING * INTO updated_pin;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pin not found or you do not have permission to edit it.';
    END IF;

    RETURN updated_pin;
END;
$$;


-- ====================================================================
-- list_pins / list_playlist_pins (now also return visibility)
-- ====================================================================
DROP FUNCTION IF EXISTS public.list_pins();

CREATE FUNCTION public.list_pins()
RETURNS TABLE (
    id               uuid,
    user_id          uuid,
    latitude         double precision,
    longitude        double precision,
    place_name       text,
    spotify_track_id text,
    track_name       text,
    artist_name      text,
    start_seconds    integer,
    duration_seconds integer,
    is_public        boolean,
    visibility       text,
    is_mine          boolean,
    preview_url      text,
    album_image_url  text,
    image_url        text,
    description      text
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
    SELECT
        p.id, p.user_id,
        ST_Y(p.location::geometry) AS latitude,
        ST_X(p.location::geometry) AS longitude,
        p.place_name, p.spotify_track_id, p.track_name, p.artist_name,
        p.start_seconds, p.duration_seconds, p.is_public, p.visibility,
        (p.user_id = auth.uid()) AS is_mine,
        p.preview_url, p.album_image_url, p.image_url, p.description
    FROM pins p
    ORDER BY p.created_at DESC;
$$;

DROP FUNCTION IF EXISTS public.list_playlist_pins(uuid);

CREATE FUNCTION public.list_playlist_pins(p_playlist_id uuid)
RETURNS TABLE (
    id               uuid,
    pos              integer,
    latitude         double precision,
    longitude        double precision,
    place_name       text,
    spotify_track_id text,
    track_name       text,
    artist_name      text,
    start_seconds    integer,
    duration_seconds integer,
    is_public        boolean,
    visibility       text,
    is_mine          boolean,
    preview_url      text,
    album_image_url  text,
    image_url        text,
    description      text
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
    SELECT
        p.id, pp.position AS pos,
        ST_Y(p.location::geometry) AS latitude,
        ST_X(p.location::geometry) AS longitude,
        p.place_name, p.spotify_track_id, p.track_name, p.artist_name,
        p.start_seconds, p.duration_seconds, p.is_public, p.visibility,
        (p.user_id = auth.uid()) AS is_mine,
        p.preview_url, p.album_image_url, p.image_url, p.description
    FROM playlist_pins pp
    JOIN pins p ON p.id = pp.pin_id
    WHERE pp.playlist_id = p_playlist_id
    ORDER BY pp.position;
$$;


-- ====================================================================
-- list_friend_activity (friends now see 'friends' + 'public' pins)
-- ====================================================================
DROP FUNCTION IF EXISTS public.list_friend_activity();

CREATE FUNCTION public.list_friend_activity()
RETURNS TABLE (
    kind                  text,
    id                    uuid,
    created_at            timestamptz,
    title                 text,
    subtitle              text,
    place_name            text,
    image_url             text,
    friend_id             uuid,
    friend_display_name   text,
    friend_avatar_url     text
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
    WITH my_friends AS (
        SELECT CASE WHEN f.user_id = auth.uid() THEN f.friend_id ELSE f.user_id END AS other_id
        FROM friendships f
        WHERE f.status = 'accepted'
          AND (f.user_id = auth.uid() OR f.friend_id = auth.uid())
    )
    SELECT
        'pin'::text, p.id, p.created_at, p.track_name, p.artist_name, p.place_name,
        COALESCE(p.image_url, p.album_image_url),
        p.user_id, pr.display_name, pr.avatar_url
    FROM pins p
    JOIN profiles pr ON pr.id = p.user_id
    WHERE p.visibility IN ('friends', 'public')
      AND p.user_id IN (SELECT other_id FROM my_friends)

    UNION ALL

    SELECT
        'playlist'::text, pl.id, pl.created_at, pl.title, pl.description,
        NULL::text, pl.cover_image_url,
        pl.user_id, pr.display_name, pr.avatar_url
    FROM playlists pl
    JOIN profiles pr ON pr.id = pl.user_id
    WHERE pl.is_public = true
      AND pl.user_id IN (SELECT other_id FROM my_friends)

    ORDER BY created_at DESC
    LIMIT 50;
$$;
