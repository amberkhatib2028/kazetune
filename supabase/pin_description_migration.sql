-- ====================================================================
-- pin_description_migration.sql
-- ====================================================================
-- Adds a free-text note to pins: pins.description. This is the "why" —
-- e.g. "this is where we first met" — distinct from place_name (the
-- "where"). Threads the field through every RPC that creates, edits, or
-- lists pins.
--
-- Run order: apply user_images_migration.sql first (this builds on the
-- create_pin / list_pins / list_playlist_pins signatures it defines).
-- Apply: paste into Supabase > SQL Editor > Run. Idempotent.
-- ====================================================================

ALTER TABLE pins ADD COLUMN IF NOT EXISTS description text;


-- ====================================================================
-- create_pin (now accepts description)
-- ====================================================================

DROP FUNCTION IF EXISTS public.create_pin(
    double precision, double precision, text, text, text, text,
    integer, integer, boolean, text, text, text
);
DROP FUNCTION IF EXISTS public.create_pin(
    double precision, double precision, text, text, text, text,
    integer, integer, boolean, text, text, text, text
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
        artist_name, start_seconds, duration_seconds, is_public,
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
        p_is_public,
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
-- update_pin (now accepts description)
-- ====================================================================

DROP FUNCTION IF EXISTS public.update_pin(
    uuid, double precision, double precision, text, integer, integer,
    boolean, text
);
DROP FUNCTION IF EXISTS public.update_pin(
    uuid, double precision, double precision, text, integer, integer,
    boolean, text, text
);

CREATE FUNCTION public.update_pin(
    p_pin_id           uuid,
    p_latitude         double precision,
    p_longitude        double precision,
    p_place_name       text,
    p_start_seconds    integer,
    p_duration_seconds integer,
    p_is_public        boolean,
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
        is_public        = p_is_public,
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
-- list_pins (returns description)
-- ====================================================================

-- NOTE: includes user_id (needed by the All Pins Mine/Friends/Everyone
-- filter). This is the authoritative final shape of list_pins; running
-- this migration last reconciles any earlier ordering of the
-- list_pins_with_user_id / user_images definitions.
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
        p.id,
        p.user_id,
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
        p.album_image_url,
        p.image_url,
        p.description
    FROM pins p
    ORDER BY p.created_at DESC;
$$;


-- ====================================================================
-- list_playlist_pins (returns description)
-- ====================================================================

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
    album_image_url  text,
    image_url        text,
    description      text
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
        p.album_image_url,
        p.image_url,
        p.description
    FROM playlist_pins pp
    JOIN pins p ON p.id = pp.pin_id
    WHERE pp.playlist_id = p_playlist_id
    ORDER BY pp.position;
$$;
