# Momentic smoke suite

Signed-out end-to-end tests for Vault, written as [Momentic](https://momentic.ai) plain-English YAML. They cover the one layer the unit/contract/RLS suites don't: the real UI — boot + media attribution, library search + detail, the routine manager, and live-session logging.

Design constraints:

- **Signed out only.** Google OAuth is impractical to automate, and Vault is local-first — a fresh browser profile sees the seeded "Starter Push" routine, which is exactly what these tests assert against. Never point a signed-in profile at these: routine mutations would sync to the real account.
- **No `url` in any test.** The base URL always comes from `--url-override`, so the same suite targets previews, production, or a dev server.
- **`momentic.config.yaml` (in `apps/vault/`) stays minimal.** The CLI requires the project file to run at all, but the base URL is never set in it — `--url-override` decides the target per run.
- The routine **delete** flow is not covered here (native `window.confirm` blocks automation); its logic lives in the unit suite.

## One-time setup (account owner)

1. Sign up at https://app.momentic.ai/signup (free tier: 2,000 credits ≈ 200 test runs/month — this 4-test suite fits comfortably at current PR cadence).
2. Create an API key in the dashboard and add it as the `MOMENTIC_API_KEY` repository secret (`gh secret set MOMENTIC_API_KEY`). The CI workflow (`.github/workflows/momentic.yml`) skips itself until the secret exists.
3. For local runs: `npx momentic login` once (browser flow), or export `MOMENTIC_API_KEY`.

## Running

```powershell
# from apps/vault — against production
npx momentic run momentic --url-override https://fitness-apps-vault.vercel.app

# against a local dev server
npx momentic run momentic --url-override http://localhost:5173
```

In CI, `.github/workflows/momentic.yml` fires on each successful Vercel preview deployment and runs the suite against that preview's URL. It is intentionally not a required status check yet.
