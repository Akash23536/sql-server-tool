import React, { useState, useEffect } from 'react';
import type { ConnectionConfig } from '../api';

interface SavedConnection extends ConnectionConfig {
  _id: string;
  name: string;
}

interface ServerLogProps {
  currentConfig: ConnectionConfig | null;
  isConnected: boolean;
  onConnect: (config: ConnectionConfig) => void;
  onDisconnect: () => void;
}

export const ServerLog = ({
  currentConfig,
  isConnected,
  onConnect,
  onDisconnect,
}: ServerLogProps) => {
  const [savedConnections, setSavedConnections] = useState<SavedConnection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  // Form states for adding new connection
  const [newName, setNewName] = useState('Production SQL');
  const [newServer, setNewServer] = useState('5.175.139.84');
  const [newPort, setNewPort] = useState('2006');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [rememberLogin] = useState(true);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchSavedConnections = async () => {
    const token = localStorage.getItem('app_authToken');
    if (!token) return;

    try {
      setIsLoading(true);
      const response = await fetch('/api/user/saved-connections', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setSavedConnections(data);
      }
    } catch (error) {
      console.error('Failed to fetch connections:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSavedConnections();
    setIsAdding(false); 
    setEditingId(null);
    setTestStatus('idle');
    setErrorMessage('');
  }, []);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestStatus('testing');
    setErrorMessage('');

    let cleanedServer = newServer.trim();
    let cleanedPort = parseInt(newPort);

    if (cleanedServer.includes(',') || cleanedServer.includes(':')) {
      const separator = cleanedServer.includes(',') ? ',' : ':';
      const parts = cleanedServer.split(separator);
      cleanedServer = parts[0].trim();
      cleanedPort = parseInt(parts[1].trim()) || cleanedPort;
    }

    const config = { 
      server: cleanedServer, 
      port: cleanedPort, 
      username: newUsername.trim(), 
      password: newPassword.trim() 
    };
    
    try {
      const response = await fetch('/api/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      
      const result = await response.json();

      if (result.success) {
        setTestStatus('success');
        
        if (rememberLogin) {
          const token = localStorage.getItem('app_authToken');
          const method = editingId ? 'PUT' : 'POST';
          const url = editingId ? `/api/user/saved-connections/${editingId}` : '/api/user/saved-connections';
          
          const saveResponse = await fetch(url, {
            method,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name: newName, ...config })
          });

          if (!saveResponse.ok) {
            const saveResult = await saveResponse.json();
            setTestStatus('error');
            setErrorMessage(saveResult.error || 'Failed to save connection details');
            return;
          }
        }

        onConnect({ ...config, name: newName } as any);
        await fetchSavedConnections();

        setTimeout(() => {
          setIsAdding(false);
          setEditingId(null);
          setTestStatus('idle');
        }, 1500);
      } else {
        setTestStatus('error');
        setErrorMessage(result.error || 'Connection failed');
      }
    } catch (error: any) {
      setTestStatus('error');
      setErrorMessage(error.message);
    }
  };

  const handleEdit = (conn: SavedConnection) => {
    setNewName(conn.name);
    setNewServer(conn.server);
    setNewPort(conn.port.toString());
    setNewUsername(conn.username);
    setNewPassword(conn.password || '');
    setEditingId(conn._id);
    setIsAdding(true);
    setTestStatus('idle');
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const connectionToDelete = savedConnections.find(c => c._id === id);
    const isActive = isConnected && currentConfig && 
                   connectionToDelete?.server === currentConfig.server && 
                   connectionToDelete?.port === currentConfig.port;

    if (!window.confirm('Do you want to delete this entry?')) return;

    const token = localStorage.getItem('app_authToken');
    try {
      const response = await fetch(`/api/user/saved-connections/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setSavedConnections(prev => prev.filter(c => c._id !== id));
        if (isActive) onDisconnect();
      }
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f3f3f3] dark:bg-[#1e1e1e]">
      {isAdding ? (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500">{editingId ? 'Edit Server' : 'Add Server'}</h3>
            <button onClick={() => setIsAdding(false)} className="text-[10px] font-bold text-blue-500 uppercase">Back</button>
          </div>
          <form onSubmit={handleAddSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Name</label>
              <input required value={newName} onChange={e => setNewName(e.target.value)} className="w-full px-2 py-1.5 bg-white dark:bg-[#2d2d2d] border border-gray-200 dark:border-[#333] rounded text-xs outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Server</label>
              <input required value={newServer} onChange={e => setNewServer(e.target.value)} className="w-full px-2 py-1.5 bg-white dark:bg-[#2d2d2d] border border-gray-200 dark:border-[#333] rounded text-xs outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Port</label>
                <input required value={newPort} onChange={e => setNewPort(e.target.value)} className="w-full px-2 py-1.5 bg-white dark:bg-[#2d2d2d] border border-gray-200 dark:border-[#333] rounded text-xs outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">User</label>
                <input required name="sql_login_user" autoComplete="off" value={newUsername} onChange={e => setNewUsername(e.target.value)} className="w-full px-2 py-1.5 bg-white dark:bg-[#2d2d2d] border border-gray-200 dark:border-[#333] rounded text-xs outline-none" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Password</label>
              <input required type="text" style={{ WebkitTextSecurity: 'disc' } as any} name="sql_server_password_field" autoComplete="off" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full px-2 py-1.5 bg-white dark:bg-[#2d2d2d] border border-gray-200 dark:border-[#333] rounded text-xs outline-none" />
            </div>

            {testStatus === 'error' && <p className="text-[9px] text-red-500 font-bold uppercase tracking-tight">{errorMessage}</p>}
            
            <button 
              type="submit" 
              disabled={testStatus === 'testing' || testStatus === 'success'}
              className={`w-full py-2 text-white text-[10px] font-black uppercase tracking-widest rounded transition-all ${testStatus === 'success' ? 'bg-emerald-500' : 'bg-[#0078d4] hover:bg-[#0062af]'}`}
            >
              {testStatus === 'testing' ? 'Testing...' : testStatus === 'success' ? 'Connected!' : 'Connect & Save'}
            </button>
          </form>
        </div>
      ) : (
        <div className="flex flex-col h-full overflow-hidden">
          <div className="flex items-center justify-between p-4 px-5">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Saved Server Connection</span>
            <button 
              onClick={() => { setIsAdding(true); setEditingId(null); setTestStatus('idle'); }}
              className="p-1 bg-[#0078d4] text-white rounded hover:bg-[#0062af] transition-all"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
            {isLoading ? (
              <div className="flex justify-center py-4"><div className="w-4 h-4 border-2 border-t-blue-500 rounded-full animate-spin"></div></div>
            ) : savedConnections.map(conn => {
              const isActive = isConnected && currentConfig?.server === conn.server && currentConfig?.port === conn.port;
              return (
                <div key={conn._id} className={`p-3 rounded border transition-all ${isActive ? 'bg-blue-500/10 border-blue-500' : 'bg-white dark:bg-[#252526] border-gray-200 dark:border-[#333]'}`}>
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col">
                      <span className={`text-[10px] font-black uppercase tracking-tight ${isActive ? 'text-blue-500' : 'text-gray-700 dark:text-gray-200'}`}>{conn.name}</span>
                      <span className="text-[8px] text-gray-500 uppercase">{conn.server}:{conn.port}</span>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => handleEdit(conn)} className="p-1 text-gray-400 hover:text-blue-500"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                      <button onClick={(e) => handleDelete(conn._id, e)} className="p-1 text-gray-400 hover:text-red-500"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[8px] text-gray-400 uppercase">User: <span className="font-bold text-gray-600 dark:text-gray-400">{conn.username}</span></span>
                    {!isActive ? (
                      <button onClick={() => onConnect(conn)} className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white text-[8px] font-black uppercase rounded transition-all">Connect</button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Active</span>
                        <button 
                          onClick={(e) => { e.stopPropagation(); onDisconnect(); }}
                          className="px-2 py-1 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white text-[8px] font-black uppercase rounded border border-red-500/20 transition-all"
                        >
                          Disconnect
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
