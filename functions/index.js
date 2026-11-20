/* ==========================================
   Anchor Board — server functions (Firebase Cloud Functions, 2nd gen).

   readNames: Claude reads the handwritten name at the top of scanned papers.
   The Student Work page (js/workPage.js) sends ONLY a small strip cut from the top of each
   paper (where the name box is) plus that period's roster names. Nothing else from the paper
   leaves the browser, and nothing is stored here. Claude picks a roster name for each strip,
   or none when it cannot tell; the teacher checks every pick before filing.

   Needs (once): the Blaze plan on the Firebase project, and the Claude API key saved as a
   secret:  firebase functions:secrets:set ANTHROPIC_API_KEY
   Deploy:  firebase deploy --only functions   (or the "Deploy functions" GitHub Action)
========================================== */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import Anthropic from "@anthropic-ai/sdk";

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const MAX_STRIPS = 45, MAX_STRIP_CHARS = 200000, MAX_ROSTER = 60;

const TOOL = {
    name: "report_names",
    description: "Report whose name is written on each paper strip, as one entry per strip in the order given.",
    strict: true,
    input_schema: {
        type: "object",
        properties: {
            papers: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        strip: { type: "integer", description: "The strip number, starting at 1." },
                        written: { type: "string", description: "The name as written on the paper, or an empty string if none is readable." },
                        match: { type: "string", description: "The exact roster name it matches, or an empty string if no roster name clearly fits." },
                        sure: { type: "string", enum: ["high", "medium", "low"], description: "How sure the match is." },
                    },
                    required: ["strip", "written", "match", "sure"],
                    additionalProperties: false,
                },
            },
        },
        required: ["papers"],
        additionalProperties: false,
    },
};

export const readNames = onCall({ secrets: [ANTHROPIC_API_KEY], region: "us-central1", timeoutSeconds: 120, memory: "512MiB", maxInstances: 3 }, async (req) => {
    // the teacher's own Google sign-in only: never a student (anonymous) or a stranger
    const auth = req.auth;
    if (!auth || !auth.token || auth.token.firebase?.sign_in_provider === "anonymous") throw new HttpsError("permission-denied", "Teacher sign-in needed.");
    const roster = Array.isArray(req.data?.roster) ? req.data.roster.filter((s) => typeof s === "string" && s.trim()).map((s) => s.trim().slice(0, 60)).slice(0, MAX_ROSTER) : [];
    const strips = Array.isArray(req.data?.strips) ? req.data.strips : [];
    if (!roster.length) throw new HttpsError("invalid-argument", "No roster for this period.");
    if (!strips.length || strips.length > MAX_STRIPS) throw new HttpsError("invalid-argument", "Send 1 to " + MAX_STRIPS + " strips.");
    const images = strips.map((s) => {
        const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(typeof s === "string" ? s : "");
        if (!m || m[1].length > MAX_STRIP_CHARS) throw new HttpsError("invalid-argument", "Each strip must be a small JPEG.");
        return m[1];
    });

    const content = [];
    images.forEach((data, i) => {
        content.push({ type: "text", text: "Strip " + (i + 1) + ":" });
        content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data } });
    });
    content.push({ type: "text", text:
        "These strips are cut from the top of middle school math worksheets, one strip per student paper. " +
        "Read the student's handwritten name on each strip and match it to exactly one name from this class roster:\n" +
        roster.map((n) => "- " + n).join("\n") + "\n\n" +
        "Roster names are usually a first name and a last initial; students may write a full name, a first name only, or a nickname. " +
        "Ignore the worksheet's printed text (titles, \"Name:\", \"Date:\"). Never invent a name that is not on the roster; leave match empty when no roster name clearly fits. " +
        "Use \"high\" only when the writing clearly matches one roster name and no other. Two strips can show the same name if the student turned in two papers. " +
        "Call report_names once with one entry for every strip, in order." });

    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });
    let res;
    try {
        res = await client.beta.messages.create({
            model: "claude-opus-5-5",
            max_tokens: 16000,
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
            tools: [TOOL],
            tool_choice: { type: "auto" },
            messages: [{ role: "user", content }],
        });
    } catch (e) {
        if (e instanceof Anthropic.AuthenticationError) throw new HttpsError("failed-precondition", "The Claude API key is missing or wrong.");
        if (e instanceof Anthropic.RateLimitError) throw new HttpsError("resource-exhausted", "Claude is busy. Try again in a minute.");
        if (e instanceof Anthropic.APIError) throw new HttpsError("unavailable", "Claude could not read the names (" + e.status + ").");
        throw new HttpsError("internal", "Could not reach Claude.");
    }
    if (res.stop_reason === "refusal") throw new HttpsError("unavailable", "Claude declined to read these strips. Pick the names by hand.");
    const call = res.content.find((b) => b.type === "tool_use" && b.name === TOOL.name);
    if (!call) throw new HttpsError("unavailable", "Claude did not return names. Pick them by hand.");
    const set = new Set(roster), out = images.map(() => ({ written: "", match: "", sure: "low" }));
    for (const p of (call.input && call.input.papers) || []) {
        const i = (p.strip | 0) - 1; if (i < 0 || i >= out.length) continue;
        out[i] = { written: String(p.written || "").slice(0, 60), match: set.has(p.match) ? p.match : "", sure: ["high", "medium", "low"].includes(p.sure) ? p.sure : "low" };
    }
    return { papers: out, usage: { input: res.usage?.input_tokens || 0, output: res.usage?.output_tokens || 0 } };
});
