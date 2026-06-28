# kazetune.app domain → Terms & Privacy (GitHub Pages)

The legal pages are published to the **`gh-pages`** branch and GitHub Pages
is configured to serve them at the custom domain **kazetune.app**:

- https://kazetune.app/terms  → Terms of Use
- https://kazetune.app/privacy → Privacy Policy
- https://kazetune.app/ → simple landing page

These match the links already in the app's sign-in screen. To rebuild the
site after editing `legal/terms.md` or `legal/privacy.md`, re-run the
publish steps in `.tmp/buildsite.py` (or ask Claude).

## The one step left: DNS (do this at your domain registrar)

kazetune.app is an **apex domain**, so add these **A records** (host `@`):

```
185.199.108.153
185.199.109.153
185.199.110.153
185.199.111.153
```

Optionally also add **AAAA records** (IPv6, host `@`):

```
2606:50c0:8000::153
2606:50c0:8001::153
2606:50c0:8002::153
2606:50c0:8003::153
```

If you also want **www.kazetune.app**, add a **CNAME** record:
`www` → `amberkhatib2028.github.io`

## After DNS propagates (minutes to a few hours)

1. GitHub repo → **Settings → Pages** — it'll verify the domain and
   auto-issue an HTTPS certificate (Let's Encrypt).
2. Tick **Enforce HTTPS** (the `.app` TLD requires HTTPS anyway).
3. Visit https://kazetune.app/privacy to confirm it loads.

That's it — the in-app Terms/Privacy links and the URL you give Apple in
App Store Connect will both work.

## Notes
- Domain verification (Settings → Pages → "Verify") is optional but
  recommended to prevent domain takeover.
- Source branch is `gh-pages`; `main` is untouched by the site.
