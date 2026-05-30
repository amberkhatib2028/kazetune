-- ====================================================================
-- username_migration.sql
-- ====================================================================
-- Adds a unique @username to profiles. Lowercase + alphanumeric + _,
-- 3-30 chars. Powers two things:
--   1. People can find each other by typing "@casey" in Friends search
--      (display_name match still works too).
--   2. QR codes on the Profile tab encode kazetune://add-friend/<username>
--      so it's a stable, readable identifier.
--
-- New RPCs:
--   set_username(p_username)              — atomic claim w/ uniqueness check
--   lookup_user_by_username(p_username)   — used to resolve the QR target
--   search_users(p_query)                 — updated to also match usernames
--
-- Apply: paste into Supabase > SQL Editor > Run. Idempotent.
-- ====================================================================


-- ---- Column + constraints ------------------------------------------

ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS username text;

-- Enforce the shape (lowercase, alphanumeric, underscore; 3-30 chars).
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'profiles_username_format'
    ) THEN
        ALTER TABLE profiles
            ADD CONSTRAINT profiles_username_format
            CHECK (username IS NULL OR username ~ '^[a-z0-9_]{3,30}$');
    END IF;
END $$;

-- Unique on the lowercased value. (The CHECK already forces lowercase,
-- but the index is on LOWER(username) just to be defensive.)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_idx
    ON profiles (LOWER(username))
    WHERE username IS NOT NULL;


-- ---- set_username --------------------------------------------------
-- Returns the updated profile row. Raises a clear error if the
-- requested username is taken or invalid.

CREATE OR REPLACE FUNCTION public.set_username(p_username text)
RETURNS profiles
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    normalized text := lower(trim(p_username));
    updated profiles;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF normalized IS NULL OR normalized = '' THEN
        RAISE EXCEPTION 'Username is required';
    END IF;

    IF normalized !~ '^[a-z0-9_]{3,30}$' THEN
        RAISE EXCEPTION 'Username must be 3-30 lowercase letters, numbers, or underscores';
    END IF;

    -- Friendly error for taken names (vs. raw "duplicate key" Postgres error).
    IF EXISTS (
        SELECT 1 FROM profiles
        WHERE LOWER(username) = normalized
          AND id <> auth.uid()
    ) THEN
        RAISE EXCEPTION 'That username is taken';
    END IF;

    UPDATE profiles
        SET username = normalized
        WHERE id = auth.uid()
        RETURNING * INTO updated;

    RETURN updated;
END;
$$;


-- ---- lookup_user_by_username ---------------------------------------
-- Returns the minimal profile fields needed to render an "add friend"
-- confirmation card. Does NOT bypass RLS — profiles_read already
-- allows any authenticated user to see any profile.

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
    LIMIT 1;
$$;


-- ---- search_users (now matches display_name OR username) -----------
-- Allow searches to start with @ for clarity ("@casey") — we strip it
-- before matching.

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
      AND (
        pr.display_name ILIKE '%' || (SELECT q FROM normalized) || '%'
        OR pr.username ILIKE '%' || (SELECT q FROM normalized) || '%'
      )
    ORDER BY
        -- Exact username matches first; then display_name; then partial.
        CASE WHEN LOWER(pr.username) = (SELECT LOWER(q) FROM normalized) THEN 0
             WHEN LOWER(pr.display_name) = (SELECT LOWER(q) FROM normalized) THEN 1
             ELSE 2
        END,
        pr.display_name
    LIMIT 25;
$$;
