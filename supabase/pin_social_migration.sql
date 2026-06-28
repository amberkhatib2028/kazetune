-- ====================================================================
-- pin_social_migration.sql
-- ====================================================================
-- Social engagement on pins: likes + comments.
--
-- Both respect everything already in place:
--   • pin visibility — you can only like/comment on a pin you can SEE
--     (the policies' subqueries run under the pins RLS).
--   • blocking — comments from users you've blocked (or who blocked you)
--     are hidden, via is_blocked() in the read policy.
--   • reporting — comments are user-generated content, so content_reports
--     gains a 'comment' type and the app can report them.
--
-- Adds:
--   pin_likes            (pin_id, user_id) one row per like
--   pin_comments         id, pin_id, user_id, body, created_at
--   like_pin / unlike_pin / pin_like_summary
--   list_pin_comments / add_pin_comment / delete_pin_comment
--
-- Run order: after moderation_migration.sql. Idempotent.
-- Apply: `npm run db:push`.
-- ====================================================================


-- ---------- Tables --------------------------------------------------

CREATE TABLE IF NOT EXISTS pin_likes (
    pin_id     uuid NOT NULL REFERENCES pins(id)     ON DELETE CASCADE,
    user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (pin_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_pin_likes_pin ON pin_likes (pin_id);

CREATE TABLE IF NOT EXISTS pin_comments (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    pin_id     uuid NOT NULL REFERENCES pins(id)     ON DELETE CASCADE,
    user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    body       text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 500),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pin_comments_pin ON pin_comments (pin_id, created_at);


-- ---------- RLS -----------------------------------------------------

ALTER TABLE pin_likes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE pin_comments ENABLE ROW LEVEL SECURITY;

-- Likes: read for any pin you can see + author not blocked; write only
-- your own, and only on a pin you can see.
DROP POLICY IF EXISTS "pin_likes_read"  ON pin_likes;
DROP POLICY IF EXISTS "pin_likes_write" ON pin_likes;
CREATE POLICY "pin_likes_read" ON pin_likes FOR SELECT TO authenticated
USING (
    NOT public.is_blocked(auth.uid(), pin_likes.user_id)
    AND EXISTS (SELECT 1 FROM pins p WHERE p.id = pin_likes.pin_id)
);
CREATE POLICY "pin_likes_write" ON pin_likes FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM pins p WHERE p.id = pin_likes.pin_id)
);

-- Comments: read for any pin you can see + author not blocked; insert
-- your own on a visible pin; delete your own OR (as the pin's owner)
-- any comment on your pin — so owners can moderate their pins.
DROP POLICY IF EXISTS "pin_comments_read"   ON pin_comments;
DROP POLICY IF EXISTS "pin_comments_insert" ON pin_comments;
DROP POLICY IF EXISTS "pin_comments_delete" ON pin_comments;
CREATE POLICY "pin_comments_read" ON pin_comments FOR SELECT TO authenticated
USING (
    NOT public.is_blocked(auth.uid(), pin_comments.user_id)
    AND EXISTS (SELECT 1 FROM pins p WHERE p.id = pin_comments.pin_id)
);
CREATE POLICY "pin_comments_insert" ON pin_comments FOR INSERT TO authenticated
WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM pins p WHERE p.id = pin_comments.pin_id)
);
CREATE POLICY "pin_comments_delete" ON pin_comments FOR DELETE TO authenticated
USING (
    user_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM pins p
        WHERE p.id = pin_comments.pin_id AND p.user_id = auth.uid()
    )
);


-- ---------- content_reports: allow reporting comments ---------------

ALTER TABLE content_reports DROP CONSTRAINT IF EXISTS content_reports_content_type_check;
ALTER TABLE content_reports ADD CONSTRAINT content_reports_content_type_check
    CHECK (content_type IN ('pin', 'playlist', 'profile', 'comment'));


-- ---------- Likes RPCs ----------------------------------------------

CREATE OR REPLACE FUNCTION public.like_pin(p_pin_id uuid)
RETURNS void LANGUAGE sql SECURITY INVOKER AS $$
    INSERT INTO pin_likes (pin_id, user_id)
    VALUES (p_pin_id, auth.uid())
    ON CONFLICT (pin_id, user_id) DO NOTHING;
$$;

CREATE OR REPLACE FUNCTION public.unlike_pin(p_pin_id uuid)
RETURNS void LANGUAGE sql SECURITY INVOKER AS $$
    DELETE FROM pin_likes WHERE pin_id = p_pin_id AND user_id = auth.uid();
$$;

DROP FUNCTION IF EXISTS public.pin_like_summary(uuid);
CREATE FUNCTION public.pin_like_summary(p_pin_id uuid)
RETURNS TABLE (like_count integer, liked_by_me boolean)
LANGUAGE sql SECURITY INVOKER STABLE AS $$
    SELECT
        (SELECT COUNT(*)::int FROM pin_likes l WHERE l.pin_id = p_pin_id),
        EXISTS (
            SELECT 1 FROM pin_likes l
            WHERE l.pin_id = p_pin_id AND l.user_id = auth.uid()
        );
$$;


-- ---------- Comments RPCs -------------------------------------------

DROP FUNCTION IF EXISTS public.list_pin_comments(uuid);
CREATE FUNCTION public.list_pin_comments(p_pin_id uuid)
RETURNS TABLE (
    id           uuid,
    user_id      uuid,
    display_name text,
    username     text,
    avatar_url   text,
    body         text,
    created_at   timestamptz,
    is_mine      boolean
)
LANGUAGE sql SECURITY INVOKER STABLE AS $$
    SELECT
        ct.id, ct.user_id, pr.display_name, pr.username, pr.avatar_url,
        ct.body, ct.created_at, (ct.user_id = auth.uid()) AS is_mine
    FROM pin_comments ct
    JOIN profiles pr ON pr.id = ct.user_id
    WHERE ct.pin_id = p_pin_id
    ORDER BY ct.created_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.add_pin_comment(p_pin_id uuid, p_body text)
RETURNS pin_comments LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
    new_row pin_comments;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
    IF btrim(coalesce(p_body, '')) = '' THEN RAISE EXCEPTION 'Comment is empty'; END IF;

    INSERT INTO pin_comments (pin_id, user_id, body)
    VALUES (p_pin_id, auth.uid(), btrim(p_body))
    RETURNING * INTO new_row;
    RETURN new_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_pin_comment(p_comment_id uuid)
RETURNS void LANGUAGE sql SECURITY INVOKER AS $$
    DELETE FROM pin_comments WHERE id = p_comment_id;
$$;
