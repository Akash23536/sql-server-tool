import { useState, useEffect } from 'react';

interface ConnectionFormProps {
  onConnect: (server: string, port: number, username: string, password: string) => Promise<void>;
  onCancel: () => void;
  isConnecting: boolean;
  error: string | null;
}

export function ConnectionForm({ onConnect, onCancel, isConnecting, error }: ConnectionFormProps) {
  const [server, setServer] = useState('5.175.139.84');
  const [port, setPort] = useState('2006');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [githubUser, setGithubUser] = useState<{name: string, avatar_url: string, html_url: string} | null>(null);

  useEffect(() => {
    fetch('https://api.github.com/users/Akash23536')
      .then(res => res.json())
      .then(data => {
        if (data && data.avatar_url) setGithubUser(data);
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onConnect(server, parseInt(port), username, password);
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-slate-200 dark:bg-slate-900 p-4">
      <div className="w-full max-w-lg bg-[#f0f0f0] dark:bg-[#252526] border border-gray-300 dark:border-gray-700 shadow-2xl rounded-sm overflow-hidden z-10">
        {/* Header - SSMS Style */}
        <div className="bg-[#dee1e6] dark:bg-[#2d2d2d] px-4 py-3 border-b border-gray-300 dark:border-gray-700 flex items-center gap-3">
          <div className="p-1.5 bg-white dark:bg-gray-700 rounded shadow-sm">
            <span className="text-2xl">🖥️</span>
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-gray-700 dark:text-gray-200 uppercase tracking-widest">Connect to Server</h2>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase">Microsoft SQL Server</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="grid grid-cols-3 gap-4 items-center">
            <label className="text-sm font-semibold text-gray-600 dark:text-gray-400">Server type:</label>
            <div className="col-span-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm text-gray-500">
              Database Engine
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 items-center">
            <label htmlFor="server" className="text-sm font-semibold text-gray-600 dark:text-gray-400">Server name:</label>
            <input
              type="text"
              id="server"
              className="col-span-2 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm focus:outline-none focus:border-blue-500 dark:text-white"
              value={server}
              onChange={(e) => setServer(e.target.value)}
              disabled={isConnecting}
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-4 items-center">
            <label htmlFor="port" className="text-sm font-semibold text-gray-600 dark:text-gray-400">Port:</label>
            <input
              type="number"
              id="port"
              className="col-span-2 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm focus:outline-none focus:border-blue-500 dark:text-white"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              disabled={isConnecting}
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-4 items-center">
            <label htmlFor="username" className="text-sm font-semibold text-gray-600 dark:text-gray-400">Login:</label>
            <input
              type="text"
              id="username"
              className="col-span-2 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm focus:outline-none focus:border-blue-500 dark:text-white"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isConnecting}
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-4 items-center">
            <label htmlFor="password" className="text-sm font-semibold text-gray-600 dark:text-gray-400">Password:</label>
            <input
              type="password"
              id="password"
              className="col-span-2 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm focus:outline-none focus:border-blue-500 dark:text-white"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isConnecting}
              required
            />
          </div>

          {error && (
            <div className="p-3 bg-red-100 border border-red-200 text-red-700 text-xs font-bold rounded">
              Error: {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-300 dark:border-gray-700">
            {isConnecting ? (
              <button 
                type="button" 
                className="px-6 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow-sm transition-all"
                onClick={onCancel}
              >
                Cancel
              </button>
            ) : (
              <>
                <button 
                  type="submit" 
                  className="px-6 py-1.5 bg-[#0078d4] hover:bg-[#005a9e] text-white text-sm font-bold shadow-sm transition-all"
                >
                  Connect
                </button>
                <button 
                  type="button"
                  className="px-6 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-600 shadow-sm transition-all"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </form>
      </div>

      {/* Powered By Watermark */}
      <div className="absolute bottom-4 right-4 md:bottom-6 md:right-8 flex flex-col sm:flex-row items-end sm:items-center gap-1 md:gap-2 opacity-70 hover:opacity-100 transition-opacity z-20">
        <span className="text-[9px] md:text-[10px] font-black text-gray-500 tracking-[0.2em] uppercase">Powered By</span>
        <a
          href={githubUser?.html_url || "https://github.com/Akash23536"}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors"
          title="GitHub Profile"
        >
          {githubUser?.avatar_url ? (
            <img src={githubUser.avatar_url} alt="GitHub Avatar" className="w-5 h-5 md:w-6 md:h-6 rounded-full shadow-sm border border-gray-300 dark:border-gray-600" />
          ) : (
            <svg viewBox="0 0 24 24" className="w-4 h-4 md:w-5 md:h-5 fill-current">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
          )}
          <span className="font-extrabold text-[13px] md:text-[15px] tracking-tight uppercase">{githubUser?.name || 'AKASH'}</span>
        </a>
      </div>
    </div>
  );
}