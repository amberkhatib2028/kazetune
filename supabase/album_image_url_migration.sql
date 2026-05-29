-- ====================================================================
-- album_image_url_migration.sql
-- ====================================================================
-- Adds Spotify's album_image_url (the album cover thumbnail) to pins so
-- list views can show real artwork instead of a placeholder letter.
-- Re-creates create_pin / list_pins / list_playlist_pins so they round-
-- trip the field.
--
-- Apply: paste into Supabase > SQL Editor > Run. Idempotent — safe to
-- re-run. We DROP FUNCTION first because Postgres won't let
-- CREATE OR REPLACE change a function's return shape.
-- ====================================================================

ALTER TABLE pins
    ADD COLUMN IF NOT EXISTS album_image_url text;


-- ---- create_pin (now accepts album_image_url) ----------------------
-- Drop both the original 9-arg sig and the previous 10-arg preview_url
-- sig if they exist, so we don't end up with two overloads.

DROP FUNCTION IF EXISTS public.create_pin(
    double precision, double precision, text, text, text, text,
    integer, integer, boolean
);
DROP FUNCTION IF EXISTS public.create_pin(
    double precision, double precision, text, text, text, text,
    integer, integer, boolean, text
);
DROP FUNCTION IF EXISTS public.create_pin(
    double precision, double precision, text, text, text, text,
    integer, integer, boolean, text, text
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
    p_is_public        boolean,
    p_preview_url      text DEFAULT NULL,
    p_album_image_url  text DEFAULT NULL
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
        user_id,
        location,
        place_name,
        spotify_track_id,
        track_name,
        artist_name,
        start_seconds,
        duration_seconds,
        is_public,
        preview_url,
        album_image_url
    ) VALUES (
        auth.uid(),
        ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography,
        NULLIF(p_place_name, ''),
        p_spotify_track_id,
        p_track_name,
        p_artist_name,
        p_start_seconds,
        p_duration_seconds,
        p_is_public,
        NULLIF(p_preview_url, ''),
        NULLIF(p_album_image_url, '')
    )
    RETURNING * INTO new_pin;

    RETURN new_pin;
END;
$$;


-- ---- list_pins (now returns album_image_url) -----------------------

DROP FUNCTION IF EXISTS public.list_pins();

CREATE FUNCTION public.list_pins()
RETURNS TABLE (
    id               uuid,
    latitude         double precision,
    longitude        double precision,
    place_name       text,
    spotify_track_id text,
    track_name       text,
    artist_name      text,
    start_seconds    integer,
    duration_seconds integer,
    is_public        boolean,
    is_mine          boolean,
    preview_url      text,
    album_image_url  text
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
    SELECT
        p.id,
        ST_Y(p.location::geometry) AS latitude,
        ST_X(p.location::geometry) AS longitude,
        p.place_name,
        p.spotify_track_id,
        p.track_name,
        p.artist_name,
        p.start_seconds,
        p.duration_seconds,
        p.is_public,
        (p.user_id = auth.uid()) AS is_mine,
        p.preview_url,
        p.album_image_url
    FROM pins p
    ORDER BY p.created_at DESC;
$$;


-- ---- list_playlist_pins (now returns album_image_url) --------------

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
    is_mine          boolean,
    preview_url      text,
    album_image_url  text
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
    SELECT
        p.id,
        pp.position AS pos,
        ST_Y(p.location::geometry) AS latitude,
        ST_X(p.location::geometry) AS longitude,
        p.place_name,
        p.spotify_track_id,
        p.track_name,
        p.artist_name,
        p.start_seconds,
        p.duration_seconds,
        p.is_public,
        (p.user_id = auth.uid()) AS is_mine,
        p.preview_url,
        p.album_image_url
    FROM playlist_pins pp
    JOIN pins p ON p.id = pp.pin_id
    WHERE pp.playlist_id = p_playlist_id
    ORDER BY pp.position;
$$;
