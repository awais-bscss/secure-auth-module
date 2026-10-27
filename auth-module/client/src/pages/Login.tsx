import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User as UserIcon, Lock, AlertCircle } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { AppError } from '../api/errors';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, status, sessionExpiredMessage, clearSessionExpiredMessage } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';

  // Redirect away if already logged in
  useEffect(() => {
    if (status === 'authenticated') {
      navigate('/dashboard', { replace: true });
    }
  }, [status, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    clearSessionExpiredMessage();

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof AppError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to sign in. Please verify your credentials.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const fillCredentials = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setErrorMessage(null);
    clearSessionExpiredMessage();
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[#2353cf]">
      {/* Card */}
      <div className="w-full max-w-xl bg-[#2353cf] rounded-md p-6 sm:p-10 text-white">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-[0.14em] uppercase text-white">
            Enterprise Access
          </h1>
        </div>

        {/* Content Container */}
        <div className="max-w-md mx-auto space-y-4">
          
          {/* Expiry Alert */}
          {sessionExpiredMessage && (
            <div className="p-3 bg-amber-500/20 border border-amber-300/40 rounded-md flex items-center gap-2.5 text-amber-100 text-xs font-medium">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-200" />
              <span>{sessionExpiredMessage}</span>
            </div>
          )}

          {/* Error Alert */}
          {errorMessage && (
            <div className="p-3 bg-rose-500/25 border border-rose-300/40 rounded-md flex items-center gap-2.5 text-rose-100 text-xs font-medium">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-200" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username / Email */}
            <div className="relative flex items-center border border-white/60 focus-within:border-white rounded-md bg-[#2353cf] transition">
              <div className="pl-3.5 pr-2 text-white/80">
                <UserIcon className="w-4 h-4" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="USERNAME / EMAIL"
                required
                className="w-full py-2.5 pr-3.5 bg-transparent text-white placeholder-white/60 text-xs sm:text-sm tracking-wide focus:outline-none"
              />
            </div>

            {/* Password */}
            <div className="relative flex items-center border border-white/60 focus-within:border-white rounded-md bg-[#2353cf] transition">
              <div className="pl-3.5 pr-2 text-white/80">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="PASSWORD"
                required
                className="w-full py-2.5 pr-3.5 bg-transparent text-white placeholder-white/60 text-xs sm:text-sm tracking-wide focus:outline-none"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-white hover:bg-slate-100 disabled:opacity-60 disabled:cursor-not-allowed text-[#2353cf] font-bold text-xs sm:text-sm tracking-wider uppercase rounded-md transition duration-150 shadow-sm flex items-center justify-center gap-2 mt-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-[#2353cf] border-t-transparent rounded-full animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                'LOGIN'
              )}
            </button>

            {/* Forgot password */}
            <div className="flex justify-end mt-3 mb-5">
              <span className="text-sm font-normal text-white/90 hover:text-white cursor-pointer transition">
                Forgot password?
              </span>
            </div>
          </form>

          {/* Quick Demo Accounts */}
          <div className="pt-5 border-t border-white/20">
            <p className="text-[11px] font-semibold text-white/80 mb-3 text-center uppercase tracking-widest">
              Quick Fill Demo Accounts
            </p>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => fillCredentials('admin@example.com', 'Admin@123')}
                className="px-2 py-2.5 bg-[#1b43b8] hover:bg-[#15379b] border border-white rounded-md text-center transition group shadow-sm"
              >
                <div className="text-[13px] font-medium text-white group-hover:scale-105 transition-transform">
                  Admin
                </div>
                <div className="text-[11px] text-white/85">Full Access</div>
              </button>
              <button
                type="button"
                onClick={() => fillCredentials('manager@example.com', 'Manager@123')}
                className="px-2 py-2.5 bg-[#1b43b8] hover:bg-[#15379b] border border-white rounded-md text-center transition group shadow-sm"
              >
                <div className="text-[13px] font-medium text-white group-hover:scale-105 transition-transform">
                  Manager
                </div>
                <div className="text-[11px] text-white/85">Read Users</div>
              </button>
              <button
                type="button"
                onClick={() => fillCredentials('viewer@example.com', 'Viewer@123')}
                className="px-2 py-2.5 bg-[#1b43b8] hover:bg-[#15379b] border border-white rounded-md text-center transition group shadow-sm"
              >
                <div className="text-[13px] font-medium text-white group-hover:scale-105 transition-transform">
                  Viewer
                </div>
                <div className="text-[11px] text-white/85">Dashboard Only</div>
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default Login;
