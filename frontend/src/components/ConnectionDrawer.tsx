import React, { useState, useEffect } from 'react';
import type { ConnectionConfig } from '../api';

interface SavedConnection extends ConnectionConfig {
  _id: string;
  name: string;
}

interface ConnectionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentConfig: ConnectionConfig | null;
  isConnected: boolean;
  onConnect: (config: ConnectionConfig) => void;
  onDisconnect: () => void;
  onShowAddConnection: () => void;
  onLogout: () => void;
}

export const ConnectionDrawer = ({
  isOpen,
  onClose,
  currentConfig,
  isConnected,
  onConnect,
  onDisconnect,
  onShowAddConnection,
  onLogout,
}: ConnectionDrawerProps) => {
  const [savedConnections, setSavedConnections] = useState<SavedConnection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  // Form states for adding new connection
  const [newName, setNewName] = useState('Production SQL');
  const [newServer, setNewServer] = useState('5.175.139.84');
  const [newPort, setNewPort] = useState('2006');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [rememberLogin, setRememberLogin] = useState(true);
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
    if (isOpen) {
      fetchSavedConnections();
      setIsAdding(false); 
      setEditingId(null);
      setTestStatus('idle');
      setErrorMessage('');
    }
  }, [isOpen]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestStatus('testing');
    setErrorMessage('');

    // Handle case where user puts port in server string (e.g. 5.175.139.84,2006)
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
      // Test the connection first using the existing connect endpoint
      const response = await fetch('/api/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      
      const result = await response.json();

      if (result.success) {
        setTestStatus('success');
        
        // Save or Update in MongoDB if 'Remember' is checked
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

        // Successfully connected, notify parent
        onConnect({ ...config, name: newName } as any);
        
        // Refresh list immediately
        await fetchSavedConnections();

        // Close form after a short delay to show success state
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
    
    // Check if this is the active connection
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
        
        // If the active connection was deleted, disconnect the SQL session but keep app logged in
        if (isActive) {
          onDisconnect();
        }
      }
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div 
        className={`fixed top-0 right-0 h-full w-80 bg-white dark:bg-[#1e1e1e] shadow-2xl z-[201] transition-transform duration-300 transform ${isOpen ? 'translate-x-0' : 'translate-x-full'} border-l border-gray-200 dark:border-[#333]`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 dark:border-[#333] flex items-center justify-between bg-gray-50 dark:bg-[#252526]">
            <h2 className="text-sm font-black uppercase tracking-widest text-gray-700 dark:text-gray-300">
              {isAdding ? 'Server Details' : 'SQL Connections'}
            </h2>
            <button onClick={isAdding ? () => setIsAdding(false) : onClose} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isAdding ? (
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                ) : (
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                )}
              </svg>
            </button>
          </div>

          {isAdding ? (
            /* Add/Edit Connection Form */
            <div className="flex-1 overflow-y-auto p-5">
              <form onSubmit={handleAddSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Display Name</label>
                  <input 
                    required value={newName} onChange={e => setNewName(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#2d2d2d] border border-gray-200 dark:border-[#333] rounded-lg text-xs focus:ring-1 focus:ring-[#0078d4] focus:border-[#0078d4] outline-none transition-all"
                    placeholder="e.g. Production DB"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Server Address</label>
                  <input 
                    required value={newServer} onChange={e => setNewServer(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#2d2d2d] border border-gray-200 dark:border-[#333] rounded-lg text-xs focus:ring-1 focus:ring-[#0078d4] focus:border-[#0078d4] outline-none transition-all"
                    placeholder="localhost or IP"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Port</label>
                  <input 
                    required value={newPort} onChange={e => setNewPort(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#2d2d2d] border border-gray-200 dark:border-[#333] rounded-lg text-xs focus:ring-1 focus:ring-[#0078d4] focus:border-[#0078d4] outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Login / User</label>
                  <input 
                    required 
                    name="sql_login_user"
                    autoComplete="off"
                    value={newUsername} onChange={e => setNewUsername(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#2d2d2d] border border-gray-200 dark:border-[#333] rounded-lg text-xs focus:ring-1 focus:ring-[#0078d4] focus:border-[#0078d4] outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Password</label>
                  <input 
                    required 
                    type="text" 
                    name="sql_server_password_field"
                    autoComplete="off"
                    style={{ WebkitTextSecurity: 'disc' } as any}
                    value={newPassword} onChange={e => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#2d2d2d] border border-gray-200 dark:border-[#333] rounded-lg text-xs focus:ring-1 focus:ring-[#0078d4] focus:border-[#0078d4] outline-none transition-all"
                  />
                </div>

                <div className="flex items-center gap-2 py-2">
                  <input 
                    type="checkbox" id="rememberLogin" checked={rememberLogin} onChange={e => setRememberLogin(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-[#0078d4] focus:ring-[#0078d4]"
                  />
                  <label htmlFor="rememberLogin" className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter cursor-pointer select-none">Remember Login</label>
                </div>

                {testStatus === 'error' && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <p className="text-[10px] text-red-500 font-bold uppercase tracking-tight">Error: {errorMessage}</p>
                  </div>
                )}

                {testStatus === 'success' && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-2 animate-bounce">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <p className="text-[10px] text-emerald-500 font-black uppercase tracking-widest">Connected Successfully!</p>
                  </div>
                )}
                
                <div className="pt-2 flex gap-2">
                  <button 
                    type="submit"
                    disabled={testStatus === 'testing' || testStatus === 'success'}
                    className={`flex-1 py-2.5 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all shadow-lg flex items-center justify-center gap-2 ${
                      testStatus === 'success' ? 'bg-emerald-500 shadow-emerald-500/20' : 
                      testStatus === 'error' ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' :
                      'bg-[#0078d4] hover:bg-[#0062af] shadow-[#0078d4]/20'
                    }`}
                  >
                    {testStatus === 'testing' ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        Testing...
                      </>
                    ) : testStatus === 'success' ? (
                      'Connected'
                    ) : (
                      'Connect & Save'
                    )}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="px-4 py-2.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* List Mode */
            <>
              {/* Saved Connections List */}
              <div className="flex-1 overflow-y-auto px-4 py-2">
                <div className="flex items-center justify-between mb-4 px-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Saved Servers</span>
                  <button 
                    onClick={() => {
                      setNewName('Production SQL');
                      setNewServer('5.175.139.84');
                      setNewPort('2006');
                      setNewUsername('');
                      setNewPassword('');
                      setIsAdding(true);
                      setTestStatus('idle');
                    }}
                    className="p-1 bg-[#0078d4] text-white rounded-md hover:bg-[#0062af] transition-all shadow-md active:scale-90"
                    title="Add New Connection"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>

                {isLoading ? (
                  <div className="flex justify-center py-10">
                    <div className="w-5 h-5 border-2 border-[#0078d4]/20 border-t-[#0078d4] rounded-full animate-spin"></div>
                  </div>
                ) : savedConnections.length === 0 ? (
                  <div className="text-center py-10 px-4 border-2 border-dashed border-gray-200 dark:border-[#333] rounded-xl">
                    <p className="text-[10px] text-gray-500 font-bold uppercase">No saved connections</p>
                    <p className="text-[9px] text-gray-400 mt-1 uppercase">Click + to add your first server</p>
                  </div>
                ) : (
                  <div className="space-y-3 pb-6">
                    {savedConnections.map(conn => {
                      const isActive = isConnected && currentConfig?.server === conn.server && currentConfig?.port === conn.port;
                      return (
                        <div 
                          key={conn._id}
                          className={`group relative p-4 rounded-xl border transition-all duration-300 ${
                            isActive 
                              ? 'bg-[#0078d4]/5 border-[#0078d4] shadow-md shadow-[#0078d4]/10' 
                              : 'bg-white dark:bg-[#252526] border-gray-200 dark:border-[#333] hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm'
                          }`}
                        >
                          {isActive && (
                            <div className="absolute top-0 right-0 px-2 py-0.5 bg-[#0078d4] text-white text-[8px] font-black uppercase tracking-widest rounded-bl-lg rounded-tr-xl">
                              Connected
                            </div>
                          )}

                          <div className="flex flex-col h-full">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex flex-col">
                                <span className={`text-[11px] font-black uppercase tracking-tight transition-colors ${isActive ? 'text-[#0078d4]' : 'text-gray-800 dark:text-gray-100'}`}>
                                  {conn.name}
                                </span>
                                <span className="text-[9px] text-gray-500 dark:text-gray-400 mt-0.5 font-medium">
                                  {conn.server}:{conn.port}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleEdit(conn); }}
                                  className="p-1.5 text-gray-400 hover:text-[#0078d4] hover:bg-[#0078d4]/10 rounded-lg transition-all"
                                  title="Edit Credentials"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                  </svg>
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleDelete(conn._id, e); }}
                                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                  title="Delete Server"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>

                            <div className="flex items-center justify-between mt-auto pt-2">
                               <span className="text-[9px] text-gray-400 dark:text-gray-500">
                                 User: <span className="text-gray-600 dark:text-gray-300 font-bold">{conn.username}</span>
                               </span>
                               {!isActive ? (
                                 <button 
                                   onClick={() => onConnect(conn)}
                                   className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[9px] font-black uppercase tracking-widest rounded-lg transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                                 >
                                   Connect
                                 </button>
                               ) : (
                                 <button 
                                   onClick={() => { onDisconnect(); onClose(); }}
                                   className="px-4 py-1.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white text-[9px] font-black uppercase tracking-widest rounded-lg transition-all border border-red-500/20 active:scale-95"
                                 >
                                   Disconnect
                                 </button>
                               )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Footer Info */}
          <div className="p-4 bg-gray-50 dark:bg-[#252526] border-t border-gray-200 dark:border-[#333]">
            <div className="text-[8px] text-gray-500 dark:text-gray-400 text-center uppercase tracking-widest font-bold">
              Securely stored in MongoDB
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
