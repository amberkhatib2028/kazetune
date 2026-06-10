-- ====================================================================
-- delete_account RPC
-- ====================================================================
-- Lets a signed-in user permanently delete their OWN account and all of
-- their data. Deleting the auth.users row cascades to profiles (FK
-- ON DELETE CASCADE), and from profiles to pins, playlists,
-- playlist_pins, and friendships — so one delete wipes everything.
--
-- SECURITY DEFINER so the function runs as its owner (postgres), which
-- is allowed to delete from auth.users. It only ever deletes auth.uid(),
-- so a user can never delete anyone but themselves.
--
-- Apply: paste into Supabase > SQL Editor > Run, or `npm run db:push`.
-- ====================================================================

CREATE OR REPLACE FUNCTION public.delete_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

-- Only signed-in users may call it (and it self-constrains to auth.uid()).
REVOKE ALL ON FUNCTION public.delete_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_account() TO authenticated;
