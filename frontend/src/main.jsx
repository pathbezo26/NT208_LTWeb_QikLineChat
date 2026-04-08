
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LoginPage from "./Login";
import ChatPage from "./App";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/chat" element={<App />} />
    </Routes>
  </BrowserRouter>
);
