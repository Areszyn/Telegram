import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const tg = (window as any).Telegram?.WebApp;
if (tg) {
  try { tg.ready(); } catch (_) {}
  try { tg.expand(); } catch (_) {}
}

try {
  createRoot(document.getElementById("root")!).render(<App />);
} catch (e) {
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;padding:24px;text-align:center;">
      <div><p style="color:#ff6b6b;font-size:14px;font-family:Inter,system-ui,sans-serif;">Something went wrong</p>
      <p style="color:rgba(255,255,255,0.4);font-size:12px;font-family:monospace;margin-top:8px;">${e instanceof Error ? e.message : String(e)}</p>
      <button onclick="location.reload()" style="margin-top:16px;padding:8px 20px;background:#fff;color:#000;border:none;border-radius:8px;font-size:13px;cursor:pointer;">Reload</button></div></div>`;
  }
}
