import React from "react";
import ReactDOM from "react-dom";
import "./index.css";
import "./styles.scss";
import {AppContextWrapper} from "./AppContextWrapper";

const rootElement = document.getElementById("root");
if (rootElement && rootElement.hasChildNodes()) {
  ReactDOM.hydrate(
    <React.StrictMode>
      <AppContextWrapper />
    </React.StrictMode>,
    rootElement
  );
} else {
  ReactDOM.render(
    <React.StrictMode>
      <AppContextWrapper />
    </React.StrictMode>,
    rootElement
  );
}
