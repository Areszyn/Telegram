import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const tg = (window as any).Telegram?.WebApp;
if (tg) {
  try { tg.ready(); } catch (_) {}
  try { tg.expand(); } catch (_) {}
}

function showFatalError(msg: string) {
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = `<div style="position:fixed;inset:0;z-index:99999;background:var(--tg-theme-bg-color,hsl(240 5% 10%));display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;">
      <div><p style="color:#ff6b6b;font-size:14px;font-family:Inter,system-ui,sans-serif;">Something went wrong</p>
      <p style="color:rgba(255,255,255,0.4);font-size:12px;font-family:monospace;margin-top:8px;max-width:300px;word-break:break-word;">${msg}</p>
      <button onclick="location.reload()" style="margin-top:16px;padding:8px 20px;background:#fff;color:#000;border:none;border-radius:8px;font-size:13px;cursor:pointer;">Reload</button></div></div>`;
  }
}

window.addEventListener("error", (e) => {
  if (e.message) showFatalError(e.message);
});
window.addEventListener("unhandledrejection", (e) => {
  const msg = e.reason instanceof Error ? e.reason.message : String(e.reason);
  showFatalError(msg);
});

try {
  createRoot(document.getElementById("root")!).render(<App />);
} catch (e) {
  showFatalError(e instanceof Error ? e.message : String(e));
}
