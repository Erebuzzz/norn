import React from "react";
import ReactDOM from "react-dom/client";
import { ArenaApp } from "./ArenaApp.js";

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ArenaApp />
    </React.StrictMode>
  );
}
