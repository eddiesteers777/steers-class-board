/* ==========================================
   Anchor Board connector: a remote MCP server for Claude, on Cloudflare Workers (free plan).

   /mcp        the connector itself (Claude's access token required)
   /authorize  consent page, then Google sign-in (only ALLOWED_EMAIL gets through)
   /callback   back from Google: sign in to Anchor Board and hand Claude its token
   everything OAuth else (discovery, /register, /token) is answered by workers-oauth-provider.

   Settings (wrangler.jsonc vars): FIREBASE_API_KEY, FIREBASE_PROJECT, SITE_URL.
   Secrets (set by .github/workflows/deploy-connector.yml): GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, ALLOWED_EMAIL.
   KV: OAUTH_KV (grants and tokens, stored hashed and encrypted by the library).
========================================== */
import { OAuthProvider, AuthorizationError, CimdFetchError, OAuthError, authorizationErrorRedirect } from "@cloudflare/workers-oauth-provider";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { googleAuthUrl, googleExchange, firebaseSignIn, firebaseIdToken, s256 } from "./auth.js";
import { teacherStore } from "./firestore.js";
import * as T from "./tools.js";

const SCOPE = "work";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => "&#" + c.charCodeAt(0) + ";");

/* ---------- pages ---------- */
function page(title, body, headers = new Headers(), status = 200) {
    headers.set("Content-Type", "text/html; charset=utf-8");
    headers.set("Cache-Control", "no-store");
    return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>
:root{--bg:#f4f7fb;--card:#fff;--ink:#0f2340;--soft:#51627c;--line:#d9e2ee;--navy:#12325c;--sky:#2f7fd8}
@media (prefers-color-scheme:dark){:root{--bg:#0b1626;--card:#13233a;--ink:#e8eef7;--soft:#a5b4c9;--line:#25384f;--navy:#3d86e0;--sky:#7fb6f2}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;display:grid;place-items:center;min-height:100vh;padding:16px}
main{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:28px;max-width:460px;width:100%}
h1{font-size:1.3rem;margin:0 0 12px}p{margin:0 0 12px;color:var(--soft)}b{color:var(--ink)}ul{margin:0 0 16px;padding-left:20px;color:var(--soft)}
.row{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}button{font:inherit;border-radius:10px;padding:10px 18px;border:1px solid var(--line);background:transparent;color:var(--ink);cursor:pointer}
button.go{background:var(--navy);border-color:var(--navy);color:#fff;font-weight:600}
</style></head><body><main>${body}</main></body></html>`, { status, headers });
}

async function authorize(req, env) {
    const oauth = env.OAUTH_PROVIDER, origin = new URL(req.url).origin;
    if (req.method === "GET") {
        const request = await oauth.parseAuthRequest(req);
        const d = await oauth.describeConsent(request);
        const consent = await oauth.beginConsent(request);
        return page("Connect Anchor Board", `
<h1>Connect Anchor Board to ${esc(d.clientName)}?</h1>
<p>${d.clientDomain ? "From <b>" + esc(d.clientDomain) + "</b>. " : ""}Access goes to <b>${esc(d.redirectHost)}</b>.</p>
${d.redirectIsLoopback ? "<p><b>This sends access to an app on this computer.</b> Continue only if you just started connecting from it.</p>" : ""}
<p>It will be able to:</p>
<ul><li>see your Student Work stacks, rosters and scanned pages</li><li>put student names on pages (you check them on the site)</li></ul>
<p>It cannot delete anything. Next you sign in with Google; only the Anchor Board teacher account is let in.</p>
<form method="post"><input type="hidden" name="handle" value="${esc(consent.handle)}">
<div class="row"><button class="go" name="decision" value="approve">Continue to Google</button><button name="decision" value="deny">Cancel</button></div></form>`, consent.headers);
    }
    if (req.method === "POST") {
        const form = await req.formData(), handle = String(form.get("handle") || "");
        if (form.get("decision") !== "approve") {
            const denied = await oauth.denyConsent(req, handle);
            return new Response(null, { status: 302, headers: denied.headers });
        }
        const approved = await oauth.approveConsent(req, handle, { scope: [SCOPE] });
        const verifier = crypto.randomUUID() + crypto.randomUUID();
        const { state, headers } = await oauth.beginUpstream(approved.request, { data: { verifier }, headers: approved.headers });
        headers.set("Location", googleAuthUrl(env, { state, redirectUri: origin + "/callback", codeChallenge: await s256(verifier) }));
        return new Response(null, { status: 302, headers });
    }
    return new Response("Method not allowed", { status: 405 });
}

async function callback(req, env) {
    const oauth = env.OAUTH_PROVIDER, u = new URL(req.url);
    const { request: original, data, headers } = await oauth.finishUpstream(req);
    if (u.searchParams.get("error") || !u.searchParams.get("code")) {
        headers.set("Location", authorizationErrorRedirect(original, "access_denied"));
        return new Response(null, { status: 302, headers });
    }
    let google;
    try { google = await googleExchange(env, { code: u.searchParams.get("code"), redirectUri: u.origin + "/callback", verifier: data.verifier }); }
    catch (e) {
        if (e.notAllowed) return page("Not this account", `<h1>That Google account can't use this connector</h1><p>Anchor Board's connector only lets in the teacher's own account. Close this tab and connect again with that account.</p>`, headers, 403);
        throw e;
    }
    const fb = await firebaseSignIn(env, google.idToken);
    const { redirectTo } = await oauth.completeAuthorization({
        request: original, userId: fb.uid, metadata: { email: google.email }, scope: [SCOPE],
        props: { uid: fb.uid, refreshToken: fb.refreshToken },
    });
    headers.set("Location", redirectTo);
    return new Response(null, { status: 302, headers });
}

const defaultHandler = {
    async fetch(req, env) {
        const path = new URL(req.url).pathname;
        try {
            if (path === "/authorize") return await authorize(req, env);
            if (path === "/callback") return await callback(req, env);
            if (path === "/" || path === "") return page("Anchor Board connector", `<h1>Anchor Board connector</h1><p>This is the address Claude uses to reach Anchor Board. Add <b>${esc(new URL(req.url).origin)}/mcp</b> as a custom connector in Claude's settings.</p>`);
            return new Response("Not found", { status: 404 });
        } catch (e) {
            if (e instanceof AuthorizationError && e.redirectTo) return Response.redirect(e.redirectTo, 302);
            if (e instanceof AuthorizationError || e instanceof CimdFetchError) {
                return page("Could not connect", `<h1>Could not connect</h1><p>${esc(e instanceof AuthorizationError ? e.description : "This app could not be verified.")}</p><p>Start connecting again from Claude.</p>`, new Headers(), 400);
            }
            console.error(e);
            return page("Could not connect", `<h1>Could not connect</h1><p>${esc(e.message || "Something went wrong.")}</p><p>Start connecting again from Claude.</p>`, new Headers(), 500);
        }
    },
};

/* ---------- the MCP server ---------- */
function buildServer(env, props) {
    const server = new McpServer({ name: "anchor-board", title: "Anchor Board", version: "1.0.0" }, {
        instructions: "Anchor Board is a middle school math teacher's class site. Student Work holds scanned class stacks: one stack per assignment per class period, pages in scan order. " +
            "To sort a stack: list_stacks (unsorted_only) to find it, get_roster for its period, look_at_pages to read the handwritten names (name strips by default; ask for whole pages only when a name is unclear or to see the work), then assign_names. " +
            "Only use names from the roster. When a name is unreadable, leave that page \"?\" and tell the teacher. Multi-page papers: name every page of the paper. " +
            "Student names and work are private: never repeat them outside this conversation.",
    });
    let storeP = null;
    const store = () => storeP || (storeP = (async () => {
        const t = await firebaseIdToken(env, props.refreshToken);
        if (t.uid && t.uid !== props.uid) throw new Error("Signed in as a different Anchor Board user. Reconnect the connector.");
        return teacherStore({ base: env.FIRESTORE_URL || "https://firestore.googleapis.com", project: env.FIREBASE_PROJECT, uid: props.uid, idToken: t.idToken });
    })().catch((e) => { storeP = null; throw e; }));
    const run = (fn) => async (args) => {
        try {
            const out = await fn(await store(), args);
            return { content: typeof out === "string" ? [{ type: "text", text: out }] : out };
        } catch (e) {
            const msg = e.revoked ? "The Anchor Board sign-in has expired. Disconnect and reconnect the Anchor Board connector in Claude's settings." : (e.message || "Something went wrong.");
            if (!e.user) console.error(e);
            return { isError: true, content: [{ type: "text", text: msg }] };
        }
    };
    const read = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
    const period = z.string().describe("Class period, like \"1st\", \"4th\" or \"6th\".");
    server.registerTool("list_stacks", {
        title: "List stacks",
        description: "List the teacher's scanned class stacks (one per assignment and period), newest first, with each stack's id, date, nine weeks and week, page count, how many students are named and how many pages are not sorted yet.",
        inputSchema: { period: period.optional(), unsorted_only: z.boolean().optional().describe("Only stacks that still have pages with no name."), limit: z.number().int().min(1).max(100).optional() },
        annotations: read,
    }, run(T.listStacks));
    server.registerTool("get_roster", {
        title: "Get roster",
        description: "The student names for one class period, exactly as they must be used in assign_names.",
        inputSchema: { period },
        annotations: read,
    }, run(T.getRoster));
    server.registerTool("look_at_pages", {
        title: "Look at pages",
        description: "Show pages of a stack as images. By default it shows the name area at the top of each page that has no name yet (up to 30). Pass page numbers to choose pages, and view \"page\" for whole pages (up to 8 at a time). Each image is labelled with its page number and current name.",
        inputSchema: {
            stack_id: z.string().describe("From list_stacks."),
            pages: z.array(z.number().int().min(1)).max(30).optional().describe("Page numbers, starting at 1. Leave out for the unsorted pages."),
            view: z.enum(["name", "page"]).optional().describe("\"name\" (default): the top strip with the name. \"page\": the whole page."),
            count: z.number().int().min(1).max(30).optional(),
        },
        annotations: read,
    }, run(T.lookAtPages));
    server.registerTool("assign_names", {
        title: "Assign names",
        description: "Put a student's name on pages of a stack. Use roster names (a first name that only one student has also works). Use \"key\" for an answer key, \"same\" for one more page of the paper before it, and \"?\" to leave a page unsorted. Pages the teacher already named by hand are left alone unless overwrite is true. Every name you set is marked for the teacher to check on the site.",
        inputSchema: {
            stack_id: z.string(),
            names: z.array(z.object({ page: z.number().int().min(1), name: z.string() })).min(1).max(200),
            overwrite: z.boolean().optional().describe("Also change pages the teacher named by hand. Only when the teacher asks."),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, run(T.assignNames));
    return server;
}

const mcpHandler = {
    async fetch(req, env, ctx) {
        const server = buildServer(env, ctx.props);
        const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
        await server.connect(transport);
        return transport.handleRequest(req);
    },
};

/* ---------- OAuth around it all; the provider is made on the first request, from this Worker's own address ---------- */
let provider = null;
function providerFor(origin) {
    if (provider && provider.origin === origin) return provider.p;
    const p = new OAuthProvider({
        apiRoute: "/mcp",
        apiHandler: mcpHandler,
        defaultHandler,
        authorizeEndpoint: "/authorize",
        tokenEndpoint: "/token",
        clientRegistrationEndpoint: "/register",
        clientIdMetadataDocumentEnabled: true,
        scopesSupported: [SCOPE],
        requiredScopes: [SCOPE],
        resourceMetadata: { resource: origin + "/mcp", authorization_servers: [origin], resource_name: "Anchor Board" },
        accessTokenTTL: 3600,
        refreshTokenTTL: 365 * 86400,
        refreshTokenIdleTTL: 60 * 86400,
        tokenExchangeCallback: async ({ grantType, props, env }) => {
            if (grantType !== "refresh_token") return;
            try { await firebaseIdToken(env, props.refreshToken); }   // the teacher signed out everywhere or was removed: end Claude's access too
            catch (e) { if (e.revoked) throw new OAuthError("invalid_grant", { description: "Anchor Board sign-in was revoked" }); }
        },
    });
    provider = { origin, p };
    return p;
}

export default {
    fetch(req, env, ctx) {
        return providerFor(new URL(req.url).origin).fetch(req, env, ctx);
    },
};
