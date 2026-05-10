import * as Panels from 'react-resizable-panels';
const PanelGroup = (Panels as any).PanelGroup || (Panels as any).Group;
const Panel = (Panels as any).Panel;
const PanelResizeHandle = (Panels as any).PanelResizeHandle || (Panels as any).Separator;
import { useState, useEffect, useRef } from 'react';
import { QueryEditor } from './components/QueryEditor';
import { ResultsGrid } from './components/ResultsGrid';
import { ModifiedObjects } from './components/ModifiedObjects';
import { ObjectCompare } from './components/ObjectCompare';
import { ExcelTool } from './components/ExcelTool';
import { Sidebar } from './components/Sidebar';
import { Auth } from './components/Auth';
import AdminPanel from './components/AdminPanel';
import {
  connectToServer,
  getDatabases,
  getObjects,
  getObjectScript,
  searchScripts,
  executeQuery,
  disconnect,
} from './api';
import type { ConnectionConfig, DbObject, QueryResult, Database } from './api';
import type { ObjectTypeFilter } from './api';
import './App.css';

function App() {
  // Theme state
  const [isDarkTheme] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  useEffect(() => {
    if (isDarkTheme) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkTheme]);

  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [connectionConfig, setConnectionConfig] = useState<ConnectionConfig | null>(null);
  const [isAutoReconnecting, setIsAutoReconnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(() => localStorage.getItem('app_authToken'));
  const [authUser, setAuthUser] = useState<string | null>(() => localStorage.getItem('app_authUser'));
  const [authRole, setAuthRole] = useState<number>(() => parseInt(localStorage.getItem('app_authRole') || '0'));
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'servers' | 'objects'>('servers');

  // Auto-reconnect on page reload using saved session
  useEffect(() => {
    const saved = localStorage.getItem('sqlConnectionConfig');
    if (saved) {
      try {
        const config: ConnectionConfig = JSON.parse(saved);
        setConnectionConfig(config);
        setIsAutoReconnecting(true);
        
        // Silently reconnect - NEVER clear credentials on failure, only on explicit disconnect
        connectToServer(config)
          .then(async (result) => {
            if (result.success) {
              setIsConnected(true);
              await loadDatabases();
            } else {
              // Failed to connect - clear config so UI doesn't look "half-active"
              setConnectionConfig(null);
            }
          })
          .catch(() => {
            setConnectionConfig(null);
          })
          .finally(() => {
            setIsAutoReconnecting(false);
          });
      } catch {
        // Corrupt data - clear it
        localStorage.removeItem('sqlConnectionConfig');
      }
    }
  }, []);

  // Database state
  const [databases, setDatabases] = useState<Database[]>([]);
  const [selectedDatabase, setSelectedDatabase] = useState(() => localStorage.getItem('sql_lastDb') || '');

  // Object state
  const [objects, setObjects] = useState<DbObject[]>([]);
  const [selectedObject, setSelectedObject] = useState<DbObject | null>(null);
  const [objectFilter, setObjectFilter] = useState<ObjectTypeFilter>(() => (localStorage.getItem('sql_lastFilter') as ObjectTypeFilter) || 'all');

  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;
  const [objectTotal, setObjectTotal] = useState(0);
  const [objectHasMore, setObjectHasMore] = useState(false);
  const [isLoadingObjects, setIsLoadingObjects] = useState(false);
  const [searchTerm, setSearchTerm] = useState(() => localStorage.getItem('sql_lastSearch') || '');


  // Query state
  const [query, setQuery] = useState(() => localStorage.getItem('sql_lastQuery') || '');
  const [isExecuting, setIsExecuting] = useState(false);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [queryController, setQueryController] = useState<AbortController | null>(null);
  const [viewingSessionQuery, setViewingSessionQuery] = useState<string | null>(null);
  const [copiedQuery, setCopiedQuery] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [showModifiedObjects, setShowModifiedObjects] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [showExcelTool, setShowExcelTool] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [sessionData, setSessionData] = useState<any[]>([]);
  const [sessionColumns, setSessionColumns] = useState<string[]>([]);
  const [isSessionLoading, setIsSessionLoading] = useState(false);
  const [objectToCompare, setObjectToCompare] = useState<DbObject | null>(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [isResultsVisible, setIsResultsVisible] = useState(true);
  const [isDeepSearch, setIsDeepSearch] = useState(false);
  const [drawerHeight, setDrawerHeight] = useState(55);
  const drawerDragRef = useRef<{startY: number; startHeight: number} | null>(null);
  const [editorFontSize, setEditorFontSize] = useState(14);

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [scriptStatus, setScriptStatus] = useState<{ type: 'loading' | 'success' | 'error', msg: string } | null>(null);
  const [aiRole, setAiRole] = useState(() => localStorage.getItem('app_aiRole') || 'SQL Server Expert');
  const [isSavingAiRole, setIsSavingAiRole] = useState(false);

  // Auto-hide script status after 3 seconds
  useEffect(() => {
    if (scriptStatus && scriptStatus.type !== 'loading') {
      const timer = setTimeout(() => setScriptStatus(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [scriptStatus]);

  // Persistence Effects
  useEffect(() => { localStorage.setItem('sql_lastDb', selectedDatabase); }, [selectedDatabase]);
  useEffect(() => { localStorage.setItem('sql_lastFilter', objectFilter); }, [objectFilter]);
  useEffect(() => {
    if (!isDeepSearch) {
      localStorage.setItem('sql_lastSearch', searchTerm);
    }
  }, [searchTerm, isDeepSearch]);
  useEffect(() => { localStorage.setItem('sql_lastQuery', query); }, [query]);

  // Initial object load on reconnect/refresh
  useEffect(() => {
    if (isConnected && selectedDatabase && objects.length === 0 && !isLoadingObjects) {
      loadObjects(selectedDatabase, objectFilter, 1, pageSize, searchTerm);
    }
  }, [isConnected, selectedDatabase]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsSidebarVisible(prev => !prev);
      }
      if (e.altKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        setIsResultsVisible(prev => !prev);
      }
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Handle connection
  const handleConnect = async (server: string, port: number, username: string, password: string, name?: string, save?: boolean) => {
    // Create new AbortController for this connection attempt
    const controller = new AbortController();
    // Auto-cancel after 15 seconds timeout
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 15000);

    try {
      const config = { server, port, username, password };
      const result = await connectToServer(config, controller.signal);

      clearTimeout(timeoutId);

      if (result.success) {
        setIsConnected(true);
        setConnectionConfig(config);
        
        // Save credentials persistently for auto-reconnect
        localStorage.setItem('sqlConnectionConfig', JSON.stringify(config));

        // Save to MongoDB if requested
        if (save && name) {
          const token = localStorage.getItem('app_authToken');
          fetch('/api/user/saved-connections', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name, server, port, username, password })
          }).catch(err => console.error('Failed to save connection to DB:', err));
        }

        // Load databases
        await loadDatabases();
        // setSidebarTab('objects'); // Switch to explorer on success
      } else {
        console.error(result.error || 'Connection failed');
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name !== 'AbortError') {
        console.error(error.message || 'Connection failed');
      }
    }
  };


  // Load databases
  const loadDatabases = async () => {
    try {
      const dbs = await getDatabases();
      setDatabases(dbs);
    } catch (error: any) {
      console.error('Failed to load databases:', error);
    }
  };

  // Handle database selection
  const handleSelectDatabase = async (db: string) => {
    setSelectedDatabase(db);
    setSelectedObject(null);
    setObjects([]);
    setQueryResult(null);
    setCurrentPage(1);
    setObjectTotal(0);
    setObjectHasMore(false);
    setSearchTerm('');

    if (db) {
      loadObjects(db, objectFilter, 1, pageSize, '');
    }
  };

  const loadObjects = async (
    database: string, 
    filter: ObjectTypeFilter, 
    page: number, 
    size: number,
    search: string,
    deepSearchOverride?: boolean
  ) => {
    setIsLoadingObjects(true);
    const deepSearchActive = deepSearchOverride !== undefined ? deepSearchOverride : isDeepSearch;
    
    try {
      if (deepSearchActive && search) {
        // Use deep search (search inside scripts) with pagination
        const result = await searchScripts(database, search, filter, page, size);
        
        if (page === 1) {
          setObjects(result.objects);
        } else {
          setObjects(prev => [...prev, ...result.objects]);
        }
        
        setObjectTotal(result.total);
        setObjectHasMore(result.hasMore);
        setCurrentPage(page);
      } else {
        // Standard name-based search with pagination
        const result = await getObjects(database, filter, page, size, search || undefined);
        
        if (page === 1) {
          setObjects(result.objects);
        } else {
          setObjects(prev => {
            // Filter out duplicates that might have been loaded due to rapid scroll events
            const existingKeys = new Set(prev.map(o => `${o.schemaName}.${o.objectName}`));
            const newUniqueObjects = result.objects.filter(o => !existingKeys.has(`${o.schemaName}.${o.objectName}`));
            return [...prev, ...newUniqueObjects];
          });
        }
        
        setObjectTotal(result.total);
        setObjectHasMore(result.hasMore);
        setCurrentPage(page);
      }
    } catch (error: any) {
      console.error('Failed to load objects:', error);
      if (page === 1) {
        setObjects([]);
      }
    } finally {
      setIsLoadingObjects(false);
    }
  };

  // Load more objects (infinite scroll)
  const loadMoreObjects = () => {
    if (!isLoadingObjects && objectHasMore && selectedDatabase) {
      loadObjects(selectedDatabase, objectFilter, currentPage + 1, pageSize, searchTerm);
    }
  };

  // Handle object type filter
  const handleObjectTypeFilter = (type: ObjectTypeFilter) => {
    setObjectFilter(type);
    setSelectedObject(null);
    setCurrentPage(1);
    setObjectTotal(0);
    setObjectHasMore(false);
    
    if (selectedDatabase) {
      loadObjects(selectedDatabase, type, 1, pageSize, searchTerm);
    }
  };


  // Handle search
  const handleSearch = (term: string, typeOverride?: ObjectTypeFilter) => {
    setSearchTerm(term);
    
    // If deep search is enabled and we have a term, default to 'all' objects 
    // unless a specific type was requested, because code dependencies can be anywhere.
    const effectiveFilter = (isDeepSearch && term && !typeOverride) ? 'all' : (typeOverride || objectFilter);
    
    if (isDeepSearch && term && !typeOverride) {
      setObjectFilter('all');
    } else if (typeOverride) {
      setObjectFilter(typeOverride);
    }

    setCurrentPage(1);
    setObjectTotal(0);
    setObjectHasMore(false);
    
    if (selectedDatabase) {
      loadObjects(selectedDatabase, effectiveFilter, 1, pageSize, term);
    }
  };

  const mapObjectTypeToFilter = (typeCode: string): ObjectTypeFilter => {
    switch (typeCode.toUpperCase()) {
      case 'U': return 'tables';
      case 'V': return 'views';
      case 'P': return 'procedures';
      case 'FN': return 'scalar_functions';
      case 'TF': return 'table_valued_functions';
      case 'IF': return 'inline_table_functions';
      case 'TR': return 'triggers';
      case 'SN': return 'synonyms';
      default: return 'all';
    }
  };

  const isOffline = databases.find(db => db.name === selectedDatabase)?.status === 'OFFLINE';

  // Handle object selection
  const handleSelectObject = async (obj: any, action: string = 'select') => {
    setSelectedObject(obj);
    
    if (action === 'search_dependencies') {
      setIsDeepSearch(true);
      setSearchTerm(obj.objectName);
      loadObjects(selectedDatabase, 'all', 1, pageSize, obj.objectName, true);
      return;
    }

    // Only generate script if it's explicitly requested (not just highlighting via left-click)
    if (action === 'highlight') {
      return;
    }

    if (selectedDatabase) {
      setScriptStatus({ type: 'loading', msg: `Generating ${action} script for ${obj.objectName}...` });
      try {
        const script = await getObjectScript(selectedDatabase, obj.objectName, obj.objectType, action, obj.schemaName);
        setQuery(script);
        setScriptStatus({ type: 'success', msg: 'Script generated successfully!' });
      } catch (error: any) {
        setQuery('Failed to load script');
        setScriptStatus({ type: 'error', msg: 'Failed to generate script.' });
      }
    }
  };

  const handleModifiedObjectAction = async (obj: any, action: string) => {
    setShowModifiedObjects(false);
    setSelectedObject(obj);
    setSearchTerm(obj.objectName);
    const filterType = mapObjectTypeToFilter(obj.objectType || '');
    setObjectFilter(filterType);

    if (selectedDatabase) {
      if (action === 'compare') {
        setObjectToCompare(obj);
        setShowCompareModal(true);
        return;
      }

      await loadObjects(selectedDatabase, filterType, 1, pageSize, obj.objectName);
      if (action !== 'highlight') {
        setScriptStatus({ type: 'loading', msg: `Generating ${action} script...` });
        try {
          const script = await getObjectScript(selectedDatabase, obj.objectName, obj.objectType, action, obj.schemaName);
          setQuery(script);
          setScriptStatus({ type: 'success', msg: 'Script generated successfully!' });
        } catch (error: any) {
          setQuery('Failed to load script');
          setScriptStatus({ type: 'error', msg: 'Failed to generate script.' });
        }
      }
    }
  };

  // Handle query execution
  const handleExecuteQuery = async (queryText: string) => {
    if (!selectedDatabase) {
      setQueryError('Please select a database first');
      return;
    }

    const controller = new AbortController();
    setQueryController(controller);
    setIsExecuting(true);
    setQueryError(null);
    setQueryResult(null);
    setAiResult(null);

    try {
      const result = await executeQuery(selectedDatabase, queryText, controller.signal);
      setQueryResult(result);
      setIsResultsVisible(true); // Auto-show drawer on success
    } catch (error: any) {
      if (error.name === 'AbortError') {
        setQueryError('Query cancelled');
      } else {
        setQueryError(error.message);
        setIsResultsVisible(true); // Auto-show drawer on error too
      }
    } finally {
      setIsExecuting(false);
      setQueryController(null);
    }
  };

  // Cancel query execution
  const handleCancelQuery = () => {
    if (queryController) {
      queryController.abort();
      setQueryController(null);
      setIsExecuting(false);
      setQueryError('Query cancelled');
    }
  };

  const handleShowSessions = async () => {
    if (!selectedDatabase) return;
    setIsSessionLoading(true);
    setShowSessionModal(true);
    try {
      const sql = `
        SELECT 
          s.session_id as [ID],
          s.login_name as [User],
          s.host_name as [Device],
          db_name(s.database_id) as [Database],
          FORMAT(s.last_request_start_time, 'hh:mm:ss tt') as [Time],
          s.status as [Status],
          COALESCE(st.text, 'N/A') as [Last Query]
        FROM sys.dm_exec_sessions s
        LEFT JOIN sys.dm_exec_connections c ON s.session_id = c.session_id
        OUTER APPLY sys.dm_exec_sql_text(c.most_recent_sql_handle) st
        WHERE s.is_user_process = 1
        ORDER BY s.last_request_end_time DESC
      `;
      const result = await executeQuery(selectedDatabase, sql);
      if (result.results && result.results[0]) {
        setSessionColumns(result.results[0].columns);
        setSessionData(result.results[0].rows);
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      setIsSessionLoading(false);
    }
  };

  // Handle disconnect
  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await disconnect();
      localStorage.removeItem('sqlConnectionConfig');
      setIsConnected(false);
      setConnectionConfig(null);
      setDatabases([]);
      setSelectedDatabase('');
      setObjects([]);
      setSelectedObject(null);
      setQueryResult(null);
      setAiResult(null);
      setQuery('');
      setSearchTerm('');
      setObjectFilter('all');
    } catch (error) {
      console.error('Disconnect failed:', error);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const clearSqlStorage = () => {
    const keysToRemove = [
      'sqlConnectionConfig',
      'sql_lastQuery',
      'sql_lastDb',
      'sql_lastFilter',
      'sql_lastSearch',
      'searchHistory'
    ];
    keysToRemove.forEach(k => localStorage.removeItem(k));
  };

  const handleAppLogin = (token: string, username: string, role?: number, aiRoleParam?: string) => {
    // Clear previous SQL session data on new login
    clearSqlStorage();
    
    localStorage.setItem('app_authToken', token);
    localStorage.setItem('app_authUser', username);
    localStorage.setItem('app_authRole', role?.toString() || '0');
    if (aiRoleParam) {
      localStorage.setItem('app_aiRole', aiRoleParam);
      setAiRole(aiRoleParam);
    }
    setAuthToken(token);
    setAuthUser(username);
    setAuthRole(role || 0);
  };

  const handleAppLogout = () => {
    localStorage.removeItem('app_authToken');
    localStorage.removeItem('app_authUser');
    localStorage.removeItem('app_authRole');
    clearSqlStorage();
    
    setAuthToken(null);
    setAuthUser(null);
    setAuthRole(0);
    setAiRole('SQL Server Expert');
    handleDisconnect(); // also disconnect from SQL
  };
 
  const handleSaveAiRole = async () => {
    if (!authToken) return;
    setIsSavingAiRole(true);
    try {
      const response = await fetch('/api/user/ai-role', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ aiRole })
      });
      if (response.ok) {
        localStorage.setItem('app_aiRole', aiRole);
        setScriptStatus({ type: 'success', msg: 'AI Role saved successfully!' });
      } else {
        throw new Error('Failed to save AI role');
      }
    } catch (error: any) {
      console.error(error);
      setScriptStatus({ type: 'error', msg: 'Failed to save AI Role' });
    } finally {
      setIsSavingAiRole(false);
    }
  };

  const handleResetAiRole = async () => {
    const defaultRole = 'SQL Server Expert';
    setAiRole(defaultRole);
    // If we want to auto-save on reset:
    if (!authToken) return;
    setIsSavingAiRole(true);
    try {
      await fetch('/api/user/ai-role', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ aiRole: defaultRole })
      });
      localStorage.setItem('app_aiRole', defaultRole);
      setScriptStatus({ type: 'success', msg: 'AI Role reset to default' });
    } catch (error) {
      console.error(error);
    } finally {
      setIsSavingAiRole(false);
    }
  };

  if (!authToken) {
    return <Auth onLogin={handleAppLogin} />;
  }


  return (
    <div className={`app h-screen flex flex-col ${isDarkTheme ? 'dark' : ''}`} data-theme={isDarkTheme ? 'dark' : 'light'}>
      {/* Minimal Top Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#dee1e6] dark:bg-[#2d2d2d] border-b border-gray-300 dark:border-[#3c3c3c] shadow-sm">
        <div className="flex items-center gap-3">
          {/* Compact User Section (Now serves as Sidebar Toggle) */}
          <div 
            onClick={() => {
              if (!isConnected) {
                setSidebarTab('servers');
                setIsSidebarVisible(true);
              } else {
                setIsSidebarVisible(!isSidebarVisible);
              }
            }}
            className="flex items-center gap-2.5 px-2 py-1 bg-white/40 dark:bg-white/5 rounded-lg border border-white/30 dark:border-white/10 backdrop-blur-sm shadow-sm cursor-pointer hover:bg-white/60 dark:hover:bg-white/10 transition-all active:scale-95 group"
            title="Toggle Sidebar (Alt+B)"
          >
            <div className="relative">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#0078d4] to-[#5bb4ff] flex items-center justify-center text-white text-[10px] font-black shadow-sm group-hover:shadow-[#0078d4]/50 transition-all">
                {authUser?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#dee1e6] dark:border-[#2d2d2d] ${isConnected ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`}></div>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-black text-gray-800 dark:text-gray-200 uppercase tracking-tight leading-tight">{authUser}</span>
              {isConnected && connectionConfig && (
                <span className="text-[9px] font-bold text-[#0078d4] dark:text-[#5bb4ff] uppercase tracking-tighter leading-none mt-0.5">
                  {connectionConfig.username}@{connectionConfig.server}:{connectionConfig.port}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Ask AI Button */}
          <button
            onClick={() => {
              if (navigator.vibrate) navigator.vibrate(15);
              setIsAIModalOpen(true);
            }}
            className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 bg-[#f0f9ff] dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-[#0078d4] border border-blue-200 dark:border-blue-800 rounded text-[10px] md:text-xs font-bold shadow-sm transition-all"
            title="Ask AI (Alt+A)"
          >
            <span className="text-xs md:text-sm">🤖</span>
            <span className="hidden sm:inline">Ask AI</span>
          </button>

          {/* Zoom Controls Native Dropdown */}
          <div className="flex items-center min-w-max">
            <select
              value={Math.round((editorFontSize / 14) * 100)}
              onChange={(e) => {
                if (navigator.vibrate) navigator.vibrate(5);
                setEditorFontSize(Math.round((parseInt(e.target.value, 10) / 100) * 14));
              }}
              className="bg-white dark:bg-[#1e1e1e] text-[#0078d4] text-[10px] md:text-[11px] font-bold border border-gray-300 dark:border-[#3c3c3c] rounded px-2 py-1 outline-none cursor-pointer hover:bg-gray-50 dark:hover:bg-[#2d2d2d] shadow-sm transition-colors appearance-none h-6"
              style={{ paddingRight: '1.5rem', backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%230078D4%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right .5rem top 50%', backgroundSize: '.65rem auto' }}
              title="Zoom Level"
            >
              <option value="200">200%</option>
              <option value="150">150%</option>
              <option value="125">125%</option>
              <option value="100">100%</option>
              <option value="75">75%</option>
              <option value="50">50%</option>
              <option value="25">25%</option>
            </select>
          </div>

            {authRole >= 1 && (
              <button
                onClick={() => setIsAdminPanelOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-lg text-[11px] font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20 transition-all active:scale-95 group"
                title="Open Admin Dashboard"
              >
                <svg className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-2.533-4.656 6.853 6.853 0 01-5.137 0 4.125 4.125 0 00-2.533 4.656 9.337 9.337 0 004.121.952zm-3.128-4.594A4.125 4.125 0 1115 15.334a4.125 4.125 0 01-3.128-4.594zM2.25 12c0 1.574.313 3.076.88 4.45l-1.547 4.16a.75.75 0 00.957.958l4.16-1.547c1.374.567 2.876.88 4.45.88a9.75 9.75 0 009.034-6.034.75.75 0 00-.067-.655 9.75 9.75 0 00-6.034-9.034.75.75 0 00-.655.067c-1.374.567-2.876.88-4.45.88A9.75 9.75 0 002.25 12z" />
                </svg>
                <span>Admin</span>
              </button>
            )}

            <div className="h-4 w-px bg-slate-300 dark:bg-white/10 mx-1"></div>

          {/* Results Toggle */}
          <button 
            onClick={() => setIsResultsVisible(!isResultsVisible)}
            className={`p-1.5 rounded-md transition-all ${ !isResultsVisible ? 'bg-[#0078d4]/20 text-[#0078d4]' : 'text-gray-500 hover:bg-gray-300 dark:hover:bg-gray-700'}`}
            title="Toggle Results (Alt+R)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              {isResultsVisible 
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              }
            </svg>
          </button>
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setShowLogoutConfirm(false)} />
          <div className="relative bg-white dark:bg-[#1e1e1e] w-full max-w-sm rounded-xl border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400 mx-auto mb-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                </svg>
              </div>
              <h3 className="text-center text-lg font-black text-gray-800 dark:text-white uppercase tracking-tight mb-2">Confirm Logout</h3>
              <p className="text-center text-gray-500 dark:text-gray-400 text-sm font-medium">Do you really want to logout from SQL Studio?</p>
            </div>
            <div className="flex border-t border-gray-200 dark:border-gray-800">
              <button 
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 px-4 py-3 text-sm font-black text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors uppercase tracking-widest"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  setShowLogoutConfirm(false);
                  handleAppLogout();
                }}
                className="flex-1 px-4 py-3 text-sm font-black text-white bg-red-600 hover:bg-red-700 transition-colors uppercase tracking-widest shadow-inner"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* App Content */}
      <div className="app-content relative flex-1 flex overflow-hidden">
        {/* Mobile Sidebar Handle (Left Edge) */}
        {!isSidebarVisible && isMobile && (
          <div
            onClick={() => setIsSidebarVisible(true)}
            className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#0078d4] hover:w-3 cursor-pointer z-[100] transition-all flex items-center justify-center group"
            title="Show Sidebar"
          >
            <span className="text-[8px] text-white opacity-0 group-hover:opacity-100 font-bold">▶</span>
          </div>
        )}

        {/* Desktop Left Edge Handle (when sidebar hidden) */}
        {!isSidebarVisible && !isMobile && (
          <div 
            onClick={() => setIsSidebarVisible(true)}
            className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#0078d4] hover:w-3 cursor-pointer z-[100] transition-all flex items-center justify-center group"
            title="Expand Sidebar"
          >
            <span className="text-[8px] text-white opacity-0 group-hover:opacity-100 font-bold">▶</span>
          </div>
        )}

        {/* Mobile Sidebar */}
        {isMobile && isSidebarVisible && (
          <div className="fixed inset-0 z-[300] flex">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={() => setIsSidebarVisible(false)}/>
            <div className="relative w-[80%] h-full bg-white dark:bg-[#1e1e1e] shadow-2xl animate-slide-in-left">
              <Sidebar 
                sidebarTab={sidebarTab}
                setSidebarTab={setSidebarTab}
                connectionConfig={connectionConfig}
                isConnected={isConnected}
                handleConnect={(s, p, u, pwd) => handleConnect(s, p, u, pwd)}
                handleDisconnect={handleDisconnect}
                databases={databases}
                selectedDatabase={selectedDatabase}
                onSelectDatabase={handleSelectDatabase}
                objects={objects}
                onSelectObject={handleSelectObject}
                selectedObject={selectedObject}
                onObjectTypeFilter={handleObjectTypeFilter}
                objectFilter={objectFilter}
                objectHasMore={objectHasMore}
                isLoadingObjects={isLoadingObjects}
                onLoadMore={loadMoreObjects}
                objectTotal={objectTotal}
                onSearch={handleSearch}
                searchTerm={searchTerm}
                isDeepSearch={isDeepSearch}
                onToggleDeepSearch={setIsDeepSearch}
                onShowModifiedObjects={() => setShowModifiedObjects(true)}
                onShowExcelTool={() => setShowExcelTool(true)}
                onShowCompare={(obj) => {
                  setObjectToCompare(obj);
                  setShowCompareModal(true);
                }}
                onShowSessions={() => handleShowSessions()}
                setShowLogoutConfirm={setShowLogoutConfirm}
              />
              <button onClick={() => setIsSidebarVisible(false)} className="absolute top-1/2 -right-4 w-8 h-8 bg-[#0078d4] text-white rounded-full flex items-center justify-center shadow-lg">◀</button>
            </div>
          </div>
        )}

        <PanelGroup direction={isMobile ? "vertical" : "horizontal"}>
          {!isMobile && isSidebarVisible && (
            <>
              <Panel defaultSize={25} minSize={15}>
                <Sidebar 
                  sidebarTab={sidebarTab}
                  setSidebarTab={setSidebarTab}
                  connectionConfig={connectionConfig}
                  isConnected={isConnected}
                  isAutoReconnecting={isAutoReconnecting}
                  isDisconnecting={isDisconnecting}
                  handleConnect={(s, p, u, pwd) => handleConnect(s, p, u, pwd)}
                  handleDisconnect={handleDisconnect}
                  databases={databases}
                  selectedDatabase={selectedDatabase}
                  onSelectDatabase={handleSelectDatabase}
                  objects={objects}
                  onSelectObject={handleSelectObject}
                  selectedObject={selectedObject}
                  onObjectTypeFilter={handleObjectTypeFilter}
                  objectFilter={objectFilter}
                  objectHasMore={objectHasMore}
                  isLoadingObjects={isLoadingObjects}
                  onLoadMore={loadMoreObjects}
                  objectTotal={objectTotal}
                  onSearch={handleSearch}
                  searchTerm={searchTerm}
                  isDeepSearch={isDeepSearch}
                  onToggleDeepSearch={setIsDeepSearch}
                  onShowModifiedObjects={() => setShowModifiedObjects(true)}
                  onShowExcelTool={() => setShowExcelTool(true)}
                  onShowCompare={(obj) => {
                    setObjectToCompare(obj);
                    setShowCompareModal(true);
                  }}
                  onShowSessions={() => handleShowSessions()}
                  setShowLogoutConfirm={setShowLogoutConfirm}
                />
              </Panel>
              <PanelResizeHandle className="resize-handle-horizontal" />
            </>
          )}
          
          {/* Main Area (Editor + Results Drawer) */}
          <Panel defaultSize={isSidebarVisible && !isMobile ? 75 : 100} minSize={30}>
            <div className="main-panel h-full w-full relative overflow-hidden flex flex-col">
              {/* Query Editor - always takes available space */}
              <div className="flex-1 overflow-hidden relative">
                <QueryEditor
                  onExecute={handleExecuteQuery}
                  onCancel={handleCancelQuery}
                  isExecuting={isExecuting}

                  isOffline={isOffline}
                  highlightTerm={(isDeepSearch && searchTerm) ? searchTerm : undefined}
                  query={query}
                  onQueryChange={setQuery}
                  queryError={queryError}
                  isAIModalOpen={isAIModalOpen}
                  onToggleAI={setIsAIModalOpen}
                  fontSize={editorFontSize}
                  setFontSize={setEditorFontSize}
                  aiRole={aiRole}
                  setAiRole={setAiRole}
                  onSaveAiRole={handleSaveAiRole}
                  onResetAiRole={handleResetAiRole}
                  isSavingAiRole={isSavingAiRole}
                  onShowAIResult={(msg) => {
                    setQueryResult(null);
                    setQueryError(null);
                    setAiResult(null);
                    let cleanCode = msg;
                    const codeBlockMatch = msg.match(/```(?:sql|SQL)?\n([\s\S]*?)\n```/);
                    if (codeBlockMatch) cleanCode = codeBlockMatch[1];
                    const header = `-- =============================================\n-- AI GENERATED CODE\n-- =============================================\n\n`;
                    setQuery(header + cleanCode.trim());
                  }}
                />
              </div>

              {/* Results Bottom Drawer */}
              <div
                className="flex flex-col bg-white dark:bg-[#1e1e1e] border-t-2 border-[#0078d4] shadow-[0_-4px_24px_rgba(0,0,0,0.25)] z-50 flex-shrink-0"
                style={{
                  height: isResultsVisible ? `${drawerHeight}%` : '0%',
                  transition: drawerDragRef.current ? 'none' : 'height 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                  overflow: 'hidden'
                }}
              >
                {/* Drag Handle Bar */}
                <div 
                  className="flex items-center justify-center h-6 cursor-ns-resize bg-[#0078d4]/10 hover:bg-[#0078d4]/20 transition-colors flex-shrink-0 gap-2 select-none"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    drawerDragRef.current = { startY: e.clientY, startHeight: drawerHeight };
                    const onMouseMove = (ev: MouseEvent) => {
                      if (!drawerDragRef.current) return;
                      const parentEl = (e.target as HTMLElement).closest('.main-panel');
                      if (!parentEl) return;
                      const parentHeight = parentEl.clientHeight;
                      const delta = drawerDragRef.current.startY - ev.clientY;
                      const newHeight = drawerDragRef.current.startHeight + (delta / parentHeight) * 100;
                      setDrawerHeight(Math.min(90, Math.max(15, newHeight)));
                    };
                    const onMouseUp = () => {
                      drawerDragRef.current = null;
                      window.removeEventListener('mousemove', onMouseMove);
                      window.removeEventListener('mouseup', onMouseUp);
                    };
                    window.addEventListener('mousemove', onMouseMove);
                    window.addEventListener('mouseup', onMouseUp);
                  }}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    drawerDragRef.current = { startY: e.touches[0].clientY, startHeight: drawerHeight };
                    const onTouchMove = (ev: TouchEvent) => {
                      if (!drawerDragRef.current) return;
                      const parentEl = (e.target as HTMLElement).closest('.main-panel');
                      if (!parentEl) return;
                      const parentHeight = parentEl.clientHeight;
                      const delta = drawerDragRef.current.startY - ev.touches[0].clientY;
                      const newHeight = drawerDragRef.current.startHeight + (delta / parentHeight) * 100;
                      setDrawerHeight(Math.min(90, Math.max(15, newHeight)));
                    };
                    const onTouchEnd = () => {
                      drawerDragRef.current = null;
                      window.removeEventListener('touchmove', onTouchMove);
                      window.removeEventListener('touchend', onTouchEnd);
                    };
                    window.addEventListener('touchmove', onTouchMove, { passive: false });
                    window.addEventListener('touchend', onTouchEnd);
                  }}
                >
                  <div className="w-8 h-1 rounded-full bg-[#0078d4]/50"/>
                  <span 
                    className="text-[9px] font-bold text-[#0078d4] uppercase tracking-widest cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); setIsResultsVisible(!isResultsVisible); }}
                  >
                    {isResultsVisible ? 'Drag or Click to Hide' : 'Show Results'}
                  </span>
                  <div className="w-8 h-1 rounded-full bg-[#0078d4]/50"/>
                </div>
                {/* Results Content */}
                <div className="flex-1 overflow-auto">
                  <ResultsGrid result={queryResult} error={queryError} aiResult={aiResult} />
                </div>
              </div>
            </div>
          </Panel>
        </PanelGroup>
      </div>

      {/* Modals */}
      <ModifiedObjects
        database={selectedDatabase}
        isOpen={showModifiedObjects}
        onClose={() => setShowModifiedObjects(false)}
        onAction={handleModifiedObjectAction}
      />
      <ObjectCompare
        isOpen={showCompareModal}
        onClose={() => {
          setShowCompareModal(false);
          setObjectToCompare(null);
        }}
        databases={databases}
        selectedDatabase={selectedDatabase}
        selectedObject={objectToCompare}
      />
      <ExcelTool
        isOpen={showExcelTool}
        onClose={() => setShowExcelTool(false)}
        database={selectedDatabase}
      />
      {/* User Session Audit Modal */}
      {showSessionModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 md:p-10">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowSessionModal(false)} />
          <div className="relative bg-white dark:bg-[#1e1e1e] w-full max-w-6xl h-[80vh] flex flex-col rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#f8f9fa] dark:bg-[#252526] border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#d97706]/10 flex items-center justify-center text-[#d97706]">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-800 dark:text-white uppercase tracking-tight leading-none">User Session Audit</h3>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Real-time Server Activity Monitoring</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={handleShowSessions}
                  disabled={isSessionLoading}
                  className="p-2 text-gray-500 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-all"
                  title="Refresh Sessions"
                >
                  <svg className={`w-5 h-5 ${isSessionLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>
                <button onClick={() => setShowSessionModal(false)} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg></button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-hidden p-6 bg-[#fcfcfc] dark:bg-[#1e1e1e]">
              {isSessionLoading && sessionData.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-4">
                  <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin"></div>
                  <span className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Scanning Active Sessions...</span>
                </div>
              ) : (
                <div className="h-full border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden bg-white dark:bg-[#252526] shadow-inner">
                  <div className="h-full overflow-auto">
                    <table className="w-full text-left border-collapse min-w-[900px]">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-[#f8f9fa] dark:bg-[#2d2d2d] border-b border-gray-200 dark:border-gray-800">
                          {sessionColumns.map(col => (
                            <th key={col} className="px-4 py-3 text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest whitespace-nowrap">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                        {sessionData.map((row, i) => (
                          <tr key={i} className="hover:bg-blue-50/50 dark:hover:bg-blue-500/5 transition-colors group">
                            {sessionColumns.map(col => (
                              <td key={col} className="px-4 py-3 text-[11px] text-gray-700 dark:text-gray-300 font-medium">
                                {col === 'Last Query' ? (
                                  <div className="flex items-center gap-2">
                                    <div className="max-w-[300px] truncate font-mono text-[10px] text-gray-400">
                                      {row[col]}
                                    </div>
                                    {row[col] !== 'N/A' && (
                                      <button 
                                        onClick={() => setViewingSessionQuery(row[col])}
                                        className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[9px] font-black uppercase rounded shadow-sm transition-all"
                                      >
                                        Inspect
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  row[col]
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-[#f8f9fa] dark:bg-[#252526] border-t border-gray-200 dark:border-gray-800 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">{sessionData.length} Active Users</span>
                </div>
              </div>
              <button 
                onClick={() => setShowSessionModal(false)}
                className="px-6 py-2 bg-gray-800 dark:bg-white text-white dark:text-gray-800 text-[10px] font-black uppercase tracking-widest rounded-lg shadow-lg hover:translate-y-[-2px] transition-all active:translate-y-0"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Query Inspector Modal */}
      {viewingSessionQuery && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setViewingSessionQuery(null)} />
          <div className="relative bg-[#1e1e1e] w-full max-w-4xl h-[70vh] flex flex-col rounded-2xl border border-white/10 shadow-3xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-[#252526]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                </div>
                <h3 className="text-sm font-black text-white uppercase tracking-widest">Query Inspector</h3>
              </div>
              <button onClick={() => setViewingSessionQuery(null)} className="text-gray-400 hover:text-white transition-colors"><svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="flex-1 overflow-auto bg-[#1e1e1e] p-4 font-mono text-xs leading-relaxed">
              <div className="flex h-full">
                {/* Line Numbers */}
                <div className="pr-4 border-r border-white/10 text-gray-600 text-right select-none">
                  {viewingSessionQuery.split('\n').map((_, i) => (
                    <div key={i} className="h-5">{i + 1}</div>
                  ))}
                </div>
                {/* Code Content */}
                <div className="pl-4 flex-1 text-blue-300 overflow-x-auto whitespace-pre">
                  {viewingSessionQuery.split('\n').map((line, i) => (
                    <div key={i} className="h-5 hover:bg-white/5 px-1 rounded transition-colors">{line || ' '}</div>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-3 bg-[#252526] border-t border-white/10 flex justify-end">
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(viewingSessionQuery);
                  setCopiedQuery(true);
                  setTimeout(() => setCopiedQuery(false), 2000);
                }}
                className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded transition-all flex items-center gap-2 ${copiedQuery ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-white/5 hover:bg-white/10 text-white'}`}
              >
                {copiedQuery ? (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3" /></svg>
                    Copy Code
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Script Generation Notification */}
      {scriptStatus && (
        <div className="fixed bottom-6 right-6 z-[2000] animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-md ${
            scriptStatus.type === 'loading' ? 'bg-blue-600/90 border-blue-400 text-white' :
            scriptStatus.type === 'success' ? 'bg-emerald-600/90 border-emerald-400 text-white' :
            'bg-red-600/90 border-red-400 text-white'
          }`}>
            {scriptStatus.type === 'loading' ? (
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : scriptStatus.type === 'success' ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span className="text-[11px] font-black uppercase tracking-widest">{scriptStatus.msg}</span>
          </div>
        </div>
      )}
      {/* Admin Panel Modal */}
      {isAdminPanelOpen && (
        <AdminPanel onClose={() => setIsAdminPanelOpen(false)} />
      )}
    </div>
  );
}

export default App;
