-- ====================================================================
-- create_pin RPC
-- ====================================================================
-- Called by the mobile app to insert a new pin. We do this via an RPC
-- rather than a direct INSERT because:
--   1. The geography(Point, 4326) column is awkward to set via the
--      REST API; ST_MakePoint() in SQL is clean.
--   2. We can take user_id from auth.uid() so the client never lies
--      about whose pin it is.
--
-- Apply by pasting this whole file into Supabase > SQL Editor > Run.
-- ====================================================================

CREATE OR REPLACE FUNCTION public.create_pin(
    p_latitude         double precision,
    p_longitude        double precision,
    p_place_name       text,
    p_spotify_track_id text,
    p_track_name       text,
    p_artist_name      text,
    p_start_seconds    integer,
    p_duration_seconds integer,
    p_is_public        boolean
) RETURNS pins
LANGUAGE plpgsql
SECURITY INVOKER  -- runs as the calling user; RLS still applies.
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
        is_public
    ) VALUES (
        auth.uid(),
        ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography,
        NULLIF(p_place_name, ''),
        p_spotify_track_id,
        p_track_name,
        p_artist_name,
        p_start_seconds,
        p_duration_seconds,
        p_is_public
    )
    RETURNING * INTO new_pin;

    RETURN new_pin;
END;
$$;
