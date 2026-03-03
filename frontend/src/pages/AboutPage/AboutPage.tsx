import { useNavigate } from 'react-router-dom';
import './AboutPage.css';

const AboutPage = () => {
  const navigate = useNavigate();

  return (
    <div className="about-page">
      <nav className="nav">
        <h2 onClick={() => navigate('/')}>RWS Propylon</h2>
        <div>
          <a href="#mission">Mission</a>
          <a href="#team">Team</a>
          <button className="btn btn-primary" onClick={() => navigate('/workspace')}>
            Get Started
          </button>
        </div>
      </nav>

      <section className="hero">
        <h1>Building the Future of Legal Research</h1>
        <p>AI-powered research platform built for transparency and trust</p>
      </section>

      <section id="mission" className="mission">
        <h2>Our Mission</h2>
        <div className="mission-grid">
          <div className="mission-card">
            <h3>Transparency First</h3>
            <p>Every AI decision is traceable. Every citation is verifiable.</p>
          </div>
          <div className="mission-card">
            <h3>Trust & Accuracy</h3>
            <p>96.8% average confidence across all research queries.</p>
          </div>
          <div className="mission-card">
            <h3>Sustainable AI</h3>
            <p>Carbon-neutral operations with renewable energy.</p>
          </div>
        </div>
      </section>

      <section id="team" className="team">
        <h2>Meet Our Team</h2>
        <div className="team-grid">
          <div className="team-card">
            <div className="avatar">SC</div>
            <h3>Member 1</h3>
            <p>Project Lead</p>
          </div>
          <div className="team-card">
            <div className="avatar">MO</div>
            <h3>Member 2</h3>
            <p>Backend Lead</p>
          </div>
          <div className="team-card">
            <div className="avatar">ER</div>
            <h3>Member 3</h3>
            <p> Frontend Lead</p>
          </div>
          <div className="team-card">
            <div className="avatar">JP</div>
            <h3>Member 4</h3>
            <p> UI/UX Designer</p>
          </div>
        </div>
      </section>

      <section className="cta">
        <h2>Ready to Transform Your Legal Research?</h2>
        <button className="btn btn-primary" onClick={() => navigate('/workspace')}>
          Start Free Trial
        </button>
      </section>

      <footer>
        <div>
          <h3>RWS Propylon</h3>
          <p>© 2026 All rights reserved</p>
        </div>
        <div className="footer-links">
          <a href="#" onClick={() => navigate('/workspace')}>Workspace</a>
          <a href="#" onClick={() => navigate('/history')}>History</a>
          <a href="#">Privacy</a>
        </div>
      </footer>
    </div>
  );
};

export default AboutPage;