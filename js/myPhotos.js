/* ==========================================
   Anchor Board — the teacher's own background pictures (Board look > Photos > My pictures).
   A picture from the computer is shrunk on this device (at most 1920 px on its long side, about half a MB)
   and saved in the teacher's account as its own record, bgimg/<id>, the same way slide pictures are kept
   (slideimg/<id>). The list, with a small tile for each, is settings/mybg. A look that uses one has
   bg "my-<id>". Pictures never leave the teacher's account.
========================================== */
export const MY_MAX = 12;
const ID = /^my-[a-z0-9]{4,12}$/;
let getStore = null, list = [], listUn = null;
const subs = new Set(), cache = new Map(), live = new Map();
const okData = (d) => typeof d === "string" && d.length < 1200000 && /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(d);

export const isMine = (id) => typeof id === "string" && ID.test(id);
/** The saved pictures, newest first: [{ id, name, t (small tile), at }]. */
export const mineList = () => list;
/** Run fn whenever the list changes or a full picture arrives. Returns a function that stops it. */
export function onMine(fn) { subs.add(fn); return () => subs.delete(fn); }
const tell = () => subs.forEach((f) => { try { f(); } catch (e) { /* one page's redraw must not stop the rest */ } });

function cleanList(d) {
    const a = d && Array.isArray(d.items) ? d.items : [];
    return a.filter((x) => x && isMine(x.id) && okData(x.t)).slice(0, MY_MAX)
        .map((x) => ({ id: x.id, name: String(x.name || "My picture").slice(0, 40), t: x.t, at: +x.at || 0 }));
}
/** Called once by the board app with its store, so every page that shows the board can find the pictures. */
export function setPhotoStore(fn) {
    getStore = fn;
    if (listUn) { try { listUn(); } catch (e) { /* gone */ } }
    try { listUn = getStore().watch("settings/mybg", (snap) => { if (snap.pending) return; list = cleanList(snap.exists ? snap.data : null); tell(); }, () => {}); }
    catch (e) { listUn = null; }
}
/** The full picture's address, or "" while it loads (done() runs when it arrives). */
export function mineSrc(id) {
    if (!isMine(id)) return "";
    if (cache.has(id)) return cache.get(id);
    if (live.has(id) || !getStore) return "";
    let fin = false, un = null;
    try {
        un = getStore().watch("bgimg/" + id.slice(3), (snap) => {
            if (fin || snap.pending) return;
            if (!snap.exists && snap.fromCache) return;   // not on this device yet: wait for the server
            fin = true; const d = snap.exists && snap.data && okData(snap.data.d) ? snap.data.d : "";
            cache.set(id, d); setTimeout(() => { try { (live.get(id) || un)(); } catch (e) { /* gone */ } live.delete(id); }, 0); tell();
        }, () => {});
        if (!fin) live.set(id, un);
    } catch (e) { /* no store yet */ }
    return cache.get(id) || "";
}

function loadImg(file) { return new Promise((res) => { const u = URL.createObjectURL(file), im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = u; }); }
function draw(im, w, h, crop) {
    const c = document.createElement("canvas"); c.width = w; c.height = h; const ctx = c.getContext("2d");
    if (crop) {   // fill the tile like the board does (cover), centred
        const s = Math.max(w / im.naturalWidth, h / im.naturalHeight), dw = im.naturalWidth * s, dh = im.naturalHeight * s;
        ctx.drawImage(im, (w - dw) / 2, (h - dh) / 2, dw, dh);
    } else ctx.drawImage(im, 0, 0, w, h);
    return c;
}
const enc = (c, q) => { let d = c.toDataURL("image/webp", q); if (!/^data:image\/webp/.test(d)) d = c.toDataURL("image/jpeg", q); return d; };

/** Shrink and save a picture from the computer. Resolves { ok, id } or { ok: false, why }. */
export async function addMine(file) {
    if (!getStore) return { ok: false, why: "The board is still connecting. Try again in a moment." };
    if (!file || !/^image\//.test(file.type)) return { ok: false, why: "That file isn't a picture. Pick a JPG, PNG or WebP." };
    if (list.length >= MY_MAX) return { ok: false, why: "You have " + MY_MAX + " pictures saved. Delete one to add another." };
    const im = await loadImg(file); if (!im || !im.naturalWidth) return { ok: false, why: "That picture could not be read." };
    let side = 1920, q = 0.8, d = "", w = 0, h = 0;
    for (let i = 0; i < 6 && !d; i++) {
        const s = Math.min(1, side / Math.max(im.naturalWidth, im.naturalHeight)); w = Math.max(1, Math.round(im.naturalWidth * s)); h = Math.max(1, Math.round(im.naturalHeight * s));
        const x = enc(draw(im, w, h, false), q); if (x.length <= 720000) d = x; else { side = Math.round(side * 0.8); q = Math.max(0.5, q - 0.08); }
    }
    if (!d) return { ok: false, why: "That picture is too big to save. Try a smaller one." };
    const t = enc(draw(im, 480, 270, true), 0.72);
    const id = "my-" + (Date.now().toString(36) + Math.random().toString(36).slice(2, 5)).slice(-10);
    const name = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, 40) || "My picture";
    cache.set(id, d);
    try {
        await getStore().save("bgimg/" + id.slice(3), { d, w, h, at: Date.now() });
        const next = [{ id, name, t, at: Date.now() }].concat(list).slice(0, MY_MAX);
        await getStore().save("settings/mybg", { items: next, at: Date.now() });
        list = next; tell();
        return { ok: true, id };
    } catch (e) { cache.delete(id); return { ok: false, why: "The picture was not saved (" + ((e && e.code) || "connection") + ")." }; }
}
/** Take a picture off the list. Its record is emptied so it stops taking space. */
export async function removeMine(id) {
    if (!getStore || !isMine(id)) return false;
    const next = list.filter((x) => x.id !== id);
    try {
        await getStore().save("settings/mybg", { items: next, at: Date.now() });
        list = next; cache.delete(id); tell();
        getStore().save("bgimg/" + id.slice(3), { gone: true, at: Date.now() }).catch(() => {});
        return true;
    } catch (e) { return false; }
}
