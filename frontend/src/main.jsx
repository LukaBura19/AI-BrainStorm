import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/geist";
import "./styles/global.css";
import "./styles/effects.css";
import "./styles/dashboards.css";

// One passive listener powers every [data-spotlight] surface in the app.
window.addEventListener("pointermove", (event) => {
  const target = event.target instanceof Element ? event.target.closest("[data-spotlight]") : null;
  if (!target) return;
  const box = target.getBoundingClientRect();
  target.style.setProperty("--mx", `${event.clientX - box.left}px`);
  target.style.setProperty("--my", `${event.clientY - box.top}px`);
}, { passive: true });

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
