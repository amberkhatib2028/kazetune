// Edge Function: spotify-refresh
//
// Exchanges a Spotify refresh token for a fresh access token, server-side
// (the client secret must never live in the app). The app calls this when
// it gets a 401 from Spotify; see lib/supabase.ts `refreshSpotifyToken`.
//
// Deployed via the Supabase Management API (no Docker/CLI needed). The
// SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET are set as Edge Function
// secrets, not stored here. verify_jwt is on, so only signed-in users
// can call it.
//
// To redeploy after editing this file, PATCH it to:
//   https://api.supabase.com/v1/projects/<ref>/functions/spotify-refresh
// with { body: <this source>, verify_jwt: true } and a Bearer PAT.

Deno.serve(async (req) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });

  try {
    const { refresh_token } = await req.json();
    if (!refresh_token) return json({ error: 'missing refresh_token' }, 400);

    const basic = btoa(
      `${Deno.env.get('SPOTIFY_CLIENT_ID')}:${Deno.env.get('SPOTIFY_CLIENT_SECRET')}`,
    );
    const r = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token,
      }).toString(),
    });

    // Pass Spotify's response straight through (access_token, expires_in,
    // and sometimes a rotated refresh_token).
    return json(await r.json(), r.status);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
