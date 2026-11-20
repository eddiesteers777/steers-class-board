// End to end on this computer: node test/e2e.mjs
// Starts a stand-in for Google, Firebase sign-in and Firestore on :8790, runs the Worker with
// `wrangler dev -c test/wrangler.local.jsonc` on :8787, then connects the way Claude does:
// discovery, client registration, consent, Google, token, MCP tool calls, refresh. Made-up data only.
import http from "node:http";
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { encFields, decFields } from "../src/firestore.js";
const _fetch = globalThis.fetch; globalThis.fetch = (u, o = {}) => _fetch(u, { signal: AbortSignal.timeout(20000), ...o });

const W = "http://127.0.0.1:8787", REDIRECT = "https://claude.ai/api/mcp/auth_callback";
let email = "teacher@example.com";
const b64u = (b) => Buffer.from(b).toString("base64url");
const docs = new Map(); let clock = 0;
const seed = (path, data) => docs.set(path, { fields: encFields(data), updateTime: "t" + (++clock) });
seed("rosters/all", { periods: { "1st": ["Ava M.", "Ben C.", "Chloe D."] } });
seed("work/index", { sets: [{ id: "s1", title: "Quiz 4.2", period: "1st", date: "2026-11-18", pages: 3, students: 0, unsorted: 3 }], at: 1 });
seed("work/s_s1", { id: "s1", title: "Quiz 4.2", period: "1st", date: "2026-11-18", per: 1, pages: [{ p: "a", s: "", b: 10 }, { p: "b", s: "", b: 10 }, { p: "c", s: "", b: 10 }] });
for (const p of ["a", "b", "c"]) seed("work/p_" + p, { img: "data:image/jpeg;base64,/9j/" + p.toUpperCase(), strip: "data:image/jpeg;base64,/9j/S" + p.toUpperCase(), set: "s1" });
seed("../../teacher/other/work/index", { secret: true });

const body = (req) => new Promise((ok) => { let s = ""; req.on("data", (c) => (s += c)); req.on("end", () => ok(s)); });
const json = (res, code, o) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(o)); };
const mock = http.createServer(async (req, res) => {
    const u = new URL(req.url, "http://x"), text = await body(req);
    if (u.pathname === "/google/token") {
        const f = new URLSearchParams(text);
        assert.equal(f.get("client_secret"), "test-secret"); assert.ok(f.get("code_verifier"));
        const claims = { aud: "test-client.apps.googleusercontent.com", email, email_verified: true, sub: "g1" };
        return json(res, 200, { id_token: b64u("{}") + "." + b64u(JSON.stringify(claims)) + ".sig", access_token: "g" });
    }
    if (u.pathname === "/identity/v1/accounts:signInWithIdp") {
        assert.match(JSON.parse(text).postBody, /^id_token=.+&providerId=google\.com$/);
        return json(res, 200, { localId: "uid1", idToken: "fb-first", refreshToken: "fb-refresh", expiresIn: "3600", email });
    }
    if (u.pathname === "/securetoken/v1/token") {
        if (new URLSearchParams(text).get("refresh_token") !== "fb-refresh") return json(res, 400, { error: { message: "INVALID_REFRESH_TOKEN" } });
        return json(res, 200, { id_token: "fb-fresh", user_id: "uid1", expires_in: "3600" });
    }
    const m = /^\/firestore\/v1\/projects\/demo-anchor\/databases\/\(default\)\/documents\/teacher\/([^/]+)\/(.+)$/.exec(decodeURIComponent(u.pathname));
    if (m) {
        if (req.headers.authorization !== "Bearer fb-fresh" || m[1] !== "uid1") return json(res, 403, { error: { message: "Missing or insufficient permissions.", status: "PERMISSION_DENIED" } });
        const path = m[2];
        if (req.method === "GET") return docs.has(path) ? json(res, 200, { name: path, ...docs.get(path) }) : json(res, 404, { error: { status: "NOT_FOUND" } });
        if (req.method === "PATCH") {
            const pre = u.searchParams.get("currentDocument.updateTime");
            if (pre && docs.get(path)?.updateTime !== pre) return json(res, 400, { error: { status: "FAILED_PRECONDITION", message: "stale" } });
            docs.set(path, { fields: JSON.parse(text).fields, updateTime: "t" + (++clock) });
            return json(res, 200, { name: path, ...docs.get(path) });
        }
    }
    json(res, 404, { error: "mock: " + req.method + " " + u.pathname });
});
await new Promise((ok) => mock.listen(8790, "127.0.0.1", ok));

