-- ====================================================================
-- list_friend_activity RPC
-- ====================================================================
-- Powers the Feed tab. Returns recent PUBLIC pins + playlists from
-- friends (accepted friendships only), unioned into a single
-- chronological stream.
--
-- Why public-only:
--   We never want to leak a friend's private pin/playlist into the
--   feed even if you're friends — privacy is a per-row choice. The
--   pins/playlists RLS already enforces this for direct SELECTs but
--   we add an explicit WHERE here as defense-in-depth.
--
-- SECURITY INVOKER: the SELECTs go through pins_read /
-- playlists_read which already allow rows where is_public = true.
-- The auth.uid() check on friendships ensures we only see activity
-- from people you're actually friends with.
--
-- Apply: paste into Supabase > SQL Editor > Run. Idempotent.
-- ====================================================================

DROP FUNCTION IF EXISTS public.list_friend_activity();

CREATE FUNCTION public.list_friend_activity()
RETURNS TABLE (
    kind                  text,         -- 'pin' or 'playlist'
    id                    uuid,         -- pin or playlist id (route target)
    created_at            timestamptz,
    title                 text,         -- track_name or playlist title
    subtitle              text,         -- artist_name or playlist description
    place_name            text,         -- pin only; NULL for playlists
    image_url             text,         -- user photo > album art > playlist cover
    friend_id             uuid,
    friend_display_name   text,
    friend_avatar_url     text
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
    WITH my_friends AS (
        SELECT
            CASE WHEN f.user_id = auth.uid() THEN f.friend_id
                 ELSE f.user_id
            END AS other_id
        FROM friendships f
        WHERE f.status = 'accepted'
          AND (f.user_id = auth.uid() OR f.friend_id = auth.uid())
    )

    SELECT
        'pin'::text       AS kind,
        p.id,
        p.created_at,
        p.track_name      AS title,
        p.artist_name     AS subtitle,
        p.place_name,
        COALESCE(p.image_url, p.album_image_url) AS image_url,
        p.user_id         AS friend_id,
        pr.display_name   AS friend_display_name,
        pr.avatar_url     AS friend_avatar_url
    FROM pins p
    JOIN profiles pr ON pr.id = p.user_id
    WHERE p.is_public = true
      AND p.user_id IN (SELECT other_id FROM my_friends)

    UNION ALL

    SELECT
        'playlist'::text    AS kind,
        pl.id,
        pl.created_at,
        pl.title,
        pl.description      AS subtitle,
        NULL::text          AS place_name,
        pl.cover_image_url  AS image_url,
        pl.user_id          AS friend_id,
        pr.display_name     AS friend_display_name,
        pr.avatar_url       AS friend_avatar_url
    FROM playlists pl
    JOIN profiles pr ON pr.id = pl.user_id
    WHERE pl.is_public = true
      AND pl.user_id IN (SELECT other_id FROM my_friends)

    ORDER BY created_at DESC
    LIMIT 50;
$$;
