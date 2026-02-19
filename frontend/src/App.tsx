import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import WorkspacePage from './pages/Workspacepage';
import ReportViewPage from './pages/ReportViewPage';
import ExecutionTracePage from './pages/ExecutionTracePage';
import AnalysisPage from './pages/AnalysisPage';
import HistoryPage from './pages/HistoryPage';
import AboutPage from './pages/AboutPage';
import Login from "./pages/Login";
import Register from "./pages/Register";
import AIagentPage from "./pages/AIagentPage";
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
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