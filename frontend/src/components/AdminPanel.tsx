import { useState, useEffect } from 'react';
import { 
  adminGetUsers, 
  adminUpdateUser, 
  adminResetPassword, 
  adminDeleteUser,
  adminCreateUser,
  adminGetUserConnections,
  adminGetUserLogs,
  adminUpdateUserConnection,
  adminAddUserConnection,
  adminDeleteUserConnection,
  adminDeleteUserLog,
  adminClearUserLogs
} from '../api';
import type { AdminUser, AdminLog } from '../api';

interface AdminPanelProps {
  onClose: () => void;
}

export default function AdminPanel({ onClose }: AdminPanelProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Selected user for drill-down
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [userConnections, setUserConnections] = useState<any[]>([]);
  const [userLogs, setUserLogs] = useState<AdminLog[]>([]);
  const [isDrillDownLoading, setIsDrillDownLoading] = useState(false);

  // Modals
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [resettingPasswordId, setResettingPasswordId] = useState<string | null>(null);
  const [editingConnection, setEditingConnection] = useState<any | null>(null);
  const [isAddingConnection, setIsAddingConnection] = useState(false);
  
  const [newPassword, setNewPassword] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);
  
  // Visibility toggles
  const [showUserPassword, setShowUserPassword] = useState(false);
  const [showConnPassword, setShowConnPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);

  // Form states
  const [userForm, setUserForm] = useState({ username: '', email: '', password: '', role: 0, aiRole: 'SQL Server Expert' });
  const [connForm, setConnForm] = useState({ name: '', server: '', port: 1433, username: '', password: '' });

  useEffect(() => {
    if (!selectedUser) {
      fetchData();
    }
  }, [selectedUser]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminGetUsers();
      setUsers(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUserDrillDown = async (user: AdminUser) => {
    setSelectedUser(user);
    setIsDrillDownLoading(true);
    try {
      const [connections, logs] = await Promise.all([
        adminGetUserConnections(user._id),
        adminGetUserLogs(user._id)
      ]);
      setUserConnections(connections);
      setUserLogs(logs);
    } catch (err: any) {
      alert('Failed to load user details: ' + err.message);
    } finally {
      setIsDrillDownLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsActionLoading(true);
    try {
      await adminCreateUser(userForm);
      setIsAddingUser(false);
      setUserForm({ username: '', email: '', password: '', role: 0, aiRole: 'SQL Server Expert' });
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsActionLoading(true);
    try {
      const updated = await adminUpdateUser(editingUser._id, editingUser);
      setEditingUser(null);
      if (selectedUser?._id === updated._id) setSelectedUser(updated);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleAddConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setIsActionLoading(true);
    try {
      await adminAddUserConnection(selectedUser._id, connForm);
      setIsAddingConnection(false);
      setConnForm({ name: '', server: '', port: 1433, username: '', password: '' });
      const connections = await adminGetUserConnections(selectedUser._id);
      setUserConnections(connections);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleUpdateConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingConnection || !selectedUser) return;
    setIsActionLoading(true);
    try {
      await adminUpdateUserConnection(selectedUser._id, editingConnection._id, editingConnection);
      setEditingConnection(null);
      const connections = await adminGetUserConnections(selectedUser._id);
      setUserConnections(connections);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDeleteConnection = async (connId: string) => {
    if (!selectedUser || !window.confirm('Delete this connection?')) return;
    setIsActionLoading(true);
    try {
      await adminDeleteUserConnection(selectedUser._id, connId);
      const connections = await adminGetUserConnections(selectedUser._id);
      setUserConnections(connections);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingPasswordId || !newPassword) return;
    setIsActionLoading(true);
    try {
      await adminResetPassword(resettingPasswordId, newPassword);
      setResettingPasswordId(null);
      setNewPassword('');
      alert('Password reset successful');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    setIsActionLoading(true);
    try {
      await adminDeleteUser(id);
      if (selectedUser?._id === id) setSelectedUser(null);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDeleteLog = async (logId: string) => {
    if (!selectedUser || !window.confirm('Delete this log entry?')) return;
    try {
      await adminDeleteUserLog(selectedUser._id, logId);
      setUserLogs(prev => prev.filter(l => l._id !== logId));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleClearLogs = async () => {
    if (!selectedUser || !window.confirm('Clear ALL logs for this user?')) return;
    try {
      await adminClearUserLogs(selectedUser._id);
      setUserLogs([]);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const getRoleLabel = (role: number) => {
    switch (role) {
      case 1: return <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-tight">Admin</span>;
      default: return <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-tight">User</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-white dark:bg-[#1c1c1e] w-full max-w-6xl h-[90vh] border border-slate-200 dark:border-white/10 shadow-2xl rounded-2xl overflow-hidden flex flex-col transition-all transform animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {selectedUser ? (
              <button 
                onClick={() => setSelectedUser(null)}
                className="p-2 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl text-slate-400 hover:text-slate-600 transition-all mr-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-2.533-4.656 6.853 6.853 0 01-5.137 0 4.125 4.125 0 00-2.533 4.656 9.337 9.337 0 004.121.952zm-3.128-4.594A4.125 4.125 0 1115 15.334a4.125 4.125 0 01-3.128-4.594zM2.25 12c0 1.574.313 3.076.88 4.45l-1.547 4.16a.75.75 0 00.957.958l4.16-1.547c1.374.567 2.876.88 4.45.88a9.75 9.75 0 009.034-6.034.75.75 0 00-.067-.655 9.75 9.75 0 00-6.034-9.034.75.75 0 00-.655.067c-1.374.567-2.876.88-4.45.88A9.75 9.75 0 002.25 12z" />
                </svg>
              </div>
            )}
            <div>
              <h2 className="text-lg font-black text-slate-800 dark:text-white tracking-tight">
                {selectedUser ? `Drill-down: ${selectedUser.username}` : 'Full System Administration'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {selectedUser ? `Inspecting account, connections and logs for ${selectedUser.email}` : 'Total control over users, data, and system records'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!selectedUser && (
              <button 
                onClick={() => setIsAddingUser(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" />
                </svg>
                Add User
              </button>
            )}
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-200 dark:hover:bg-white/10 rounded-full text-slate-400 hover:text-slate-600 transition-all"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Selected User Detail View */}
        {selectedUser ? (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-slate-50/30 dark:bg-black/10">
            {/* Left Column: Connections */}
            <div className="w-full md:w-1/2 border-r border-slate-200 dark:border-white/5 flex flex-col overflow-hidden">
              <div className="px-6 py-4 bg-white dark:bg-transparent border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  User SQL Connections
                </h3>
                <button 
                  onClick={() => setIsAddingConnection(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20"
                >
                  Add Connection
                </button>
              </div>
              
              <div className="flex-1 overflow-auto p-6 space-y-4">
                {isDrillDownLoading ? (
                  <div className="flex items-center justify-center h-20 text-slate-400 animate-pulse text-xs">Loading connections...</div>
                ) : userConnections.length === 0 ? (
                  <div className="text-center py-10 bg-white dark:bg-white/5 rounded-2xl border border-dashed border-slate-200 dark:border-white/10">
                    <p className="text-xs font-medium text-slate-400 italic">No saved connections found.</p>
                  </div>
                ) : (
                  userConnections.map(conn => (
                    <div key={conn._id} className="bg-white dark:bg-[#252526] p-4 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm group hover:border-blue-500/30 transition-all">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          {conn.name}
                        </span>
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => setEditingConnection(conn)}
                            className="text-[10px] font-black uppercase text-blue-600 hover:text-blue-700 tracking-wider"
                          >
                            Modify
                          </button>
                          <button 
                            onClick={() => handleDeleteConnection(conn._id)}
                            className="text-[10px] font-black uppercase text-red-500 hover:text-red-700 tracking-wider"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 dark:bg-white/5 p-2 rounded-lg">
                          <div className="text-[9px] uppercase font-black text-slate-400 mb-0.5">Server</div>
                          <div className="text-[11px] font-mono dark:text-slate-300 truncate">{conn.server}</div>
                        </div>
                        <div className="bg-slate-50 dark:bg-white/5 p-2 rounded-lg">
                          <div className="text-[9px] uppercase font-black text-slate-400 mb-0.5">User</div>
                          <div className="text-[11px] font-mono dark:text-slate-300 truncate">{conn.username}</div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right Column: User Logs */}
            <div className="w-full md:w-1/2 flex flex-col overflow-hidden">
              <div className="px-6 py-4 bg-white dark:bg-transparent border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Personal Logs
                </h3>
                {userLogs.length > 0 && (
                  <button 
                    onClick={handleClearLogs}
                    className="text-[10px] font-black uppercase text-red-500 hover:text-red-700 tracking-widest"
                  >
                    Clear All Logs
                  </button>
                )}
              </div>
              
              <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
                {isDrillDownLoading ? (
                  <div className="flex items-center justify-center h-20 text-slate-400 animate-pulse text-xs">Loading logs...</div>
                ) : userLogs.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-xs text-slate-400 italic">No activity logs recorded.</p>
                  </div>
                ) : (
                  userLogs.map(log => (
                    <div key={log._id} className="relative pl-6 border-l border-slate-200 dark:border-white/10 pb-5 last:pb-0 group/log">
                      <div className="absolute left-[-5px] top-1 w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600 border-2 border-white dark:border-[#1c1c1e]"></div>
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-3">
                          <span className={`text-[10px] font-black uppercase tracking-wider ${
                            log.action.includes('LOGIN') ? 'text-emerald-500' :
                            log.action.includes('DELETE') || log.action.includes('RESET') ? 'text-red-500' :
                            'text-indigo-500'
                          }`}>
                            {log.action}
                          </span>
                          <button 
                            onClick={() => handleDeleteLog(log._id)}
                            className="opacity-0 group-hover/log:opacity-100 text-[9px] text-red-500 hover:underline transition-opacity font-bold uppercase"
                          >
                            Delete
                          </button>
                        </div>
                        <span className="text-[9px] text-slate-400 font-mono">
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight mb-1">{log.details}</p>
                      <div className="text-[9px] font-mono text-slate-400">{log.ipAddress || 'Unknown IP'}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Main Content Area */}
            <div className="flex-1 overflow-auto p-6 bg-slate-50/30 dark:bg-black/10">
              {loading ? (
                <div className="h-full flex flex-col items-center justify-center gap-4">
                  <div className="w-10 h-10 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
                  <p className="text-xs font-bold text-slate-400 animate-pulse tracking-widest">FETCHING USERS...</p>
                </div>
              ) : error ? (
                <div className="h-full flex items-center justify-center p-8">
                  <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-6 text-center max-w-md">
                    <div className="text-red-500 mb-2 font-bold uppercase tracking-widest">Access Error</div>
                    <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>
                    <button onClick={fetchData} className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-bold shadow-lg">Retry Sync</button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4">
                  {users.map(user => (
                    <div key={user._id} className="bg-white dark:bg-[#252526] p-4 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 group hover:border-indigo-500/40 transition-all cursor-pointer" onClick={() => handleUserDrillDown(user)}>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500 dark:text-slate-400 font-bold text-lg border-2 border-white dark:border-[#333] shadow-inner group-hover:bg-indigo-50 dark:group-hover:bg-indigo-500/10 transition-colors">
                          {user.username[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-bold text-slate-800 dark:text-white group-hover:text-indigo-600 transition-colors">{user.username}</span>
                            {getRoleLabel(user.role)}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-3 font-medium">
                            <span>{user.email}</span>
                            <span className="w-1 h-1 bg-slate-300 dark:bg-slate-600 rounded-full"></span>
                            <span>{new Date(user.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <button 
                          onClick={() => setEditingUser(user)}
                          className="px-4 py-2 bg-slate-50 dark:bg-white/5 hover:bg-blue-50 dark:hover:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => handleDeleteUser(user._id)}
                          className="px-4 py-2 bg-slate-50 dark:bg-white/5 hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500 dark:text-red-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Add/Edit User Modal */}
      {(isAddingUser || editingUser) && (
        <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <form onSubmit={isAddingUser ? handleCreateUser : handleUpdateUser} className="bg-white dark:bg-[#1c1c1e] w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-white/10 animate-in zoom-in-95 duration-200">
            <div className="p-8">
              <h3 className="text-xl font-black text-slate-800 dark:text-white mb-6">
                {isAddingUser ? 'Create New User Account' : `Full Control: ${editingUser?.username}`}
              </h3>
              
              <div className="grid grid-cols-2 gap-5">
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Username</label>
                  <input 
                    type="text" 
                    required
                    value={isAddingUser ? userForm.username : editingUser?.username}
                    onChange={e => isAddingUser ? setUserForm({...userForm, username: e.target.value}) : setEditingUser({...editingUser!, username: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-indigo-500/50 transition-all dark:text-white"
                  />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Email Address</label>
                  <input 
                    type="email" 
                    required
                    value={isAddingUser ? userForm.email : editingUser?.email}
                    onChange={e => isAddingUser ? setUserForm({...userForm, email: e.target.value}) : setEditingUser({...editingUser!, email: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-indigo-500/50 transition-all dark:text-white"
                  />
                </div>
                {isAddingUser && (
                  <div className="col-span-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Temporary Password</label>
                    <div className="relative">
                      <input 
                        type={showUserPassword ? "text" : "password"} 
                        placeholder="Leave blank for default 'password123'"
                        value={userForm.password}
                        onChange={e => setUserForm({...userForm, password: e.target.value})}
                        className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-indigo-500/50 transition-all dark:text-white font-mono pr-12"
                      />
                      <button 
                        type="button"
                        onClick={() => setShowUserPassword(!showUserPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                      >
                        {showUserPassword ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        )}
                      </button>
                    </div>
                  </div>
                )}
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Permissions & AI Persona</label>
                  <div className="grid grid-cols-2 gap-4">
                    <select 
                      value={isAddingUser ? userForm.role : editingUser?.role}
                      onChange={e => isAddingUser ? setUserForm({...userForm, role: parseInt(e.target.value)}) : setEditingUser({...editingUser!, role: parseInt(e.target.value)})}
                      className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-indigo-500/50 transition-all dark:text-white appearance-none cursor-pointer"
                    >
                      <option value={0} className="dark:bg-slate-900 dark:text-white">Normal User</option>
                      <option value={1} className="dark:bg-slate-900 dark:text-white">Administrator</option>
                    </select>
                    <input 
                      type="text" 
                      placeholder="AI Prompt Role"
                      value={isAddingUser ? userForm.aiRole : editingUser?.aiRole}
                      onChange={e => isAddingUser ? setUserForm({...userForm, aiRole: e.target.value}) : setEditingUser({...editingUser!, aiRole: e.target.value})}
                      className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-indigo-500/50 transition-all dark:text-white"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-50 dark:bg-white/5 px-8 py-5 flex items-center justify-between">
              {!isAddingUser && (
                <button 
                  type="button" 
                  onClick={() => setResettingPasswordId(editingUser!._id)}
                  className="text-[10px] font-black uppercase text-emerald-600 hover:underline tracking-widest"
                >
                  Force Reset Password
                </button>
              )}
              <div className="flex items-center gap-3 ml-auto">
                <button type="button" onClick={() => { setIsAddingUser(false); setEditingUser(null); }} className="px-5 py-2 text-xs font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest">Cancel</button>
                <button type="submit" disabled={isActionLoading} className="px-8 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all active:scale-95 disabled:bg-slate-300">
                  {isActionLoading ? 'Processing...' : (isAddingUser ? 'Create Account' : 'Save All Changes')}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Add/Edit Connection Modal */}
      {(isAddingConnection || editingConnection) && (
        <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <form onSubmit={isAddingConnection ? handleAddConnection : handleUpdateConnection} className="bg-white dark:bg-[#1c1c1e] w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-white/10 animate-in zoom-in-95 duration-200">
            <div className="p-8">
              <h3 className="text-xl font-black text-slate-800 dark:text-white mb-6">
                {isAddingConnection ? 'Register New Server' : 'Modify SQL Server Data'}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Connection Name</label>
                  <input 
                    type="text" 
                    required
                    value={isAddingConnection ? connForm.name : editingConnection?.name}
                    onChange={e => isAddingConnection ? setConnForm({...connForm, name: e.target.value}) : setEditingConnection({...editingConnection!, name: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-blue-500/50 transition-all dark:text-white"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Host Address</label>
                    <input 
                      type="text" 
                      required
                      value={isAddingConnection ? connForm.server : editingConnection?.server}
                      onChange={e => isAddingConnection ? setConnForm({...connForm, server: e.target.value}) : setEditingConnection({...editingConnection!, server: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-blue-500/50 transition-all dark:text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Port</label>
                    <input 
                      type="number" 
                      required
                      value={isAddingConnection ? connForm.port : editingConnection?.port}
                      onChange={e => isAddingConnection ? setConnForm({...connForm, port: parseInt(e.target.value)}) : setEditingConnection({...editingConnection!, port: parseInt(e.target.value)})}
                      className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-blue-500/50 transition-all dark:text-white font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Auth Username</label>
                  <input 
                    type="text" 
                    required
                    value={isAddingConnection ? connForm.username : editingConnection?.username}
                    onChange={e => isAddingConnection ? setConnForm({...connForm, username: e.target.value}) : setEditingConnection({...editingConnection!, username: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-blue-500/50 transition-all dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Auth Password</label>
                  <div className="relative">
                    <input 
                      type={showConnPassword ? "text" : "password"} 
                      required
                      value={isAddingConnection ? connForm.password : editingConnection?.password}
                      onChange={e => isAddingConnection ? setConnForm({...connForm, password: e.target.value}) : setEditingConnection({...editingConnection!, password: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-blue-500/50 transition-all dark:text-white font-mono pr-12"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowConnPassword(!showConnPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    >
                      {showConnPassword ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-50 dark:bg-white/5 px-8 py-5 flex items-center justify-end gap-3">
              <button type="button" onClick={() => { setIsAddingConnection(false); setEditingConnection(null); }} className="px-5 py-2.5 text-xs font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest">Abort</button>
              <button type="submit" disabled={isActionLoading} className="px-8 py-3 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-95">
                {isActionLoading ? 'Saving...' : (isAddingConnection ? 'Register Host' : 'Update Credentials')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Password Reset Modal */}
      {resettingPasswordId && (
        <div className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <form onSubmit={handleResetPassword} className="bg-white dark:bg-[#1c1c1e] w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-white/10 animate-in zoom-in-95 duration-200">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-600 mx-auto mb-4">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                </svg>
              </div>
              <h3 className="text-lg font-black text-slate-800 dark:text-white mb-2 tracking-tight uppercase">Emergency Override</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-8 font-bold">SETTING NEW MASTER PASSWORD</p>
              
              <div className="relative">
                <input 
                  autoFocus
                  type={showResetPassword ? "text" : "password"} 
                  placeholder="New Password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-4 text-sm text-center outline-none focus:border-emerald-500/50 transition-all dark:text-white font-mono pr-14"
                  required
                />
                <button 
                  type="button"
                  onClick={() => setShowResetPassword(!showResetPassword)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  {showResetPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  )}
                </button>
              </div>
            </div>
            
            <div className="bg-slate-50 dark:bg-white/5 px-8 py-5 flex items-center justify-between gap-3">
              <button type="button" onClick={() => { setResettingPasswordId(null); setNewPassword(''); }} className="px-5 py-2 text-xs font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest">Cancel</button>
              <button type="submit" disabled={isActionLoading || !newPassword} className="px-8 py-3 bg-emerald-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition-all active:scale-95 disabled:bg-slate-300">
                Update Now
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
