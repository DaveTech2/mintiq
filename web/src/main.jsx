import "./polyfills.js";
import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

// Load the app after polyfills so wallet modules see Buffer/process.
import("./App.jsx").then(({ default: App }) => {
  createRoot(document.getElementById("root")).render(<App />);
  const s = document.getElementById("splash");
  if (s) { s.style.opacity = "0"; setTimeout(() => s.remove(), 320); }
});
