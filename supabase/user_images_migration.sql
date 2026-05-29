-- ====================================================================
-- user_images_migration.sql
-- ====================================================================
-- Adds user-uploaded images to the app:
--   pins.image_url            (custom photo for a pin)
--   playlists.cover_image_url (custom cover for a playlist)
--   profiles.avatar_url       (user's profile picture)
--
-- Updates every RPC that surfaces these tables to round-trip the new
-- fields. Where the function return shape changes we DROP first because
-- Postgres won't let CREATE OR REPLACE change a TABLE return signature.
--
-- Run order: apply album_image_url_migration.sql first.
-- Apply: paste into Supabase > SQL Editor > Run. Idempotent.
-- ====================================================================

ALTER TABLE pins      ADD COLUMN IF NOT EXISTS image_url       text;
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS cover_image_url text;
ALTER TABLE profiles  ADD COLUMN IF NOT EXISTS avatar_url      text;


-- ====================================================================
-- create_pin (now accepts image_url too)
-- ====================================================================

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
DROP FUNCTION IF EXISTS public.create_pin(
    double precision, double precision, text, text, text, text,
    integer, integer, boolean, text, text, text
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
    p_image_url        text DEFAULT NULL
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
        preview_url, album_image_url, image_url
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
        NULLIF(p_image_url, '')
    )
    RETURNING * INTO new_pin;

    RETURN new_pin;
END;
$$;


-- ====================================================================
-- list_pins (returns image_url)
-- ====================================================================

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
    album_image_url  text,
    image_url        text
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
        p.album_image_url,
        p.image_url
    FROM pins p
    ORDER BY p.created_at DESC;
$$;


-- ====================================================================
-- list_playlist_pins (returns image_url)
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
    image_url        text
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
        p.image_url
    FROM playlist_pins pp
    JOIN pins p ON p.id = pp.pin_id
    WHERE pp.playlist_id = p_playlist_id
    ORDER BY pp.position;
$$;


-- ====================================================================
-- create_playlist (now accepts cover_image_url)
-- ====================================================================

DROP FUNCTION IF EXISTS public.create_playlist(text, text, boolean);
DROP FUNCTION IF EXISTS public.create_playlist(text, text, boolean, text);

CREATE FUNCTION public.create_playlist(
    p_title           text,
    p_description     text    DEFAULT NULL,
    p_is_public       boolean DEFAULT FALSE,
    p_cover_image_url text    DEFAULT NULL
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

    INSERT INTO playlists (user_id, title, description, is_public, cover_image_url)
    VALUES (
        auth.uid(),
        trim(p_title),
        NULLIF(p_description, ''),
        p_is_public,
        NULLIF(p_cover_image_url, '')
    )
    RETURNING * INTO new_row;

    RETURN new_row;
END;
$$;


-- ====================================================================
-- list_playlists (returns cover_image_url + owner display_name/avatar)
-- ====================================================================

DROP FUNCTION IF EXISTS public.list_playlists();

CREATE FUNCTION public.list_playlists()
RETURNS TABLE (
    id                  uuid,
    user_id             uuid,
    title               text,
    description         text,
    is_public           boolean,
    is_mine             boolean,
    pin_count           integer,
    created_at          timestamptz,
    cover_image_url     text,
    owner_display_name  text,
    owner_avatar_url    text
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
        pl.created_at,
        pl.cover_image_url,
        pr.display_name AS owner_display_name,
        pr.avatar_url   AS owner_avatar_url
    FROM playlists pl
    LEFT JOIN profiles pr ON pr.id = pl.user_id
    ORDER BY pl.created_at DESC;
$$;


-- ====================================================================
-- search_users (returns avatar_url)
-- ====================================================================

DROP FUNCTION IF EXISTS public.search_users(text);

CREATE FUNCTION public.search_users(p_query text)
RETURNS TABLE (
    id                uuid,
    display_name      text,
    spotify_id        text,
    avatar_url        text,
    friendship_status text
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
    SELECT
        pr.id,
        pr.display_name,
        pr.spotify_id,
        pr.avatar_url,
        CASE
            WHEN f1.status = 'accepted' OR f2.status = 'accepted' THEN 'accepted'
            WHEN f1.status = 'pending' THEN 'pending_outgoing'
            WHEN f2.status = 'pending' THEN 'pending_incoming'
            ELSE 'none'
        END AS friendship_status
    FROM profiles pr
    LEFT JOIN friendships f1
        ON f1.user_id = auth.uid() AND f1.friend_id = pr.id
    LEFT JOIN friendships f2
        ON f2.user_id = pr.id AND f2.friend_id = auth.uid()
    WHERE pr.id <> auth.uid()
      AND pr.display_name ILIKE '%' || p_query || '%'
    ORDER BY pr.display_name
    LIMIT 25;
$$;


-- ====================================================================
-- list_friend_summary (returns other_avatar_url)
-- ====================================================================

DROP FUNCTION IF EXISTS public.list_friend_summary();

CREATE FUNCTION public.list_friend_summary()
RETURNS TABLE (
    other_id           uuid,
    other_display_name text,
    other_spotify_id   text,
    other_avatar_url   text,
    status             text,
    created_at         timestamptz
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
    SELECT
        CASE WHEN f.user_id = auth.uid() THEN f.friend_id ELSE f.user_id END AS other_id,
        pr.display_name AS other_display_name,
        pr.spotify_id   AS other_spotify_id,
        pr.avatar_url   AS other_avatar_url,
        CASE
            WHEN f.status = 'accepted'         THEN 'accepted'
            WHEN f.user_id = auth.uid()        THEN 'pending_outgoing'
            ELSE                                    'pending_incoming'
        END AS status,
        f.created_at
    FROM friendships f
    JOIN profiles pr
        ON pr.id = CASE WHEN f.user_id = auth.uid() THEN f.friend_id ELSE f.user_id END
    WHERE f.user_id = auth.uid() OR f.friend_id = auth.uid()
    ORDER BY f.created_at DESC;
$$;
