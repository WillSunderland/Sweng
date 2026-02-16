<<<<<<< HEAD
=======
import React from 'react';
>>>>>>> 89f298109 (Add all page components for frontend)
import { useNavigate } from 'react-router-dom';
import '../styles/LandingPage.css';

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="landing-page">
      
      {/* Header */}
      <header className="nav">
        <h2>RWS Propylon</h2>
        <div>
          <button
            className="btn btn-secondary"
            onClick={() => navigate('/login')}
          >
            Sign In
          </button>

          <button
            className="btn btn-primary"
<<<<<<< HEAD
            onClick={() => navigate('/register')}
=======
            onClick={() => navigate('/login')}
>>>>>>> 89f298109 (Add all page components for frontend)
          >
            Get Started
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero">
        <h1>AI-native Legal Research Platform</h1>

        <button
          className="btn btn-primary"
          onClick={() => navigate('/workspace')}
        >
          Go to Workspace
        </button>
      </section>

      {/* Footer */}
      <footer>
        <p>© 2026 RWS Propylon</p>
        <button onClick={() => navigate('/about')}>
          About
        </button>
      </footer>

    </div>
  );
};

export default LandingPage;
