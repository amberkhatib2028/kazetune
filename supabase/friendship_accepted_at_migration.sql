-- ====================================================================
-- friendship_accepted_at_migration.sql
-- ====================================================================
-- Adds friendships.accepted_at so the Feed can show only activity that
-- happened AFTER you two became friends (not a friend's whole back
-- catalogue the moment you connect).
--
-- Run order: after pin_visibility_migration.sql (which last defined
-- list_friend_activity). Idempotent.
-- ====================================================================

ALTER TABLE friendships ADD COLUMN IF NOT EXISTS accepted_at timestamptz;

-- Existing accepted friendships: treat the request time as the cutoff.
UPDATE friendships
SET accepted_at = created_at
WHERE status = 'accepted' AND accepted_at IS NULL;


-- Set accepted_at when a request is accepted (both accept paths).
CREATE OR REPLACE FUNCTION public.accept_friend_request(p_from_user_id uuid)
RETURNS void LANGUAGE sql SECURITY INVOKER AS $$
    UPDATE friendships SET status = 'accepted', accepted_at = now()
    WHERE user_id = p_from_user_id
      AND friend_id = auth.uid()
      AND status = 'pending';
$$;

CREATE OR REPLACE FUNCTION public.send_friend_request(p_friend_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
    IF p_friend_id = auth.uid() THEN RAISE EXCEPTION 'Cannot friend yourself'; END IF;

    IF EXISTS (
        SELECT 1 FROM friendships
        WHERE user_id = p_friend_id AND friend_id = auth.uid() AND status = 'pending'
    ) THEN
        UPDATE friendships SET status = 'accepted', accepted_at = now()
        WHERE user_id = p_friend_id AND friend_id = auth.uid();
        RETURN;
    END IF;

    INSERT INTO friendships (user_id, friend_id, status)
    VALUES (auth.uid(), p_friend_id, 'pending')
    ON CONFLICT (user_id, friend_id) DO NOTHING;
END;
$$;


-- Feed: friends' pins/playlists, but only those created at/after the
-- friendship was accepted.
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
        SELECT
            CASE WHEN f.user_id = auth.uid() THEN f.friend_id ELSE f.user_id END AS other_id,
            f.accepted_at AS since
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
    JOIN my_friends mf ON mf.other_id = p.user_id
    WHERE p.visibility IN ('friends', 'public')
      AND p.created_at >= COALESCE(mf.since, p.created_at)

    UNION ALL

    SELECT
        'playlist'::text, pl.id, pl.created_at, pl.title, pl.description, NULL::text,
        pl.cover_image_url, pl.user_id, pr.display_name, pr.avatar_url
    FROM playlists pl
    JOIN profiles pr ON pr.id = pl.user_id
    JOIN my_friends mf ON mf.other_id = pl.user_id
    WHERE pl.is_public = true
      AND pl.created_at >= COALESCE(mf.since, pl.created_at)

    ORDER BY created_at DESC
    LIMIT 50;
$$;
