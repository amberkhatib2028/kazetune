-- ====================================================================
-- preview_url_migration.sql
-- ====================================================================
-- Adds Spotify's preview_url (30-sec audio MP3) to pins so geofence-
-- triggered playback doesn't need a fresh Spotify API call every time
-- the user walks past a pin. Also re-creates create_pin and list_pins
-- so they round-trip preview_url through the API.
--
-- Apply: paste into Supabase > SQL Editor > Run. Idempotent.
-- ====================================================================

ALTER TABLE pins
    ADD COLUMN IF NOT EXISTS preview_url text;


-- ---- create_pin (now accepts preview_url) --------------------------

CREATE OR REPLACE FUNCTION public.create_pin(
    p_latitude         double precision,
    p_longitude        double precision,
    p_place_name       text,
    p_spotify_track_id text,
    p_track_name       text,
    p_artist_name      text,
    p_start_seconds    integer,
    p_duration_seconds integer,
    p_is_public        boolean,
    p_preview_url      text DEFAULT NULL
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
        preview_url
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
        NULLIF(p_preview_url, '')
    )
    RETURNING * INTO new_pin;

    RETURN new_pin;
END;
$$;


-- ---- list_pins (now returns preview_url) ---------------------------

CREATE OR REPLACE FUNCTION public.list_pins()
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
    preview_url      text
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
        p.preview_url
    FROM pins p
    ORDER BY p.created_at DESC;
$$;
