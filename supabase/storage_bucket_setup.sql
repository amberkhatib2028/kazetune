-- ====================================================================
-- storage_bucket_setup.sql
-- ====================================================================
-- Creates the `kazetune-media` Supabase Storage bucket and its RLS
-- policies. One bucket for everything user-uploaded, with paths:
--
--   pin/<user_id>/<random>.jpg       — custom photo for a pin
--   playlist/<user_id>/<random>.jpg  — custom playlist cover
--   avatar/<user_id>.jpg             — profile picture (upserted)
--
-- Anyone can read (so friends can see your stuff). Only the owner can
-- write/delete to their own user_id folder.
--
-- Apply: paste into Supabase > SQL Editor > Run.
-- ====================================================================


-- Create (or update) the bucket.
INSERT INTO storage.buckets (id, name, public)
VALUES ('kazetune-media', 'kazetune-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;


-- Drop existing policies so this file is safe to re-run.
DROP POLICY IF EXISTS "kazetune_media_read"   ON storage.objects;
DROP POLICY IF EXISTS "kazetune_media_insert" ON storage.objects;
DROP POLICY IF EXISTS "kazetune_media_update" ON storage.objects;
DROP POLICY IF EXISTS "kazetune_media_delete" ON storage.objects;


-- Public read: anyone (incl. anon) can fetch any file in the bucket.
-- We keep this open because pins/playlists/profiles are meant to be
-- shared with friends. URLs are unguessable enough for our purposes.
CREATE POLICY "kazetune_media_read"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'kazetune-media');


-- Authenticated users can upload only into their own folder. We check
-- the 2nd path segment matches their auth.uid() (the 1st is the kind:
-- pin / playlist / avatar).
CREATE POLICY "kazetune_media_insert"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'kazetune-media'
        AND split_part(name, '/', 2) = auth.uid()::text
    );


-- Same constraint for update + delete: only your own folder.
CREATE POLICY "kazetune_media_update"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'kazetune-media'
        AND split_part(name, '/', 2) = auth.uid()::text
    )
    WITH CHECK (
        bucket_id = 'kazetune-media'
        AND split_part(name, '/', 2) = auth.uid()::text
    );


CREATE POLICY "kazetune_media_delete"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'kazetune-media'
        AND split_part(name, '/', 2) = auth.uid()::text
    );
