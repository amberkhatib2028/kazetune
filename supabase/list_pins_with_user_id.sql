-- ====================================================================
-- list_pins_with_user_id.sql
-- ====================================================================
-- Adds `user_id` to the list_pins return shape so the client can
-- compute a "is this pin's owner one of my friends?" check locally
-- (used by the Mine / Friends / Everyone filter on All Pins).
--
-- We DROP first because the return TABLE shape changes — Postgres
-- won't let CREATE OR REPLACE swap the column list.
--
-- Apply: paste into Supabase > SQL Editor > Run.
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
    is_mine          boolean,
    preview_url      text,
    album_image_url  text,
    image_url        text
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
        p.image_url
    FROM pins p
    ORDER BY p.created_at DESC;
$$;
