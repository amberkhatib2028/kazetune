-- ====================================================================
-- list_pins RPC
-- ====================================================================
-- Returns every pin the calling user can see (RLS still applies), with
-- the geography column split into plain latitude/longitude columns so
-- the mobile client doesn't have to parse PostGIS hex blobs.
--
-- Apply: paste into Supabase > SQL Editor > Run.
-- ====================================================================

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
    is_mine          boolean
)
LANGUAGE sql
SECURITY INVOKER  -- RLS on `pins` is enforced for the caller.
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
        (p.user_id = auth.uid()) AS is_mine
    FROM pins p
    ORDER BY p.created_at DESC;
$$;
