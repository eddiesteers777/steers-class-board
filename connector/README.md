# Anchor Board connector

A remote MCP server so Claude can sort scanned Student Work for the teacher. It runs on Cloudflare
Workers (free plan) and reads and writes only the signed-in teacher's own Firestore data, through
the same security rules as the website. No service account key, no paid Firebase plan, no API key.

Tools: `list_stacks`, `get_roster`, `look_at_pages`, `assign_names`. Nothing can be deleted.

## How sign-in works
Claude registers itself, the teacher approves on `/authorize`, signs in with Google (only
`ALLOWED_EMAIL` gets through), and the Google ID token is exchanged for a Firebase sign-in
(`signInWithIdp`). The Firebase refresh token is kept, encrypted, with Claude's grant in KV.

## Setup (once)
1. Free Cloudflare account; pick a workers.dev subdomain.
2. Repository secrets: `CLOUDFLARE_API_TOKEN` ("Edit Cloudflare Workers" template), `CLOUDFLARE_ACCOUNT_ID`.
3. Google Cloud console, project steers-class-board, Credentials, "Web client (auto created by Google
   Service)": add redirect URI `https://anchor-connector.<subdomain>.workers.dev/callback`. Then
   repository secrets `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ALLOWED_EMAIL`.
4. Run Actions > Deploy connector (it also runs on every merge that changes `connector/`).
5. In Claude: Settings > Connectors > Add custom connector, URL `https://anchor-connector.<subdomain>.workers.dev/mcp`.

## Tests
- `npm test`: the tools against a made-up store.
- `node test/e2e.mjs`: the whole flow (discovery, registration, consent, Google, token, tool calls,
  refresh) with `wrangler dev` and a local stand-in for Google, Firebase sign-in and Firestore.
