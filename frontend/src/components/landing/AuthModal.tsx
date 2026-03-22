import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../constants/apiConfig';
import eye from '../../assets/closedEye.png';
import eyeOff from '../../assets/openEye.png';

type AuthView = 'login' | 'register';

interface AuthModalProps {
  view: AuthView;
  onClose: () => void;
  onSwitchView: (view: AuthView) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ view, onClose, onSwitchView }) => {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div
        className="relative bg-white w-[440px] rounded-2xl shadow-2xl p-8 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {view === 'login' ? (
          <LoginForm onSwitchView={onSwitchView} onClose={onClose} />
        ) : (
          <RegisterForm onSwitchView={onSwitchView} onClose={onClose} />
        )}
      </div>
    </div>
  );
};

interface FormProps {
  onSwitchView: (view: AuthView) => void;
  onClose: () => void;
}

const LoginForm: React.FC<FormProps> = ({ onSwitchView, onClose }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) throw new Error('Invalid credentials');

      const data = await res.json();
      localStorage.setItem('token', data.token);
      onClose();
      navigate('/workspace');
    } catch {
      setError('Email or password incorrect');
    }
  }

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      {error && <p className="text-red-500 text-sm text-center">{error}</p>}

      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
          Email Address
        </label>
        <input
          type="email"
          placeholder="legal.professional@firm.com"
          className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div>
        <div className="flex justify-between items-center mb-1">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Password
          </label>
          <span className="text-xs text-blue-600 cursor-pointer hover:underline">
            Forgot Password?
          </span>
        </div>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="········"
            className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {password.length > 0 && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 opacity-70 hover:opacity-100"
            >
              <img src={showPassword ? eyeOff : eye} alt="toggle password" className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold text-sm transition">
        Sign In
      </button>

      <p className="text-center text-sm text-slate-500">
        Don't have an account?{' '}
        <button
          type="button"
          onClick={() => onSwitchView('register')}
          className="text-blue-600 font-semibold hover:underline"
        >
          Create Account
        </button>
      </p>
    </form>
  );
};

const RegisterForm: React.FC<FormProps> = ({ onSwitchView, onClose }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    onClose();
    navigate('/workspace');
  }

  return (
    <form onSubmit={handleRegister} className="space-y-4">
      {error && <p className="text-red-500 text-sm text-center">{error}</p>}

      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
          Email Address
        </label>
        <input
          type="email"
          placeholder="legal.professional@firm.com"
          className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
          Password
        </label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="········"
            className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {password.length > 0 && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 opacity-70 hover:opacity-100"
            >
              <img src={showPassword ? eyeOff : eye} alt="toggle password" className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
          Confirm Password
        </label>
        <div className="relative">
          <input
            type={showConfirm ? 'text' : 'password'}
            placeholder="········"
            className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          {confirmPassword.length > 0 && (
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 opacity-70 hover:opacity-100"
            >
              <img src={showConfirm ? eyeOff : eye} alt="toggle password" className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold text-sm transition">
        Create Account
      </button>

      <p className="text-center text-sm text-slate-500">
        Already have an account?{' '}
        <button
          type="button"
          onClick={() => onSwitchView('login')}
          className="text-blue-600 font-semibold hover:underline"
        >
          Sign In
        </button>
      </p>
    </form>
  );
};
