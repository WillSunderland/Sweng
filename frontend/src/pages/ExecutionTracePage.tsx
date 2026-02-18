import { useNavigate} from 'react-router-dom';
import '../styles/ExecutionTracePage.css';

const ExecutionTracePage = () => {
  const navigate = useNavigate();

  const steps = [
    { id: 1, title: "INITIALIZING AGENT", status: "complete", time: "0.157s" },
    { id: 2, title: "ACCESSING STATUTE BOOK", status: "complete", time: "0.404s" },
    { id: 3, title: "SYNTHESIZING SECTION 12", status: "running", time: "0.987s" },
    { id: 4, title: "SUSTAINABILITY CHECK", status: "pending", time: "-" }
  ];

  return (
    <div className="trace-page">
      <header className="trace-header">
        <div>
          <button onClick={() => navigate('/workspace')}>← Back</button>
          <h1>Execution Trace</h1>
        </div>
        <div className="metrics">
          <span>Total: 1.248s</span>
          <span>CO₂: 0.168g</span>
        </div>
      </header>

      <div className="trace-content">
        <div className="trace-graph">
          {steps.map(step => (
            <div key={step.id} className={`trace-node ${step.status}`}>
              <div className="node-header">
                <span className="node-status">{step.status}</span>
                <span className="node-time">{step.time}</span>
              </div>
              <h3>{step.title}</h3>
            </div>
          ))}
        </div>

        <aside className="trace-inspector">
          <h3>Technical Inspector</h3>
          <div className="code-box">
            <pre>{`{
  "agent_id": "propylon-vm-a9-3",
  "latency_ms": 589.22
}`}</pre>
          </div>
          <div className="impact-box">
            <h4>Carbon Impact</h4>
            <p className="impact-value">0.168g</p>
            <span className="impact-change">↓42%</span>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default ExecutionTracePage;