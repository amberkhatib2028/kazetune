-- ====================================================================
-- fake_friend_for_testing.sql  (DEV ONLY — delete the fake user later)
-- ====================================================================
-- Creates a fake user with a pending friend request TO you, so you can
-- test the Friends UI without making another Spotify account.
--
-- HOW TO USE:
--   1. Open the kazetune app, go to Profile tab, copy your "Auth user ID".
--   2. Paste it into the YOUR_AUTH_USER_ID placeholder below.
--   3. Run in Supabase SQL Editor.
-- ====================================================================

DO $$
DECLARE
    fake_user_id uuid := gen_random_uuid();
    my_user_id   uuid := 'YOUR_AUTH_USER_ID_HERE'::uuid;
BEGIN
    -- Bare-minimum auth.users row.
    INSERT INTO auth.users (
        id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, aud, role, email_confirmed_at
    ) VALUES (
        fake_user_id,
        '00000000-0000-0000-0000-000000000000',
        'fake_' || substr(fake_user_id::text, 1, 8) || '@example.com',
        '{}'::jsonb,
        jsonb_build_object('name', 'Test Friend'),
        now(), now(), 'authenticated', 'authenticated', now()
    );

    -- Profile row (trigger may also fire, ON CONFLICT keeps us safe).
    INSERT INTO profiles (id, spotify_id, display_name, email)
    VALUES (
        fake_user_id,
        'fake_' || substr(fake_user_id::text, 1, 8),
        'Test Friend',
        'fake_' || substr(fake_user_id::text, 1, 8) || '@example.com'
    )
    ON CONFLICT (id) DO UPDATE SET display_name = 'Test Friend';

    -- Pending friend request from fake user to you.
    INSERT INTO friendships (user_id, friend_id, status)
    VALUES (fake_user_id, my_user_id, 'pending');

    RAISE NOTICE 'Created fake user % with pending request to you.', fake_user_id;
END $$;


-- To clean up later, replace this UUID with the one from the NOTICE
-- above and run:
--
-- DELETE FROM auth.users WHERE id = 'fake-user-uuid-here';
-- (cascades to profiles + friendships)
