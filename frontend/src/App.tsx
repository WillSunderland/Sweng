import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage/LandingPage';
import WorkspacePage from './pages/Workspacepage/Workspacepage';
import ReportViewPage from './pages/ReportViewPage/ReportViewPage';
import ExecutionTracePage from './pages/ExecutionTracePage/ExecutionTracePage';
import AnalysisPage from './pages/AnalysisPage/AnalysisPage';
import HistoryPage from './pages/HistoryPage/HistoryPage';
import AboutPage from './pages/AboutPage/AboutPage';
import Login from "./pages/Login/Login";
import Register from "./pages/Register/Register";
import AIagentPage from "./pages/AIagentPage/AIagentPage";
import './App.css';
import darkModeMoon from "./assets/darkModeMoon.png";
import lightModeSun from "./assets/lighModeSun.png";

function App() {
  const [darkMode, setDarkMode] = useState(
    localStorage.getItem("theme") === "dark"
  );

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  return (
    <Router>
      <button
  onClick={() => setDarkMode(!darkMode)}
  style={{
    position: "fixed",
    top: 700,
    right: 40,
    zIndex: 99999,
    width: "56px",
    height: "28px",
    borderRadius: "999px",
    border: "none",
    cursor: "pointer",
    padding: 0,
    background: darkMode ? "#3b82f6" : "#e2e8f0",
    transition: "background 0.3s ease",
    display: "flex",
    alignItems: "center",
  }}
>
  <span style={{
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "22px",
    height: "22px",
    borderRadius: "50%",
    background: "white",
    transform: darkMode ? "translateX(30px)" : "translateX(3px)",
    transition: "transform 0.3s ease",
    fontSize: "12px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
  }}>
   {darkMode ? (
  <img src={lightModeSun} width="24" />
) : (
  <img src={darkModeMoon} width="24" />
)}
  </span>
</button>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/workspace" element={<WorkspacePage />} />
        <Route path="/report/:id" element={<ReportViewPage />} />
        <Route path="/trace/:id" element={<ExecutionTracePage />} />
        <Route path="/analysis/:id" element={<AnalysisPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/ai-agent" element={<AIagentPage />} />
      </Routes>
    </Router>
  );
}

export default App;
