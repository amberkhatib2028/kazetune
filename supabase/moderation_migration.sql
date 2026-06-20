-- ====================================================================
-- moderation_migration.sql
-- ====================================================================
-- User-generated-content safety, required for App Store review of a
-- social app (Apple Guideline 1.2): users must be able to BLOCK abusive
-- users and REPORT objectionable content.
--
-- Adds:
--   blocked_users     who has blocked whom (one-directional rows, but
--                     enforced symmetrically by is_blocked)
--   content_reports   reports of pins / playlists / profiles
--   is_blocked(a,b)   SECURITY DEFINER predicate used inside RLS so the
--                     "they blocked me" direction is visible to my own
--                     read policies (blocked_users RLS hides other
--                     people's rows from a direct query)
--   block_user / unblock_user / list_blocked_users / report_content RPCs
--
-- Blocking is mutual and total: neither party sees the other's pins,
-- playlists, profile-in-search, or feed activity, and any friendship or
-- pending request between them is severed.
--
-- Read access is enforced in the RLS SELECT policies for pins and
-- playlists, so EVERY read path (list RPCs, the feed, pin/playlist
-- detail, direct selects) excludes blocked users with no per-query work.
--
-- Run order: last (after every other migration). Idempotent.
-- Apply: `npm run db:push`.
-- ====================================================================


-- ---------- Tables --------------------------------------------------

CREATE TABLE IF NOT EXISTS blocked_users (
    blocker_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    blocked_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (blocker_id, blocked_id),
    CHECK (blocker_id <> blocked_id)
);

ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "blocked_users_rw" ON blocked_users;
-- You manage only your own block list (and can read who YOU blocked, for
-- the management screen). The reverse direction is read via is_blocked().
CREATE POLICY "blocked_users_rw" ON blocked_users FOR ALL TO authenticated
    USING (blocker_id = auth.uid()) WITH CHECK (blocker_id = auth.uid());


CREATE TABLE IF NOT EXISTS content_reports (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content_type text NOT NULL CHECK (content_type IN ('pin', 'playlist', 'profile')),
    content_id   uuid NOT NULL,
    reason       text NOT NULL,
    details      text,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_reports_created ON content_reports (created_at DESC);

ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "content_reports_insert" ON content_reports;
DROP POLICY IF EXISTS "content_reports_read"   ON content_reports;
CREATE POLICY "content_reports_insert" ON content_reports FOR INSERT TO authenticated
    WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "content_reports_read"   ON content_reports FOR SELECT TO authenticated
    USING (reporter_id = auth.uid());


-- ---------- is_blocked predicate ------------------------------------
-- SECURITY DEFINER so RLS policies can check the "they blocked me"
-- direction (blocked_users RLS otherwise hides their row from me).
-- Symmetric: true if EITHER side has blocked the other.

CREATE OR REPLACE FUNCTION public.is_blocked(a uuid, b uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM blocked_users bu
        WHERE (bu.blocker_id = a AND bu.blocked_id = b)
           OR (bu.blocker_id = b AND bu.blocked_id = a)
    );
$$;


-- ---------- RLS: hide blocked users' content ------------------------
-- Re-create the pins/playlists read policies with a block check on the
-- non-owner branch (you always see your own; you can never block
-- yourself, so own content is unaffected).

DROP POLICY IF EXISTS "pins_read" ON pins;
CREATE POLICY "pins_read" ON pins FOR SELECT TO authenticated
USING (
    user_id = auth.uid()
    OR (
        NOT public.is_blocked(auth.uid(), pins.user_id)
        AND (
            visibility = 'public'
            OR (
                visibility = 'friends'
                AND EXISTS (
                    SELECT 1 FROM friendships f
                    WHERE f.status = 'accepted'
                      AND (
                        (f.user_id = pins.user_id AND f.friend_id = auth.uid())
                        OR (f.user_id = auth.uid() AND f.friend_id = pins.user_id)
                      )
                )
            )
        )
    )
);

DROP POLICY IF EXISTS "playlists_read" ON playlists;
CREATE POLICY "playlists_read" ON playlists FOR SELECT TO authenticated
USING (
    user_id = auth.uid()
    OR (is_public AND NOT public.is_blocked(auth.uid(), playlists.user_id))
);


-- ---------- block / unblock -----------------------------------------
-- Blocking also severs any friendship or pending request between the two
-- users, so the block takes full effect immediately (feed, friends list,
-- friends-only pins).

CREATE OR REPLACE FUNCTION public.block_user(p_target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    IF p_target = auth.uid() THEN
        RAISE EXCEPTION 'Cannot block yourself';
    END IF;

    INSERT INTO blocked_users (blocker_id, blocked_id)
    VALUES (auth.uid(), p_target)
    ON CONFLICT (blocker_id, blocked_id) DO NOTHING;

    DELETE FROM friendships
    WHERE (user_id = auth.uid() AND friend_id = p_target)
       OR (user_id = p_target   AND friend_id = auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION public.unblock_user(p_target uuid)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
AS $$
    DELETE FROM blocked_users
    WHERE blocker_id = auth.uid() AND blocked_id = p_target;
$$;


-- ---------- list_blocked_users --------------------------------------

DROP FUNCTION IF EXISTS public.list_blocked_users();

CREATE FUNCTION public.list_blocked_users()
RETURNS TABLE (
    id           uuid,
    display_name text,
    username     text,
    avatar_url   text,
    created_at   timestamptz
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
    SELECT pr.id, pr.display_name, pr.username, pr.avatar_url, bu.created_at
    FROM blocked_users bu
    JOIN profiles pr ON pr.id = bu.blocked_id
    WHERE bu.blocker_id = auth.uid()
    ORDER BY bu.created_at DESC;
$$;


-- ---------- report_content ------------------------------------------

CREATE OR REPLACE FUNCTION public.report_content(
    p_content_type text,
    p_content_id   uuid,
    p_reason       text,
    p_details      text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    INSERT INTO content_reports (reporter_id, content_type, content_id, reason, details)
    VALUES (auth.uid(), p_content_type, p_content_id, p_reason, NULLIF(p_details, ''));
END;
$$;


-- ---------- search_users (exclude blocked, either direction) --------
-- Same return shape as username_migration; re-declared with a block
-- filter so blocked users can't find each other to re-add.

DROP FUNCTION IF EXISTS public.search_users(text);

CREATE FUNCTION public.search_users(p_query text)
RETURNS TABLE (
    id                uuid,
    display_name      text,
    username          text,
    spotify_id        text,
    avatar_url        text,
    friendship_status text
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
    WITH normalized AS (
        SELECT ltrim(trim(p_query), '@') AS q
    )
    SELECT
        pr.id,
        pr.display_name,
        pr.username,
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
      AND NOT public.is_blocked(auth.uid(), pr.id)
      AND (
        pr.display_name ILIKE '%' || (SELECT q FROM normalized) || '%'
        OR pr.username ILIKE '%' || (SELECT q FROM normalized) || '%'
      )
    ORDER BY
        CASE WHEN LOWER(pr.username) = (SELECT LOWER(q) FROM normalized) THEN 0
             WHEN LOWER(pr.display_name) = (SELECT LOWER(q) FROM normalized) THEN 1
             ELSE 2
        END,
        pr.display_name
    LIMIT 25;
$$;


-- ---------- lookup_user_by_username (exclude blocked) ---------------

DROP FUNCTION IF EXISTS public.lookup_user_by_username(text);

CREATE FUNCTION public.lookup_user_by_username(p_username text)
RETURNS TABLE (
    id                uuid,
    username          text,
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
        pr.username,
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
    WHERE LOWER(pr.username) = LOWER(trim(p_username))
      AND NOT public.is_blocked(auth.uid(), pr.id)
    LIMIT 1;
$$;
