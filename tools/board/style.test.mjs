// Panel styles (js/panelStyle.js): the math tools and calculators open in "Match board"; a teacher can still pick
// any look, the plain paper look included, and "Back to Match board" clears it. Run: node tools/board/style.test.mjs
import assert from "node:assert/strict";
import { MATCH_BOARD, PANEL_PRESETS, cleanSty, styToSave, styShown } from "../../js/panelStyle.js";
import { mergeTools } from "../../js/boardTools.js";

let n = 0; const t = (name, fn) => { try { fn(); n++; } catch (e) { console.error("FAIL", name); throw e; } };
const plain = { c: "paper", f: "solid", o: 100, r: "soft" };

t("Match board is the Match board quick look", () => { const p = PANEL_PRESETS.find((x) => x[0] === "Match board"); assert.deepEqual([p[1], p[2], p[3]], [MATCH_BOARD.c, MATCH_BOARD.f, MATCH_BOARD.o]); });
t("a math tool with nothing saved shows Match board", () => assert.deepEqual(styShown(undefined, MATCH_BOARD), MATCH_BOARD));
t("a quick tool with nothing saved stays plain", () => assert.equal(styShown(undefined, null), null));
t("picking Match board on a math tool saves nothing", () => assert.equal(styToSave(MATCH_BOARD, MATCH_BOARD), null));
t("picking plain on a math tool is kept", () => { const s = styToSave(plain, MATCH_BOARD); assert.equal(s.p, 1); assert.equal(styShown(s, MATCH_BOARD).c, "paper"); });
t("picking plain on a quick tool saves nothing", () => assert.equal(styToSave(plain, null), null));
t("another look is saved as it was", () => assert.deepEqual(styToSave({ c: "sky", f: "glass", o: 60, r: "round" }, MATCH_BOARD), { c: "sky", f: "glass", o: 60, r: "round" }));
t("Match board on a quick tool is saved", () => assert.deepEqual(styToSave(MATCH_BOARD, null), MATCH_BOARD));
t("old saved styles read the same", () => { assert.equal(cleanSty(plain), null); assert.deepEqual(cleanSty({ c: "board", f: "grad", o: 92, r: "soft" }), MATCH_BOARD); });
t("the board state keeps a picked plain look", () => { const T = mergeTools({ v: 2, sty: { pyth: { ...plain, p: 1 }, ptimer: { ...plain, p: 1 } } }); assert.equal(T.sty.pyth.p, 1); assert.ok(T.sty.ptimer); });
console.log("style: " + n + " checks pass");
