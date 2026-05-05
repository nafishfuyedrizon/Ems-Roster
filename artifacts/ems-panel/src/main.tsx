import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Intercept all fetch calls to add admin identity header automatically
const _fetch = window.fetch.bind(window);
window.fetch = (input, init = {}) => {
  const identity = localStorage.getItem("admin_identity");
  const role = localStorage.getItem("admin_role");
  if (identity) {
    const headers = new Headers(init.headers);
    headers.set("X-Admin-Identity", identity);
    if (role) headers.set("X-Admin-Role", role);
    init.headers = headers;
  }
  return _fetch(input, init);
};

createRoot(document.getElementById("root")!).render(<App />);
