-- ====================================================================
-- playlist_rpcs.sql
-- ====================================================================
-- Server-side RPCs for the playlists feature. All run as the caller
-- (SECURITY INVOKER), so the existing RLS policies on playlists,
-- playlist_pins, and pins enforce who can see/edit what.
--
-- Apply: paste into Supabase > SQL Editor > Run. Idempotent.
-- ====================================================================


-- ---- list_playlists ------------------------------------------------
-- Every playlist the caller can see (own + public), plus a pin count.

CREATE OR REPLACE FUNCTION public.list_playlists()
RETURNS TABLE (
    id          uuid,
    user_id     uuid,
    title       text,
    description text,
    is_public   boolean,
    is_mine     boolean,
    pin_count   integer,
    created_at  timestamptz
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
    SELECT
        pl.id,
        pl.user_id,
        pl.title,
        pl.description,
        pl.is_public,
        (pl.user_id = auth.uid()) AS is_mine,
        (SELECT COUNT(*)::int FROM playlist_pins pp WHERE pp.playlist_id = pl.id) AS pin_count,
        pl.created_at
    FROM playlists pl
    ORDER BY pl.created_at DESC;
$$;


-- ---- create_playlist -----------------------------------------------

CREATE OR REPLACE FUNCTION public.create_playlist(
    p_title       text,
    p_description text DEFAULT NULL,
    p_is_public   boolean DEFAULT FALSE
) RETURNS playlists
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    new_row playlists;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
        RAISE EXCEPTION 'Title is required';
    END IF;

    INSERT INTO playlists (user_id, title, description, is_public)
    VALUES (auth.uid(), trim(p_title), NULLIF(p_description, ''), p_is_public)
    RETURNING * INTO new_row;

    RETURN new_row;
END;
$$;


-- ---- add_pin_to_playlist -------------------------------------------
-- Appends a pin to the end of the playlist. Idempotent: if the pin
-- is already in the playlist, returns its existing position.

CREATE OR REPLACE FUNCTION public.add_pin_to_playlist(
    p_playlist_id uuid,
    p_pin_id      uuid
) RETURNS integer  -- the position the pin ended up at
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    existing_pos integer;
    next_pos integer;
BEGIN
    SELECT position INTO existing_pos
        FROM playlist_pins
        WHERE playlist_id = p_playlist_id AND pin_id = p_pin_id;
    IF FOUND THEN
        RETURN existing_pos;
    END IF;

    SELECT COALESCE(MAX(position), -1) + 1 INTO next_pos
        FROM playlist_pins
        WHERE playlist_id = p_playlist_id;

    INSERT INTO playlist_pins (playlist_id, pin_id, position)
    VALUES (p_playlist_id, p_pin_id, next_pos);

    RETURN next_pos;
END;
$$;


-- ---- remove_pin_from_playlist --------------------------------------

CREATE OR REPLACE FUNCTION public.remove_pin_from_playlist(
    p_playlist_id uuid,
    p_pin_id      uuid
) RETURNS void
LANGUAGE sql
SECURITY INVOKER
AS $$
    DELETE FROM playlist_pins
    WHERE playlist_id = p_playlist_id AND pin_id = p_pin_id;
$$;


-- ---- list_playlist_pins --------------------------------------------
-- Pins in the playlist, in order, with their lat/lng already split out.

CREATE OR REPLACE FUNCTION public.list_playlist_pins(p_playlist_id uuid)
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
    preview_url      text
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
        p.preview_url
    FROM playlist_pins pp
    JOIN pins p ON p.id = pp.pin_id
    WHERE pp.playlist_id = p_playlist_id
    ORDER BY pp.position;
$$;
