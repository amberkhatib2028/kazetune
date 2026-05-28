-- ====================================================================
-- friend_rpcs.sql
-- ====================================================================
-- RPCs for the friends feature. friendships table is directional —
--   (user_id = requester, friend_id = recipient, status)
-- "Friends" means status='accepted'. "Pending" means request is open.
--
-- Apply: paste into Supabase > SQL Editor > Run. Idempotent.
-- ====================================================================


-- ---- search_users --------------------------------------------------
-- Find profiles by display_name (case-insensitive substring), exclude
-- yourself, include the relationship status with the searcher.

CREATE OR REPLACE FUNCTION public.search_users(p_query text)
RETURNS TABLE (
    id                uuid,
    display_name      text,
    spotify_id        text,
    friendship_status text  -- 'none' | 'pending_outgoing' | 'pending_incoming' | 'accepted'
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
    SELECT
        pr.id,
        pr.display_name,
        pr.spotify_id,
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


-- ---- list_friend_summary -------------------------------------------
-- All friendships (accepted or pending) involving the caller, with
-- the other party's profile and a normalized status.

CREATE OR REPLACE FUNCTION public.list_friend_summary()
RETURNS TABLE (
    other_id           uuid,
    other_display_name text,
    other_spotify_id   text,
    status             text,  -- 'accepted' | 'pending_outgoing' | 'pending_incoming'
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


-- ---- send_friend_request -------------------------------------------
-- If they already requested YOU, auto-accept. Otherwise insert a new
-- pending request. No-op if you've already requested them.

CREATE OR REPLACE FUNCTION public.send_friend_request(p_friend_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    IF p_friend_id = auth.uid() THEN
        RAISE EXCEPTION 'Cannot friend yourself';
    END IF;

    -- Auto-accept if the other side already sent us a request.
    IF EXISTS (
        SELECT 1 FROM friendships
        WHERE user_id = p_friend_id
          AND friend_id = auth.uid()
          AND status = 'pending'
    ) THEN
        UPDATE friendships SET status = 'accepted'
        WHERE user_id = p_friend_id AND friend_id = auth.uid();
        RETURN;
    END IF;

    INSERT INTO friendships (user_id, friend_id, status)
    VALUES (auth.uid(), p_friend_id, 'pending')
    ON CONFLICT (user_id, friend_id) DO NOTHING;
END;
$$;


-- ---- accept_friend_request -----------------------------------------

CREATE OR REPLACE FUNCTION public.accept_friend_request(p_from_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
AS $$
    UPDATE friendships SET status = 'accepted'
    WHERE user_id = p_from_user_id
      AND friend_id = auth.uid()
      AND status = 'pending';
$$;


-- ---- remove_friend -------------------------------------------------
-- Used for: declining incoming, canceling outgoing, or unfriending.

CREATE OR REPLACE FUNCTION public.remove_friend(p_other_id uuid)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
AS $$
    DELETE FROM friendships
    WHERE (user_id = auth.uid()   AND friend_id = p_other_id)
       OR (user_id = p_other_id   AND friend_id = auth.uid());
$$;
