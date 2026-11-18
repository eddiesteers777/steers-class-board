/* ==========================================
   Focal — styles for the shared feedback pieces (js/ui.js toasts and dialogs, js/netStatus.js connection pill).
   They used to live in the old site-wide style.css, which is gone; injecting them here keeps every page that
   shows a toast or dialog styled, whatever stylesheet the page itself loads.
========================================== */
const CSS = `
.school-toast-host{position:fixed;left:50%;bottom:24px;z-index:6000;display:flex;flex-direction:column;align-items:center;gap:8px;width:min(440px,calc(100vw - 32px));transform:translateX(-50%);pointer-events:none}
body.school-net-on .school-toast-host{bottom:80px}
.school-toast{display:flex;align-items:flex-start;gap:10px;width:100%;box-sizing:border-box;padding:12px 16px;background:#0E1B3A;color:#fff;border-radius:14px;box-shadow:0 14px 36px rgba(14,27,58,.32);font:600 14.5px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;pointer-events:auto;cursor:pointer;opacity:0;transform:translateY(12px);transition:opacity .2s ease,transform .2s ease}
.school-toast.is-in{opacity:1;transform:none}
.school-toast-text{flex:1}
.school-toast-icon{flex-shrink:0;display:flex;margin-top:2px;color:#8FB0EE}
.school-toast-icon svg{width:18px;height:18px}
.school-toast.is-success .school-toast-icon{color:#5BD39A}
.school-toast.is-error{background:#7A1620}
.school-toast.is-error .school-toast-icon{color:#FFB4B4}
.school-toast-action{flex-shrink:0;margin:-4px -6px -4px 4px;padding:5px 12px;background:transparent;border:1.5px solid rgba(255,255,255,.55);border-radius:999px;color:#fff;font:700 13.5px system-ui,sans-serif;cursor:pointer}
.school-toast-action:focus-visible,.school-btn:focus-visible,.school-net-action:focus-visible,.school-net-close:focus-visible{outline:3px solid #8FB0EE;outline-offset:2px}
.school-net{position:fixed;left:50%;bottom:24px;z-index:6000;display:flex;align-items:center;gap:10px;max-width:min(460px,calc(100vw - 32px));box-sizing:border-box;padding:9px 14px;background:#0E1B3A;color:#fff;border-radius:999px;box-shadow:0 12px 30px rgba(14,27,58,.3);font:600 13.5px/1.35 system-ui,sans-serif;opacity:0;transform:translate(-50%,12px);pointer-events:none;transition:opacity .2s ease,transform .2s ease}
.school-net.is-on{opacity:1;transform:translate(-50%,0);pointer-events:auto}
.school-net-dot{flex:0 0 8px;width:8px;height:8px;border-radius:50%;background:#F2B33D}
.school-net-text{flex:1}
.school-net-action{background:#fff;color:#0E1B3A;border:0;border-radius:999px;padding:5px 12px;font:700 13px system-ui,sans-serif;cursor:pointer}
.school-net-close{background:transparent;color:#fff;border:0;font-size:18px;line-height:1;cursor:pointer;padding:2px 4px}
.school-dialog{width:min(420px,calc(100vw - 32px));max-height:calc(100dvh - 48px);margin:auto;padding:22px;border:0;border-radius:16px;background:#fff;color:#0E1B3A;box-shadow:0 24px 60px rgba(14,27,58,.3);font:15px/1.45 system-ui,sans-serif;box-sizing:border-box}
.school-dialog::backdrop{background:rgba(14,27,58,.45)}
.school-dialog-title{margin:0 0 8px;font-size:1.15rem;font-weight:700}
.school-dialog-message{margin:0 0 16px;color:#55627F}
.school-dialog-input{width:100%;box-sizing:border-box;min-height:44px;border:1.5px solid #D5DCE9;border-radius:10px;padding:8px 10px;font:inherit;margin-bottom:14px}
.school-dialog-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px}
.school-btn{min-height:42px;padding:8px 16px;border-radius:10px;border:1.5px solid #D5DCE9;background:#fff;color:#0E1B3A;font:700 14px system-ui,sans-serif;cursor:pointer}
.school-btn-primary{background:#10358A;border-color:#10358A;color:#fff}
.school-btn-danger{background:#B4232A;border-color:#B4232A;color:#fff}
.school-btn-tertiary{border-color:transparent}
.school-empty{text-align:center;padding:28px 16px;color:#55627F}
.school-empty-title{font-weight:700;color:#0E1B3A;margin:6px 0 4px}
.school-loading,.school-skeleton{color:#55627F}
@media (prefers-reduced-motion:reduce){.school-toast,.school-net{transition:none}}
`;
export function ensureUiStyles() {
    if (typeof document === "undefined" || document.getElementById("school-ui-css")) return;
    const s = document.createElement("style"); s.id = "school-ui-css"; s.textContent = CSS; document.head.appendChild(s);
}
