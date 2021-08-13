import React from "react";
import ReactDOM from "react-dom";
import "./index.css";
import "./styles.scss";
import App from "./App";

const rootElement = document.getElementById("root");
if (rootElement && rootElement.hasChildNodes()) {
  ReactDOM.hydrate(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
    rootElement
  );
} else {
  ReactDOM.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
    rootElement
  );
}
