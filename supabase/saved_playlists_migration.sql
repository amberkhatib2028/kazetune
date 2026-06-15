-- ====================================================================
-- saved_playlists_migration.sql
-- ====================================================================
-- Lets a user "save" someone else's public playlist to their library.
-- The Playlists tab's default view shows playlists you MADE or SAVED —
-- a friend's playlist no longer shows up just because it's public.
--
-- Adds:
--   saved_playlists      join table (who saved which playlist)
--   save_playlist(id)    / unsave_playlist(id) RPCs
--   list_playlists       now also returns is_saved
--
-- Run order: after user_images_migration.sql. Idempotent.
-- ====================================================================

CREATE TABLE IF NOT EXISTS saved_playlists (
    user_id     uuid NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
    playlist_id uuid NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    created_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, playlist_id)
);

ALTER TABLE saved_playlists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "saved_playlists_rw" ON saved_playlists;
CREATE POLICY "saved_playlists_rw" ON saved_playlists FOR ALL TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());


CREATE OR REPLACE FUNCTION public.save_playlist(p_playlist_id uuid)
RETURNS void LANGUAGE sql SECURITY INVOKER AS $$
    INSERT INTO saved_playlists (user_id, playlist_id)
    VALUES (auth.uid(), p_playlist_id)
    ON CONFLICT (user_id, playlist_id) DO NOTHING;
$$;

CREATE OR REPLACE FUNCTION public.unsave_playlist(p_playlist_id uuid)
RETURNS void LANGUAGE sql SECURITY INVOKER AS $$
    DELETE FROM saved_playlists
    WHERE user_id = auth.uid() AND playlist_id = p_playlist_id;
$$;


-- ---- list_playlists (now returns is_saved) -------------------------
DROP FUNCTION IF EXISTS public.list_playlists();

CREATE FUNCTION public.list_playlists()
RETURNS TABLE (
    id                  uuid,
    user_id             uuid,
    title               text,
    description         text,
    is_public           boolean,
    is_mine             boolean,
    is_saved            boolean,
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
        (sp.user_id IS NOT NULL) AS is_saved,
        (SELECT COUNT(*)::int FROM playlist_pins pp WHERE pp.playlist_id = pl.id) AS pin_count,
        pl.created_at,
        pl.cover_image_url,
        pr.display_name AS owner_display_name,
        pr.avatar_url   AS owner_avatar_url
    FROM playlists pl
    LEFT JOIN profiles pr ON pr.id = pl.user_id
    LEFT JOIN saved_playlists sp
        ON sp.playlist_id = pl.id AND sp.user_id = auth.uid()
    ORDER BY pl.created_at DESC;
$$;
