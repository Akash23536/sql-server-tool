import { useState, useEffect } from 'react';

interface ConnectionFormProps {
  onConnect: (server: string, port: number, username: string, password: string, name?: string, save?: boolean) => Promise<void>;
  onCancel: () => void;
  isConnecting: boolean;
  error: string | null;
}

export function ConnectionForm({ onConnect, onCancel, isConnecting, error }: ConnectionFormProps) {
  const [server, setServer] = useState('5.175.139.84');
  const [port, setPort] = useState('2006');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [connectionName, setConnectionName] = useState('My SQL Server');
  const [saveToDb, setSaveToDb] = useState(true);
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
    await onConnect(server, parseInt(port), username, password, connectionName, saveToDb);
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
            <label htmlFor="name" className="text-sm font-semibold text-gray-600 dark:text-gray-400">Connection Name:</label>
            <input
              type="text"
              id="name"
              placeholder="e.g. Production DB"
              className="col-span-2 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm focus:outline-none focus:border-blue-500 dark:text-white"
              value={connectionName}
              onChange={(e) => setConnectionName(e.target.value)}
              disabled={isConnecting}
              required
            />
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

          <div className="grid grid-cols-3 gap-4 items-center">
            <div className="col-start-2 col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="saveToDb"
                className="w-4 h-4 rounded text-blue-600"
                checked={saveToDb}
                onChange={(e) => setSaveToDb(e.target.checked)}
                disabled={isConnecting}
              />
              <label htmlFor="saveToDb" className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-tighter">Save to MongoDB</label>
            </div>
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

      {/* Powered By Watermark - Netflix Style with Avatar */}
      <a 
        href="https://github.com/Akash23536" 
        target="_blank" 
        rel="noopener noreferrer"
        className="absolute bottom-6 right-8 z-20 flex items-center gap-2 group transition-all hover:scale-105 active:scale-95 opacity-80 hover:opacity-100 bg-white/40 dark:bg-black/20 backdrop-blur-md px-3 py-1.5 rounded-full border border-gray-200 dark:border-white/5 shadow-lg"
      >
        <div className="flex flex-col items-end -space-y-0.5">
          <span className="text-[8px] font-light text-gray-500 dark:text-gray-400 uppercase tracking-[0.3em]">Powered By</span>
          <span className="text-base font-black text-[#E50914] uppercase tracking-tighter transition-all group-hover:drop-shadow-[0_0_8px_rgba(229,9,20,0.4)]">Akash</span>
        </div>
        {githubUser?.avatar_url ? (
          <img src={githubUser.avatar_url} alt="GitHub Avatar" className="w-6 h-6 rounded-full border border-[#E50914]/30 group-hover:border-[#E50914] transition-all" />
        ) : (
          <div className="w-6 h-6 rounded-full bg-[#E50914]/20 border border-[#E50914]/30" />
        )}
      </a>
    </div>
  );
}