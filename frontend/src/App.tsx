import React from 'react';
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
  return (
    <Router>
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
