/* ==========================================
   Firestore over REST, signed in as the teacher (a Firebase ID token), so the same
   security rules as the website apply: only teacher/{uid}/... can be read or written.
========================================== */

/** JS value -> Firestore REST Value (the same types the website's Firestore SDK writes). */
export function enc(v) {
    if (v === null || v === undefined) return { nullValue: null };
    if (typeof v === "boolean") return { booleanValue: v };
    if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    if (typeof v === "string") return { stringValue: v };
    if (Array.isArray(v)) return { arrayValue: v.length ? { values: v.map(enc) } : {} };
    if (typeof v === "object") return { mapValue: { fields: encFields(v) } };
    return { stringValue: String(v) };
}
export function encFields(o) {
    const f = {};
    for (const [k, v] of Object.entries(o)) if (v !== undefined) f[k] = enc(v);
    return f;
}
/** Firestore REST Value -> JS value. */
export function dec(v) {
    if (!v || typeof v !== "object") return null;
    if ("nullValue" in v) return null;
    if ("booleanValue" in v) return v.booleanValue;
    if ("integerValue" in v) return Number(v.integerValue);
    if ("doubleValue" in v) return Number(v.doubleValue);
    if ("stringValue" in v) return v.stringValue;
    if ("timestampValue" in v) return v.timestampValue;
    if ("arrayValue" in v) return (v.arrayValue.values || []).map(dec);
    if ("mapValue" in v) return decFields(v.mapValue.fields || {});
    if ("referenceValue" in v) return v.referenceValue;
    if ("bytesValue" in v) return v.bytesValue;
    if ("geoPointValue" in v) return v.geoPointValue;
    return null;
}
export function decFields(f) {
    const o = {};
    for (const [k, v] of Object.entries(f || {})) o[k] = dec(v);
    return o;
}

/**
 * A tiny store for one teacher: get(path) -> { data, updateTime } | null, list(collection) -> [id], put(path, data, updateTime?).
 * path is relative to teacher/{uid}/ (for example "work/index").
 * put with updateTime only writes if nobody changed the document since it was read.
 */
export function teacherStore({ base, project, uid, idToken, fetchImpl = fetch }) {
    const root = `${base}/v1/projects/${project}/databases/(default)/documents/teacher/${uid}/`;
    const headers = { Authorization: "Bearer " + idToken, "Content-Type": "application/json" };
    async function fail(res, what) {
        let msg = ""; try { msg = (await res.json()).error?.message || ""; } catch { /* not JSON */ }
        const e = new Error(what + " failed (" + res.status + (msg ? ": " + msg : "") + ")"); e.status = res.status; throw e;
    }
    return {
        uid,
        async get(path) {
            const res = await fetchImpl(root + path, { headers });
            if (res.status === 404) return null;
            if (!res.ok) await fail(res, "Reading " + path);
            const doc = await res.json();
            return { data: decFields(doc.fields), updateTime: doc.updateTime };
        },
        /** The document ids in one collection (up to 1000), without reading their contents. */
        async list(collection) {
            const ids = []; let token = "";
            for (let i = 0; i < 4; i++) {
                const res = await fetchImpl(root + collection + "?pageSize=300&mask.fieldPaths=at" + (token ? "&pageToken=" + encodeURIComponent(token) : ""), { headers });
                if (res.status === 404) break;
                if (!res.ok) await fail(res, "Listing " + collection);
                const body = await res.json();
                (body.documents || []).forEach((d) => ids.push(d.name.split("/").pop()));
                token = body.nextPageToken || ""; if (!token) break;
            }
            return ids;
        },
        async put(path, data, updateTime) {
            const url = root + path + (updateTime ? "?currentDocument.updateTime=" + encodeURIComponent(updateTime) : "");
            const res = await fetchImpl(url, { method: "PATCH", headers, body: JSON.stringify({ fields: encFields(data) }) });
            if (!res.ok) {
                let body = null; try { body = await res.clone().json(); } catch { /* not JSON */ }
                if (updateTime && (res.status === 409 || res.status === 412 || body?.error?.status === "FAILED_PRECONDITION")) { const e = new Error("changed"); e.changed = true; throw e; }
                await fail(res, "Saving " + path);
            }
            const doc = await res.json();
            return { updateTime: doc.updateTime };
        },
    };
}
