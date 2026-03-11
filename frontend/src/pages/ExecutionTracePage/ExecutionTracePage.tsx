import { useNavigate } from 'react-router-dom';
import AppSidebar from '../../components/AppSidebar/AppSidebar';
import '../../components/AppSidebar/SharedSidebar.css';
import './ExecutionTracePage.css';

interface ExecutionTracePageProps {
  darkMode?: boolean;
  toggleDarkMode?: () => void;
}

const ExecutionTracePage: React.FC<ExecutionTracePageProps> = ({ darkMode, toggleDarkMode }) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/workspace');
  };

  const steps = [
    {
      id: 1,
      title: 'Initializing Agent',
      status: 'complete',
      time: '0.157s',
      detail: 'Model context and retrieval index initialized for current report scope.',
    },
    {
      id: 2,
      title: 'Accessing Statute Book',
      status: 'complete',
      time: '0.404s',
      detail: 'Primary statutes and linked references loaded with citation anchors.',
    },
    {
      id: 3,
      title: 'Synthesizing Section 12',
      status: 'running',
      time: '0.987s',
      detail: 'Cross-referencing obligations, precedents, and confidence adjustments.',
    },
    {
      id: 4,
      title: 'Sustainability Check',
      status: 'pending',
      time: '-',
      detail: 'Calculating final carbon estimate and optimization score.',
    },
  ];

  return (
    <div className="trace-page">
      <AppSidebar activeItem="workspace" darkMode={darkMode} toggleDarkMode={toggleDarkMode} />

      <main className="trace-main">
        <header className="trace-header">
          <div className="trace-header-main">
            <button className="trace-back-btn" onClick={handleBack}>← Back</button>
            <div>
              <h1>Execution Trace</h1>
              <p>Technical execution stages and system-level diagnostics.</p>
            </div>
          </div>
          <div className="metrics">
            <div className="metric-pill">Total: 1.248s</div>
            <div className="metric-pill">CO₂: 0.168g</div>
          </div>
        </header>

        <section className="trace-summary-grid">
          <div className="trace-summary-card">
            <span>Stages</span>
            <strong>4</strong>
            <p>2 complete · 1 running · 1 pending</p>
          </div>
          <div className="trace-summary-card">
            <span>Documents</span>
            <strong>847</strong>
            <p>Across statutes, precedent, and commentary</p>
          </div>
          <div className="trace-summary-card">
            <span>Trust Score</span>
            <strong>98.4%</strong>
            <p>High confidence synthesis</p>
          </div>
        </section>

        <div className="trace-content">
          <section className="trace-timeline">
            <h2>Execution Stages</h2>
            {steps.map((step) => (
              <article key={step.id} className={`trace-node ${step.status}`}>
                <div className="trace-node-left">
                  <div className="trace-node-index">{step.id}</div>
                  <div className={`trace-node-line ${step.status}`}></div>
                </div>

                <div className="trace-node-body">
                  <div className="node-header">
                    <span className={`node-status ${step.status}`}>{step.status}</span>
                    <span className="node-time">{step.time}</span>
                  </div>
                  <h3>{step.title}</h3>
                  <p>{step.detail}</p>
                </div>
              </article>
            ))}
          </section>

          <aside className="trace-inspector">
            <h3>Technical Inspector</h3>
            <div className="code-box">
              <pre>{`{
  "agent_id": "propylon-vm-a9-3",
  "latency_ms": 589.22,
  "retrieval_hits": 847,
  "confidence": 0.984
}`}</pre>
            </div>

            <div className="impact-box">
              <h4>Carbon Impact</h4>
              <p className="impact-value">0.168g</p>
              <span className="impact-change">↓42%</span>
            </div>

            <div className="impact-box">
              <h4>Routing</h4>
              <p className="impact-value route">NVIDIA NIM</p>
              <span className="impact-change neutral">LangGraph Orchestrated</span>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
};

export default ExecutionTracePage;