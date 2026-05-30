-- ====================================================================
-- update_pin RPC
-- ====================================================================
-- Lets the owner of a pin edit the editable fields:
--   - location (latitude, longitude)
--   - place_name
--   - clip (start_seconds, duration_seconds)
--   - is_public
--   - image_url (user-uploaded photo; pass '' to clear, NULL to keep)
--
-- We do NOT let the user change which track is pinned — that's a
-- separate concept (delete + recreate). spotify_track_id, track_name,
-- artist_name, preview_url, album_image_url all stay as-is.
--
-- SECURITY INVOKER + RLS: the UPDATE goes through the pins_update
-- policy which checks user_id = auth.uid(). Non-owners get 0 rows
-- updated and we raise a "not found" error.
--
-- Apply: paste into Supabase > SQL Editor > Run. Idempotent.
-- ====================================================================

CREATE OR REPLACE FUNCTION public.update_pin(
    p_pin_id           uuid,
    p_latitude         double precision,
    p_longitude        double precision,
    p_place_name       text,
    p_start_seconds    integer,
    p_duration_seconds integer,
    p_is_public        boolean,
    p_image_url        text DEFAULT NULL
) RETURNS pins
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    updated_pin pins;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_duration_seconds < 20 THEN
        RAISE EXCEPTION 'Clip must be at least 20 seconds.';
    END IF;

    UPDATE pins
    SET
        location         = ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography,
        place_name       = NULLIF(p_place_name, ''),
        start_seconds    = p_start_seconds,
        duration_seconds = p_duration_seconds,
        is_public        = p_is_public,
        image_url        = NULLIF(p_image_url, ''),
        updated_at       = NOW()
    WHERE id = p_pin_id
    RETURNING * INTO updated_pin;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pin not found or you do not have permission to edit it.';
    END IF;

    RETURN updated_pin;
END;
$$;
