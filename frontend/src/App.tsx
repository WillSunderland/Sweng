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

function App() {
  const [darkMode, setDarkMode] = useState(localStorage.getItem("theme") === "dark");
  const toggleDarkMode = () => setDarkMode(!darkMode);

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
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/workspace" element={<WorkspacePage darkMode={darkMode} toggleDarkMode={toggleDarkMode} />} />
        <Route path="/report/:id" element={<ReportViewPage darkMode={darkMode} toggleDarkMode={toggleDarkMode} />} />
        <Route path="/trace/:id" element={<ExecutionTracePage darkMode={darkMode} toggleDarkMode={toggleDarkMode} />} />
        <Route path="/analysis/:id" element={<AnalysisPage darkMode={darkMode} toggleDarkMode={toggleDarkMode} />} />
        <Route path="/history" element={<HistoryPage darkMode={darkMode} toggleDarkMode={toggleDarkMode} />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/ai-agent" element={<AIagentPage darkMode={darkMode} toggleDarkMode={toggleDarkMode} />} />
      </Routes>
    </Router>
  );
}

export default App;