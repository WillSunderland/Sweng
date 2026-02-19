import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/LoginPage.css';

const LoginPage = () => {
  const navigate = useNavigate();

  return (
    <div className="login-page">
      <div className="login-placeholder">
        <h1>Login Page</h1>
        <p>Coming soon </p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          Back to Home
        </button>
      </div>
    </div>
  );
};

export default LoginPage;