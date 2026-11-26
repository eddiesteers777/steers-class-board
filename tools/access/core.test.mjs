// The pure rules in js/accessRules.js. Run: node tools/access/core.test.mjs
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cleanEmail, splitEmails, decideAccess, pageIsOpen, waitlistRows, OWNER_HASHES } from "../../js/accessRules.js";
import fs from "node:fs";

assert.equal(cleanEmail("  Jane.Doe@School.ORG "), "jane.doe@school.org");
assert.equal(cleanEmail("Jane Doe <jane@school.org>"), "jane@school.org");
assert.equal(cleanEmail("mailto:jane@school.org"), "jane@school.org");
assert.equal(cleanEmail("jane@school"), "");
assert.equal(cleanEmail("not an email"), "");
assert.equal(cleanEmail(""), "");
assert.equal(cleanEmail(null), "");
assert.deepEqual(splitEmails("a@b.co, A@B.co\nc@d.org; nope  e@f.net"), { good: ["a@b.co", "c@d.org", "e@f.net"], bad: ["nope"] });

const h = (e) => createHash("sha256").update(e).digest("hex");
assert.equal(decideAccess({ anonymous: true }), "guest");
assert.equal(decideAccess({ anonymous: false, verified: true, hash: OWNER_HASHES[0], entry: "error" }), "owner");
assert.equal(decideAccess({ anonymous: false, verified: true, hash: OWNER_HASHES[0].toUpperCase(), entry: false }), "owner");
assert.equal(decideAccess({ anonymous: false, verified: false, hash: OWNER_HASHES[0], entry: false }), "unknown");   // unverified is never the owner
assert.equal(decideAccess({ anonymous: false, verified: true, hash: h("x@y.co"), entry: true }), "approved");
assert.equal(decideAccess({ anonymous: false, verified: true, hash: h("x@y.co"), entry: false }), "waiting");
assert.equal(decideAccess({ anonymous: false, verified: true, hash: h("x@y.co"), entry: "error" }), "unknown");     // offline or rules not live: nobody is sent away

// the owner list matches the rules and the server function
const rules = fs.readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8"), fn = fs.readFileSync(new URL("../../functions/index.js", import.meta.url), "utf8");
for (const x of OWNER_HASHES) { assert.ok(rules.includes("'" + x + "'"), "rules list " + x); assert.ok(fn.includes('"' + x + '"'), "functions list " + x); }
assert.equal((rules.match(/'[0-9a-f]{64}'/g) || []).length, OWNER_HASHES.length);

for (const p of ["/home.html", "/login.html", "/waiting.html", "/class.html", "/site/join.html", "/privacy.html"]) assert.ok(pageIsOpen(p), p);
for (const p of ["/", "/index.html", "/plan.html", "/remote.html", "/access.html", "/setup.html"]) assert.ok(!pageIsOpen(p), p);

const rows = waitlistRows([{ email: "A@b.co", at: 1 }, { email: "c@d.org", at: 3 }, { email: "e@f.net", at: 2 }], ["a@b.co"]);
assert.deepEqual(rows.map((r) => [r.email, r.approved]), [["c@d.org", false], ["e@f.net", false], ["a@b.co", true]]);
console.log("access core: ok");
