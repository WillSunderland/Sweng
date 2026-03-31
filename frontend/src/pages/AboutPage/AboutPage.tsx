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
            <p>High-confidence results validated against primary legislative sources.</p>
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
            <h3>Sean Collins</h3>
            <p>Project Lead</p>
          </div>
          <div className="team-card">
            <div className="avatar">MO</div>
            <h3>Mark O'Brien</h3>
            <p>Backend Lead</p>
          </div>
          <div className="team-card">
            <div className="avatar">ER</div>
            <h3>Emma Ryan</h3>
            <p>Frontend Lead</p>
          </div>
          <div className="team-card">
            <div className="avatar">JP</div>
            <h3>James Power</h3>
            <p>UI/UX Designer</p>
          </div>
        </div>
      </section>

      <section className="cta">
        <h2>Ready to Transform Your Legal Research?</h2>
        <button className="btn btn-primary" onClick={() => navigate('/workspace')}>
          Start Free Trial
        </button>
      </section>

      <section className="mission" id="privacy">
        <h2>Privacy Policy</h2>
        <p>
          We process account and usage data only for platform operation, security monitoring, and
          service improvement. Sensitive legal content is handled under role-based access controls
          and encrypted transport.
        </p>
      </section>

      <section className="mission" id="terms">
        <h2>Terms of Service</h2>
        <p>
          The platform supports legal research workflows and does not replace professional legal
          advice. Users are responsible for final review of outputs before operational use.
        </p>
      </section>

      <section className="mission" id="accessibility">
        <h2>Accessibility</h2>
        <p>
          We aim for accessible navigation, semantic structure, and keyboard-friendly interactions
          across core workflows, including research, report, and trace pages.
        </p>
      </section>

      <section className="mission" id="security">
        <h2>Security</h2>
        <p>
          Authentication is token-based, audit logging is enabled for critical flows, and the
          platform supports enterprise deployment controls for data governance.
        </p>
      </section>

      <footer>
        <div>
          <h3>RWS Propylon</h3>
          <p>© 2026 All rights reserved</p>
        </div>
        <div className="footer-links">
          <a href="/workspace">Workspace</a>
          <a href="/history">History</a>
          <a href="/about#privacy">Privacy</a>
        </div>
      </footer>
    </div>
  );
};

export default AboutPage;