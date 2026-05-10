import { useState, useEffect } from "react";

interface AuthProps {
  onLogin: (token: string, username: string, role?: number, aiRole?: string) => void;
}

export const Auth = ({ onLogin }: AuthProps) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');

  const API_BASE =
    (import.meta.env.VITE_API_URL?.replace(/\/$/, "") ||
      (import.meta.env.DEV ? "http://localhost:5000" : "")) + "/api/auth";

  useEffect(() => {
    fetch(`${API_BASE}/status`)
      .then(res => res.json())
      .then(data => setDbStatus(data.status))
      .catch(() => setDbStatus('disconnected'));
  }, [API_BASE]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const username = params.get("username");
    const role = params.get("role");
    const aiRole = params.get("aiRole");

    if (token && username) {
      onLogin(token, username, role ? parseInt(role) : undefined, aiRole || undefined);
      // Clean up URL without reload
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [onLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const endpoint = isLogin ? "/login" : "/register";
      const body = isLogin
        ? { email, password }
        : { username, email, password };

      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const contentType = response.headers.get("content-type");
      let data;
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(`Server returned non-JSON response (${response.status}): ${text.substring(0, 100)}`);
      }

      if (!response.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      // Successful auth
      onLogin(data.token, data.username, data.role, data.aiRole);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white relative overflow-hidden px-4">
      {/* Dynamic Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-blue-600/20 blur-[100px] animate-pulse"></div>
      <div
        className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-purple-600/20 blur-[100px] animate-pulse"
        style={{ animationDelay: "2s" }}
      ></div>

      <div className="relative z-10 w-full max-w-md p-6 md:p-8 bg-slate-800/60 backdrop-blur-xl rounded-2xl border border-slate-700 shadow-2xl">
        <div className="text-center mb-6 md:mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg mb-4">
            <svg
              className="w-7 h-7 md:w-8 md:h-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
            {isLogin ? "Welcome Back" : "Create Account"}
          </h2>
          <div className="flex items-center justify-center gap-4 mt-2">
            <p className="text-slate-400 text-[11px] md:text-sm">
              {isLogin
                ? "Enter your credentials"
                : "Register to start managing"}
            </p>
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${
              dbStatus === 'connected' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 
              dbStatus === 'disconnected' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
              'bg-slate-500/10 border-slate-500/20 text-slate-400'
            }`}>
              <div className={`w-1 h-1 md:w-1.5 md:h-1.5 rounded-full ${
                dbStatus === 'connected' ? 'bg-emerald-500' : 
                dbStatus === 'disconnected' ? 'bg-red-500 animate-pulse' : 
                'bg-slate-400'
              }`}></div>
              <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-tight">
                {dbStatus === 'connected' ? 'Cloud DB Live' : 
                 dbStatus === 'disconnected' ? 'DB Offline' : 'Checking DB...'}
              </span>
            </div>
          </div>
        </div>

        {dbStatus === 'disconnected' && !error && (
          <div className="mb-6 p-4 rounded-lg bg-amber-500/10 border border-amber-500/50 text-amber-200 text-xs leading-relaxed">
            <div className="font-bold uppercase tracking-widest text-amber-500 mb-1 flex items-center gap-2">
              <span className="animate-ping w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              Connection Issue
            </div>
            The system cannot reach MongoDB Atlas. 
            <ul className="mt-2 space-y-1 list-disc list-inside text-amber-400/80">
              <li>Log in to <strong>MongoDB Atlas</strong></li>
              <li>Go to <strong>Network Access</strong></li>
              <li>Add <strong>0.0.0.0/0</strong> (Allow All) or your current IP</li>
            </ul>
            <p className="mt-2 italic">Or use <strong>Guest Access</strong> below to test without a database.</p>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/50 text-red-400 text-sm flex items-center gap-2">
            <svg
              className="w-5 h-5 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Username
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2.5 md:py-3 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-white placeholder-slate-500 text-sm md:text-base"
                placeholder="johndoe"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 md:py-3 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-white placeholder-slate-500 text-sm md:text-base"
              placeholder="name@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 md:py-3 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-white placeholder-slate-500 text-sm md:text-base pr-11"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 md:py-3.5 px-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl font-medium shadow-lg shadow-blue-500/30 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none mt-2 text-sm md:text-base"
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>Please wait...</span>
              </div>
            ) : (
              <span>{isLogin ? "Sign In" : "Sign Up"}</span>
            )}
          </button>
        </form>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700"></div>
            </div>
            <div className="relative flex justify-center text-[10px] md:text-xs uppercase">
              <span className="bg-[#1e293b] px-2 text-slate-400">Or continue with</span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <button
              onClick={async () => {
                setIsLoading(true);
                try {
                  const response = await fetch(`${API_BASE}/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: 'admin@example.com', password: 'admin123' }),
                  });
                  const data = await response.json();
                  if (response.ok) onLogin(data.token, data.username, data.role);
                  else throw new Error(data.error || "Guest login failed");
                } catch (err: any) {
                  setError(err.message);
                } finally {
                  setIsLoading(false);
                }
              }}
              className="flex items-center justify-center py-2 md:py-2.5 px-2 md:px-4 border border-slate-700 rounded-xl hover:bg-slate-700/50 transition-all group"
              title="Guest Access"
            >
              <svg className="w-4 h-4 md:w-5 md:h-5 text-emerald-400 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/>
              </svg>
              <span className="ml-1 md:ml-2 text-[10px] md:text-xs font-bold text-slate-300">Guest</span>
            </button>

            <button 
              onClick={() => window.location.href = `${API_BASE}/google`}
              className="flex items-center justify-center py-2 md:py-2.5 px-4 border border-slate-700 rounded-xl hover:bg-slate-700/50 transition-all group"
              title="Sign in with Google"
            >
              <svg className="w-4 h-4 md:w-5 md:h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            </button>

            <button 
              onClick={() => window.location.href = `${API_BASE}/github`}
              className="flex items-center justify-center py-2 md:py-2.5 px-4 border border-slate-700 rounded-xl hover:bg-slate-700/50 transition-all group"
              title="Sign in with GitHub"
            >
              <svg className="w-4 h-4 md:w-5 md:h-5 text-white group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
              </svg>
            </button>
          </div>
        </div>

        <div className="mt-6 md:mt-8 text-center">
          <p className="text-[12px] md:text-sm text-slate-400">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError(null);
              }}
              className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
            >
              {isLogin ? "Create one" : "Sign in instead"}
            </button>
          </p>
        </div>

      </div>

      {/* Powered By Corner Tag - Netflix Style with Avatar */}
      <a 
        href="https://github.com/Akash23536" 
        target="_blank" 
        rel="noopener noreferrer"
        className="hidden md:flex absolute bottom-8 right-8 z-20 items-center gap-3 group transition-all hover:scale-105 active:scale-95 bg-slate-900/20 backdrop-blur-sm px-4 py-2 rounded-full border border-white/5 hover:border-white/10 shadow-xl"
      >
        <div className="flex flex-col items-end -space-y-1">
          <span className="text-[9px] font-light text-slate-500 uppercase tracking-[0.3em] transition-colors group-hover:text-slate-400">Powered By</span>
          <span className="text-lg font-black text-[#E50914] uppercase tracking-tighter transition-all group-hover:drop-shadow-[0_0_10px_rgba(229,9,20,0.5)]">Akash</span>
        </div>
        <img 
          src="https://github.com/Akash23536.png" 
          alt="Akash Bhadana" 
          className="w-7 h-7 rounded-full border border-[#E50914]/30 group-hover:border-[#E50914] transition-all shadow-lg"
        />
      </a>
    </div>
  );
};
