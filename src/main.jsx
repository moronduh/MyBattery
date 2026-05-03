import React from "react";
import ReactDOM from "react-dom/client";
import App from "../../mindful-productivity.jsx";
import { requestNotificationPermission, onForegroundMessage } from "./firebase.js";

const firebaseHelpers = { requestNotificationPermission, onForegroundMessage };

ReactDOM.createRoot(document.getElementById("root")).render(
  <App firebaseHelpers={firebaseHelpers} />
);
