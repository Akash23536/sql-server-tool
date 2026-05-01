import { useState } from 'react';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onConnect(server, parseInt(port), username, password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-200 dark:bg-slate-900 p-4">
      <div className="w-full max-w-lg bg-[#f0f0f0] dark:bg-[#252526] border border-gray-300 dark:border-gray-700 shadow-2xl rounded-sm overflow-hidden">
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
    </div>
  );
}