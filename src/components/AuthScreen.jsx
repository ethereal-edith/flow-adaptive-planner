import React, { useState } from 'react';
import { LogIn, UserPlus } from 'lucide-react';
import { getSupabaseClient } from '../data/storage';

export default function AuthScreen() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage(null);
    setIsSubmitting(true);

    try {
      const client = getSupabaseClient();
      if (!client) throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before building.');
      const result = mode === 'login'
        ? await client.auth.signInWithPassword({ email, password })
        : await client.auth.signUp({ email, password });
      if (result.error) throw result.error;
      setMessage(mode === 'login' ? 'Signed in.' : 'Account created. Check your email if confirmation is enabled.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#FFF9F7] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-[#F3EAE7] bg-white shadow-soft-lg p-7">
        <div className="mb-7">
          <div className="w-11 h-11 rounded-2xl bg-[#F8C8DC] flex items-center justify-center mb-4">
            <span className="font-logo text-3xl text-[#3E3A3F]">f</span>
          </div>
          <h1 className="text-2xl font-heading font-bold text-[#3E3A3F]">Welcome to Flow</h1>
          <p className="text-sm text-[#857C82] mt-1">Your realistic, adaptive planner.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#5C5257] mb-1.5">Email</label>
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full text-sm bg-[#FFF9F7] border border-[#EEDCD7] rounded-2xl px-4 py-3 text-[#3E3A3F] focus:outline-none focus:border-[#F8C8DC]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#5C5257] mb-1.5">Password</label>
            <input
              required
              minLength={6}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full text-sm bg-[#FFF9F7] border border-[#EEDCD7] rounded-2xl px-4 py-3 text-[#3E3A3F] focus:outline-none focus:border-[#F8C8DC]"
            />
          </div>
          {message && <p className="text-xs text-[#825742]">{message}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 rounded-full bg-[#F8C8DC] hover:bg-[#F2ADC5] disabled:opacity-50 px-5 py-3 text-sm font-semibold text-[#3E3A3F]"
          >
            {mode === 'login' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
            {mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMessage(null); }}
          className="w-full mt-4 text-xs text-[#7E6596] hover:text-[#554366]"
        >
          {mode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Log in'}
        </button>
      </div>
    </main>
  );
}
