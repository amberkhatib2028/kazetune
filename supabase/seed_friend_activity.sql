-- ====================================================================
-- seed_friend_activity.sql  (DEV ONLY)
-- ====================================================================
-- Creates a fake friend "Casey" with an ACCEPTED friendship to you,
-- plus 5 public pins around Princeton and 1 public playlist that
-- contains 3 of them. Used to populate the Feed tab during testing.
--
-- Safe to re-run: it always creates a fresh fake user with a new
-- random UUID. Old fake users + their pins are NOT cleaned up — see
-- the bottom of this file for cleanup if you want.
-- ====================================================================

DO $$
DECLARE
    fake_user_id     uuid := gen_random_uuid();
    my_user_id       uuid := '413dbcf9-6610-441a-a0ce-2fabf9f1f9f0'::uuid;
    pin1_id          uuid;
    pin2_id          uuid;
    pin3_id          uuid;
    pin4_id          uuid;
    pin5_id          uuid;
    playlist_id      uuid;
BEGIN
    -- ---- 1. Fake auth user --------------------------------------
    INSERT INTO auth.users (
        id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, aud, role, email_confirmed_at
    ) VALUES (
        fake_user_id,
        '00000000-0000-0000-0000-000000000000',
        'casey_' || substr(fake_user_id::text, 1, 8) || '@example.com',
        '{}'::jsonb,
        jsonb_build_object('name', 'Casey'),
        now(), now(), 'authenticated', 'authenticated', now()
    );

    -- Profile row (handle_new_user trigger may fire; ON CONFLICT is safe).
    INSERT INTO profiles (id, spotify_id, display_name, email, avatar_url)
    VALUES (
        fake_user_id,
        'casey_' || substr(fake_user_id::text, 1, 8),
        'Casey',
        'casey_' || substr(fake_user_id::text, 1, 8) || '@example.com',
        NULL
    )
    ON CONFLICT (id) DO UPDATE SET display_name = 'Casey';

    -- ---- 2. ACCEPTED friendship --------------------------------
    INSERT INTO friendships (user_id, friend_id, status)
    VALUES (fake_user_id, my_user_id, 'accepted');

    -- ---- 3. Public pins around Princeton -----------------------
    --
    -- Real Spotify track IDs. preview_url is NULL — we're not testing
    -- audio playback here, just the feed display. album_image_url is
    -- also NULL so the letter-fallback circles render (testing fallback).
    -- Created_at staggered so the feed shows them in a sensible order.

    INSERT INTO pins (
        user_id, location, place_name, spotify_track_id, track_name,
        artist_name, start_seconds, duration_seconds, is_public,
        created_at, updated_at
    ) VALUES (
        fake_user_id,
        ST_SetSRID(ST_MakePoint(-74.6571, 40.3495), 4326)::geography,
        'Firestone Library',
        '4fbvXwMTXPWaFyaMWUm9CR',
        'Skinny Love',
        'Bon Iver',
        12, 30, true,
        now() - interval '5 minutes',
        now() - interval '5 minutes'
    ) RETURNING id INTO pin1_id;

    INSERT INTO pins (
        user_id, location, place_name, spotify_track_id, track_name,
        artist_name, start_seconds, duration_seconds, is_public,
        created_at, updated_at
    ) VALUES (
        fake_user_id,
        ST_SetSRID(ST_MakePoint(-74.6562, 40.3461), 4326)::geography,
        'Frist Campus Center',
        '2qSkIjg1o9h3YT9RAgYN75',
        'Espresso',
        'Sabrina Carpenter',
        20, 25, true,
        now() - interval '2 hours',
        now() - interval '2 hours'
    ) RETURNING id INTO pin2_id;

    INSERT INTO pins (
        user_id, location, place_name, spotify_track_id, track_name,
        artist_name, start_seconds, duration_seconds, is_public,
        created_at, updated_at
    ) VALUES (
        fake_user_id,
        ST_SetSRID(ST_MakePoint(-74.6584, 40.3489), 4326)::geography,
        'Nassau Hall',
        '6AI3ezQ4o3HUoP6Dhudph3',
        'Not Like Us',
        'Kendrick Lamar',
        45, 35, true,
        now() - interval '8 hours',
        now() - interval '8 hours'
    ) RETURNING id INTO pin3_id;

    INSERT INTO pins (
        user_id, location, place_name, spotify_track_id, track_name,
        artist_name, start_seconds, duration_seconds, is_public,
        created_at, updated_at
    ) VALUES (
        fake_user_id,
        ST_SetSRID(ST_MakePoint(-74.6557, 40.3477), 4326)::geography,
        'McCosh Hall',
        '1BxfuPKGuaTgP7aM0Bbdwr',
        'Cruel Summer',
        'Taylor Swift',
        0, 28, true,
        now() - interval '1 day',
        now() - interval '1 day'
    ) RETURNING id INTO pin4_id;

    INSERT INTO pins (
        user_id, location, place_name, spotify_track_id, track_name,
        artist_name, start_seconds, duration_seconds, is_public,
        created_at, updated_at
    ) VALUES (
        fake_user_id,
        ST_SetSRID(ST_MakePoint(-74.6566, 40.3491), 4326)::geography,
        'Witherspoon Hall',
        '0V3wPSX9ygBnCm8psDIegu',
        'Anti-Hero',
        'Taylor Swift',
        58, 22, true,
        now() - interval '3 days',
        now() - interval '3 days'
    ) RETURNING id INTO pin5_id;

    -- ---- 4. Public playlist with 3 of the pins ------------------
    INSERT INTO playlists (
        user_id, title, description, is_public, created_at, updated_at
    ) VALUES (
        fake_user_id,
        'Princeton walk',
        'A loop around campus. Hit up Firestone first.',
        true,
        now() - interval '1 hour',
        now() - interval '1 hour'
    ) RETURNING id INTO playlist_id;

    INSERT INTO playlist_pins (playlist_id, pin_id, position) VALUES
        (playlist_id, pin1_id, 0),
        (playlist_id, pin2_id, 1),
        (playlist_id, pin3_id, 2);

    RAISE NOTICE 'Seeded fake friend Casey (%) with 5 public pins + 1 playlist.',
        fake_user_id;
END $$;


-- ====================================================================
-- CLEANUP (run only when you want to remove all Casey fake users):
-- ====================================================================
-- DELETE FROM auth.users WHERE raw_user_meta_data->>'name' = 'Casey';
-- (cascades to profiles, pins, playlists, playlist_pins, friendships)