// the Worker must reach the stand-in on 127.0.0.1 directly, not through a proxy
function noProxy(env) { const e = { ...env }; for (const k of Object.keys(e)) if (/^(https?|all)_proxy$/i.test(k)) delete e[k]; e.NO_PROXY = e.no_proxy = "127.0.0.1,localhost"; return e; }
const dev = spawn("npx", ["wrangler", "dev", "-c", "test/wrangler.local.jsonc", "--port", "8787", "--ip", "127.0.0.1", "--persist-to", process.env.PERSIST || ".wrangler/e2e"], { stdio: ["ignore", "pipe", "pipe"], env: { ...noProxy(process.env), WRANGLER_SEND_METRICS: "false" } });
let log = ""; dev.stdout.on("data", (d) => (log += d)); dev.stderr.on("data", (d) => (log += d));
const stop = () => { dev.kill("SIGTERM"); mock.closeAllConnections(); mock.close(); setTimeout(() => process.exit(process.exitCode || 0), 500); };
try {
    for (let i = 0; i < 60; i++) { try { await fetch(W + "/"); break; } catch { await new Promise((r) => setTimeout(r, 500)); } }

    console.log("worker up");
    // 1. Claude's first call has no token: 401 pointing at the resource metadata
    let r = await fetch(W + "/mcp", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" }, body: "{}" });
    assert.equal(r.status, 401); assert.match(r.headers.get("www-authenticate") || "", /resource_metadata=/);
    const prm = await (await fetch(W + "/.well-known/oauth-protected-resource/mcp")).json();
    assert.equal(prm.resource, W + "/mcp"); assert.deepEqual(prm.authorization_servers, [W]);
    const as = await (await fetch(W + "/.well-known/oauth-authorization-server")).json();
    assert.ok(as.registration_endpoint && as.authorization_endpoint && as.token_endpoint);
    console.log("ok - discovery");

    // 2. register, then authorize with PKCE
    const reg = await (await fetch(as.registration_endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_name: "Claude", redirect_uris: [REDIRECT], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] }) })).json();
    assert.ok(reg.client_id);
    async function connect() {
        const verifier = b64u(randomBytes(32)), challenge = b64u(createHash("sha256").update(verifier).digest());
        const q = new URLSearchParams({ response_type: "code", client_id: reg.client_id, redirect_uri: REDIRECT, code_challenge: challenge, code_challenge_method: "S256", state: "st1", scope: "work", resource: W + "/mcp" });
        let res = await fetch(as.authorization_endpoint + "?" + q, { redirect: "manual" });
        const html = await res.text(); assert.equal(res.status, 200, html);
        assert.match(html, /Connect Anchor Board to Claude\?/); assert.match(html, /It cannot delete anything/);
        const handle = /name="handle" value="([^"]+)"/.exec(html)[1];
        const jar = new Map(); const keep = (res) => (res.headers.getSetCookie?.() || []).forEach((c) => { const [kv] = c.split(";"); const i = kv.indexOf("="); jar.set(kv.slice(0, i), kv.slice(i + 1)); });
        const cookie = () => [...jar].filter(([, v]) => v).map(([k, v]) => k + "=" + v).join("; ");
        keep(res);
        res = await fetch(W + "/authorize", { method: "POST", redirect: "manual", headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie(), Origin: W }, body: new URLSearchParams({ handle, decision: "approve" }) });
        assert.equal(res.status, 302, await res.text()); keep(res);
        const g = new URL(res.headers.get("location"));
        assert.equal(g.origin + g.pathname, "http://127.0.0.1:8790/google/auth"); assert.equal(g.searchParams.get("redirect_uri"), W + "/callback");
        assert.equal(g.searchParams.get("login_hint"), "teacher@example.com");
        res = await fetch(W + "/callback?code=gcode&state=" + encodeURIComponent(g.searchParams.get("state")), { redirect: "manual", headers: { Cookie: cookie() } });
        return { res, verifier };
    }
    // 3. a different Google account is turned away
    email = "someone@else.org";
    let { res } = await connect();
    assert.equal(res.status, 403); assert.match(await res.text(), /can't use this connector/);
    console.log("ok - another Google account is refused");

    // 4. the teacher gets in and Claude gets tokens
    email = "teacher@example.com";
    const c = await connect(); res = c.res;
    assert.equal(res.status, 302, await res.clone().text());
    const back = new URL(res.headers.get("location")); assert.equal(back.origin + back.pathname, REDIRECT); assert.equal(back.searchParams.get("state"), "st1");
    let tok = await (await fetch(as.token_endpoint, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", code: back.searchParams.get("code"), redirect_uri: REDIRECT, client_id: reg.client_id, code_verifier: c.verifier, resource: W + "/mcp" }) })).json();
    assert.ok(tok.access_token && tok.refresh_token, JSON.stringify(tok));
    console.log("ok - teacher signs in, Claude gets a token");

    // 5. MCP calls
    let id = 0;
    const rpc = async (method, params, token = tok.access_token) => {
        const r = await fetch(W + "/mcp", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", Authorization: "Bearer " + token, "MCP-Protocol-Version": "2025-11-25" }, body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }) });
        const t = await r.text(); assert.equal(r.status, 200, t); return JSON.parse(t);
    };
    const init = await rpc("initialize", { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "test", version: "1" } });
    assert.equal(init.result.serverInfo.name, "anchor-board"); assert.match(init.result.instructions, /get_roster/);
    const tools = (await rpc("tools/list", {})).result.tools.map((t) => t.name).sort();
    assert.deepEqual(tools, ["assign_names", "get_roster", "list_stacks", "look_at_pages"]);
    const call = async (name, args) => (await rpc("tools/call", { name, arguments: args })).result;
    let out = await call("list_stacks", { unsorted_only: true });
    assert.match(out.content[0].text, /stack_id s1 · 1st period · Wed, Nov 18 · “Quiz 4.2” · 2nd nine weeks, Week 5/);
    out = await call("look_at_pages", { stack_id: "s1" });
    assert.equal(out.content.filter((x) => x.type === "image").length, 3); assert.equal(out.content[2].data, "/9j/SA");
    out = await call("assign_names", { stack_id: "s1", names: [{ page: 1, name: "Chloe" }, { page: 2, name: "Ava M." }, { page: 3, name: "?" }] });
    assert.match(out.content[0].text, /Saved names for 2 pages/); assert.match(out.content[0].text, /No paper yet from: Ben C\./);
    const set = decFields(docs.get("work/s_s1").fields);
    assert.deepEqual(set.pages.map((p) => [p.s, p.by || ""]), [["Chloe D.", "claude"], ["Ava M.", "claude"], ["", ""]]);
    assert.equal(decFields(docs.get("work/index").fields).sets[0].unsorted, 1);
    out = await call("look_at_pages", { stack_id: "zzz" }); assert.equal(out.isError, true);
    console.log("ok - tools list, look, assign and save to the database");

    // 6. a bad token is refused; refresh works
    r = await fetch(W + "/mcp", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", Authorization: "Bearer nope" }, body: "{}" });
    assert.equal(r.status, 401);
    const tok2 = await (await fetch(as.token_endpoint, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: tok.refresh_token, client_id: reg.client_id, resource: W + "/mcp" }) })).json();
    assert.ok(tok2.access_token, JSON.stringify(tok2)); tok = tok2;
    assert.equal((await call("get_roster", { period: "1st" })).content[0].text.split("\n")[0], "1st period roster (3):");
    console.log("ok - bad token refused, refresh works");
    console.log("\nend to end: all passed");
} catch (e) {
    console.error(log.slice(-4000)); throw e;
} finally { stop(); }
