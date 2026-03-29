import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Scale, Loader2 } from 'lucide-react';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise(r => setTimeout(r, 1000));
    navigate('/workspace');
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg-gray-50)' }}>
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="bg-white border border-gray-200 rounded-2xl p-10 w-full max-w-sm shadow-lg"
      >
        <div className="flex flex-col items-center mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: 'var(--primary-blue)' }}>
            <Scale size={20} className="text-white" />
          </div>
          <span className="font-bold text-lg text-gray-900">RWS Propylon</span>
        </div>

        <h2 className="text-xl font-bold text-gray-900 text-center mb-6">Create your account</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { key: 'name', placeholder: 'Full Name', type: 'text' },
            { key: 'email', placeholder: 'Email address', type: 'email' },
          ].map(f => (
            <input
              key={f.key}
              type={f.type}
              placeholder={f.placeholder}
              value={form[f.key as keyof typeof form]}
              onChange={set(f.key as keyof typeof form)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          ))}
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              placeholder="Password"
              value={form.password}
              onChange={set('password')}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 pr-11 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <button type="button" onClick={() => setShowPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <input
            type="password"
            placeholder="Confirm Password"
            value={form.confirm}
            onChange={set('confirm')}
            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />

          <motion.button
            type="submit"
            whileHover={{ scale: 1.01, boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }}
            whileTap={{ scale: 0.98 }}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 text-white font-semibold rounded-lg"
            style={{ background: 'var(--primary-blue)', height: 48 }}
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? 'Creating…' : 'Create Account'}
          </motion.button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="font-medium hover:underline" style={{ color: 'var(--primary-blue)' }}>
            Sign In
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
