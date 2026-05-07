import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { useState, useEffect, useRef } from 'react';
import { ObjectBrowser } from './components/ObjectBrowser';
import { QueryEditor } from './components/QueryEditor';
import { ResultsGrid } from './components/ResultsGrid';
import { ModifiedObjects } from './components/ModifiedObjects';
import { ObjectCompare } from './components/ObjectCompare';
import { ExcelTool } from './components/ExcelTool';
import { Auth } from './components/Auth';
import { ServerLog } from './components/ServerLog';
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
  const [authToken, setAuthToken] = useState<string | null>(() => localStorage.getItem('app_authToken'));
  const [authUser, setAuthUser] = useState<string | null>(() => localStorage.getItem('app_authUser'));
  const [sidebarTab, setSidebarTab] = useState<'servers' | 'objects'>('servers');

  // Auto-reconnect on page reload using saved session
  useEffect(() => {
    const saved = localStorage.getItem('sqlConnectionConfig');
    if (saved) {
      try {
        const config: ConnectionConfig = JSON.parse(saved);
        // Silently reconnect - NEVER clear credentials on failure, only on explicit disconnect
        connectToServer(config)
          .then(async (result) => {
            if (result.success) {
              setIsConnected(true);
              setConnectionConfig(config);
              await loadDatabases();
            }
            // If failed (server down/restarted), just fall through to the login form
            // Keep credentials saved so next reload can try again
          })
          .catch(() => {
            // Network error - keep credentials, just show login form
          })
          .finally(() => {
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
  const [objectScript, setObjectScript] = useState<string | null>(null);
  
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

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [viewingSessionQuery, setViewingSessionQuery] = useState<string | null>(null);

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
    setObjectScript(null);
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
    setObjectScript(null);
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
      try {
        const script = await getObjectScript(selectedDatabase, obj.objectName, obj.objectType, action, obj.schemaName);
        setObjectScript(script);
      } catch (error: any) {
        setObjectScript('Failed to load script');
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
        try {
          const script = await getObjectScript(selectedDatabase, obj.objectName, obj.objectType, action, obj.schemaName);
          setObjectScript(script);
        } catch (error: any) {
          setObjectScript('Failed to load script');
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
    await disconnect();
    localStorage.removeItem('sqlConnectionConfig');
    localStorage.removeItem('sql_lastQuery');
    localStorage.removeItem('sql_lastDb');
    localStorage.removeItem('sql_lastFilter');
    localStorage.removeItem('sql_lastSearch');
    
    setIsConnected(false);
    setConnectionConfig(null);
    setDatabases([]);
    setSelectedDatabase('');
    setObjects([]);
    setSelectedObject(null);
    setObjectScript(null);
    setQueryResult(null);
    setAiResult(null);
    setQuery('');
    setSearchTerm('');
    setObjectFilter('all');
  };

  const handleAppLogin = (token: string, username: string) => {
    localStorage.setItem('app_authToken', token);
    localStorage.setItem('app_authUser', username);
    setAuthToken(token);
    setAuthUser(username);
  };

  const handleAppLogout = () => {
    localStorage.removeItem('app_authToken');
    localStorage.removeItem('app_authUser');
    setAuthToken(null);
    setAuthUser(null);
    handleDisconnect(); // also disconnect from SQL
  };


  if (!authToken) {
    return <Auth onLogin={handleAppLogin} />;
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-white dark:bg-[#1e1e1e] border-r border-gray-300 dark:border-[#3c3c3c]">
      {/* Sidebar Tabs */}
      <div className="flex bg-[#dee1e6] dark:bg-[#2d2d2d] border-b border-gray-300 dark:border-[#3c3c3c]">
        <button 
          onClick={() => setSidebarTab('servers')}
          className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${sidebarTab === 'servers' ? 'bg-white dark:bg-[#1e1e1e] text-[#0078d4] border-t-2 border-t-[#0078d4]' : 'text-gray-500 hover:bg-gray-300 dark:hover:bg-[#3c3c3c]'}`}
        >
          Server Connection
        </button>
        <button 
          onClick={() => setSidebarTab('objects')}
          className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${sidebarTab === 'objects' ? 'bg-white dark:bg-[#1e1e1e] text-[#0078d4] border-t-2 border-t-[#0078d4]' : 'text-gray-500 hover:bg-gray-300 dark:hover:bg-[#3c3c3c]'}`}
        >
          Explorer
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        {sidebarTab === 'servers' ? (
          <ServerLog 
            currentConfig={connectionConfig}
            isConnected={isConnected}
            onConnect={(config) => handleConnect(config.server, config.port, config.username, config.password)}
            onDisconnect={handleDisconnect}
          />
        ) : (
          <ObjectBrowser
            databases={databases}
            selectedDatabase={selectedDatabase}
            isOffline={databases.find(db => db.name === selectedDatabase)?.status === 'OFFLINE'}
            onSelectDatabase={handleSelectDatabase}
            objects={objects}
            onSelectObject={handleSelectObject}
            selectedObject={selectedObject}
            onObjectTypeFilter={handleObjectTypeFilter}
            currentFilter={objectFilter}
            hasMore={objectHasMore}
            isLoading={isLoadingObjects}
            onLoadMore={loadMoreObjects}
            totalObjects={objectTotal}
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
            isConnected={isConnected}
            onShowSessions={() => handleShowSessions()}
          />
        )}
      </div>

      {/* Sidebar Footer with Logout and Version */}
      <div className="p-3 bg-gray-50 dark:bg-[#252526] border-t border-gray-300 dark:border-[#3c3c3c] flex items-center justify-between">
        <button 
          onClick={() => setShowLogoutConfirm(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all group"
          title="Sign Out"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
          </svg>
          <span className="text-[10px] font-black uppercase tracking-tight">Sign Out</span>
        </button>
        <div className="flex flex-col items-end">
          <span className="text-[8px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">Version</span>
          <span className="text-[10px] font-black text-[#0078d4] dark:text-[#5bb4ff] tracking-widest uppercase leading-none mt-0.5">V{new Date().toISOString().split('T')[0].replace(/-/g, '')}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`app h-screen flex flex-col ${isDarkTheme ? 'dark' : ''}`} data-theme={isDarkTheme ? 'dark' : 'light'}>
      {/* Minimal Top Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#dee1e6] dark:bg-[#2d2d2d] border-b border-gray-300 dark:border-[#3c3c3c] shadow-sm">
        <div className="flex items-center gap-3">
          {/* Compact User Section (Now serves as Sidebar Toggle) */}
          <div 
            onClick={() => setIsSidebarVisible(!isSidebarVisible)}
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
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-black text-gray-800 dark:text-gray-200 uppercase tracking-tight leading-none">{authUser}</span>
                {isConnected && connectionConfig && (
                  <span className="text-[7px] font-bold text-[#0078d4] dark:text-[#5bb4ff] uppercase tracking-tighter leading-none border-l border-gray-400 dark:border-gray-600 pl-1.5">
                    {connectionConfig.server}:{connectionConfig.port}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
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
              <SidebarContent />
              <button onClick={() => setIsSidebarVisible(false)} className="absolute top-1/2 -right-4 w-8 h-8 bg-[#0078d4] text-white rounded-full flex items-center justify-center shadow-lg">◀</button>
            </div>
          </div>
        )}

        <PanelGroup orientation={isMobile ? "vertical" : "horizontal"}>
          {!isMobile && isSidebarVisible && (
            <>
              <Panel defaultSize={25} minSize={15}>
                <SidebarContent />
              </Panel>
              <PanelResizeHandle className="resize-handle-horizontal" />
            </>
          )}
          
          {/* Main Area (Editor + Results Drawer) */}
          <Panel defaultSize={isSidebarVisible && !isMobile ? 75 : 100} minSize={30}>
            <div className="main-panel h-full w-full relative overflow-hidden flex flex-col">
              {/* Query Editor - always takes available space */}
              <div className="flex-1 overflow-hidden">
                <QueryEditor
                  onExecute={handleExecuteQuery}
                  onCancel={handleCancelQuery}
                  isExecuting={isExecuting}
                  script={objectScript}
                  isOffline={isOffline}
                  highlightTerm={(isDeepSearch && searchTerm) ? searchTerm : undefined}
                  query={query}
                  onQueryChange={setQuery}
                  queryError={queryError}
                  isAIModalOpen={isAIModalOpen}
                  onToggleAI={setIsAIModalOpen}
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
                className="absolute left-0 right-0 bottom-0 flex flex-col bg-white dark:bg-[#1e1e1e] border-t-2 border-[#0078d4] shadow-[0_-4px_24px_rgba(0,0,0,0.25)] z-50"
                style={{
                  height: `${drawerHeight}%`,
                  transform: isResultsVisible ? 'translateY(0)' : 'translateY(100%)',
                  transition: drawerDragRef.current ? 'none' : 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
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
                  // Optional: add a "Copied!" toast here
                }}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded transition-all flex items-center gap-2"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3" /></svg>
                Copy Code
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
