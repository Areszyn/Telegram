import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Initialize Telegram WebApp properties
const tg = (window as any).Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  if (tg.isExpanded === false) {
    tg.expand();
  }
}

createRoot(document.getElementById("root")!).render(<App />);
