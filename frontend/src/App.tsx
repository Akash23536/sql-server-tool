import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { useState, useEffect, useRef } from 'react';
import { ConnectionForm } from './components/ConnectionForm';
import { ObjectBrowser } from './components/ObjectBrowser';
import { QueryEditor } from './components/QueryEditor';
import { ResultsGrid } from './components/ResultsGrid';
import { ModifiedObjects } from './components/ModifiedObjects';
import { ObjectCompare } from './components/ObjectCompare';
import { ExcelTool } from './components/ExcelTool';
import { Auth } from './components/Auth';
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
  const [isConnecting, setIsConnecting] = useState(false);
  const [isAutoReconnecting, setIsAutoReconnecting] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectionConfig, setConnectionConfig] = useState<ConnectionConfig | null>(null);
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  
  // App authentication state
  const [authToken, setAuthToken] = useState<string | null>(() => localStorage.getItem('app_authToken'));
  const [authUser, setAuthUser] = useState<string | null>(() => localStorage.getItem('app_authUser'));

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
            setIsAutoReconnecting(false);
          });
      } catch {
        // Corrupt data - clear it
        localStorage.removeItem('sqlConnectionConfig');
        setIsAutoReconnecting(false);
      }
    } else {
      setIsAutoReconnecting(false);
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
  const pageSize = 10;
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
  const handleConnect = async (server: string, port: number, username: string, password: string) => {
    // Create new AbortController for this connection attempt
    const controller = new AbortController();
    setIsConnecting(true);
    setConnectionError(null);

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

        // Load databases
        await loadDatabases();
        setShowConnectionModal(false);
      } else {
        setConnectionError(result.error || 'Connection failed');
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        setConnectionError('Connection cancelled');
      } else {
        setConnectionError(error.message || 'Connection failed');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  // Cancel connection
  const handleCancel = () => {
    // Note: To truly cancel, we'd need to store the controller in a ref or state
    // but for now, let's just reset the state as we've simplified the UI.
    setIsConnecting(false);
    setConnectionError('Connection cancelled');
    setShowConnectionModal(false);
  };

  // Load databases
  const loadDatabases = async () => {
    try {
      const dbs = await getDatabases();
      setDatabases(dbs);
    } catch (error: any) {
      console.error('Failed to load databases:', error);
      setConnectionError('Failed to load databases: ' + error.message);
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
          setObjects(prev => [...prev, ...result.objects]);
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

  // Show a full-screen loader while silently reconnecting
  if (isAutoReconnecting) {
    return (
      <div className="app flex items-center justify-center bg-slate-200 dark:bg-slate-900">
        <div className="bg-[#f0f0f0] dark:bg-[#252526] p-10 border border-gray-300 dark:border-gray-700 shadow-2xl rounded-sm flex flex-col items-center gap-6">
          <div className="w-12 h-12 border-4 border-[#0078d4]/20 border-t-[#0078d4] rounded-full animate-spin"></div>
          <div className="text-center">
            <h2 className="text-sm font-extrabold text-gray-700 dark:text-gray-200 uppercase tracking-widest">Reconnecting…</h2>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase mt-2">Restoring your session</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`app h-screen flex flex-col ${isDarkTheme ? 'dark' : ''}`} data-theme={isDarkTheme ? 'dark' : 'light'}>
      {/* Connection Modal Overlay */}
      {showConnectionModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative shadow-2xl rounded-xl overflow-hidden w-full max-w-md border border-white/10">
            <ConnectionForm
              onConnect={handleConnect}
              onCancel={handleCancel}
              isConnecting={isConnecting}
              error={connectionError}
            />
          </div>
        </div>
      )}
      {/* Minimal Top Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#dee1e6] dark:bg-[#2d2d2d] border-b border-gray-300 dark:border-[#3c3c3c] shadow-sm">
        {/* Left: Sidebar Toggle + User Avatar Card */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsSidebarVisible(!isSidebarVisible)}
            className={`p-1.5 rounded-md transition-all ${ isSidebarVisible ? 'bg-[#0078d4]/20 text-[#0078d4]' : 'text-gray-500 hover:bg-gray-300 dark:hover:bg-gray-700'}`}
            title={isSidebarVisible ? 'Hide Sidebar (Alt+B)' : 'Show Sidebar (Alt+B)'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              {isSidebarVisible
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7M18 19l-7-7 7-7" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M6 5l7 7-7 7" />
              }
            </svg>
          </button>

          <button 
            onClick={() => setIsResultsVisible(!isResultsVisible)}
            className={`p-1.5 rounded-md transition-all ${ !isResultsVisible ? 'bg-[#0078d4]/20 text-[#0078d4]' : 'text-gray-500 hover:bg-gray-300 dark:hover:bg-gray-700'}`}
            title={isResultsVisible ? "Hide Results (Alt+R)" : "Show Results (Alt+R)"}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              {isResultsVisible 
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              }
            </svg>
          </button>

          {/* Combined Avatar Card */}
          <div 
            onClick={async () => {
              if (!connectionConfig || !selectedDatabase) {
                alert("Please select a database first.");
                return;
              }
              setShowSessionModal(true);
              setIsSessionLoading(true);
              const sessionQuery = `SELECT \n    session_id AS [Session ID],\n    login_name AS [Login User],\n    host_name AS [Desktop],\n    program_name AS [Program],\n    client_interface_name AS [Server Access],\n    DB_NAME(database_id) AS [Database Name],\n    status AS [Status],\n    last_request_end_time AS [Last Response Time]\nFROM sys.dm_exec_sessions\nWHERE is_user_process = 1\nORDER BY login_name;`;
              try {
                const res = await executeQuery(selectedDatabase, sessionQuery);
                const resultSet = res.results?.[0];
                setSessionData(resultSet?.rows || []);
                setSessionColumns(resultSet?.columns || []);
              } catch (e: any) {
                console.error(e);
                alert("Failed to fetch sessions: " + e.message);
              } finally {
                setIsSessionLoading(false);
              }
            }}
            title="Click to view current user sessions and access details"
            className="flex items-center gap-2.5 px-3 py-1 bg-white/40 dark:bg-white/5 hover:bg-white/60 dark:hover:bg-white/10 rounded-lg border border-white/30 dark:border-white/10 backdrop-blur-sm shadow-sm cursor-pointer transition-all active:scale-95"
          >
            {/* Avatar circle */}
            <div className="relative flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0078d4] via-[#2a8fd4] to-[#5bb4ff] flex items-center justify-center text-white text-sm font-black shadow-md ring-2 ring-white/60 dark:ring-white/10">
                {connectionConfig?.username?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#dee1e6] dark:border-[#2d2d2d] ${isOffline ? 'bg-red-500' : 'bg-emerald-400'}`}></div>
            </div>
            {/* Text info */}
            <div className="flex flex-col justify-center">
              <span className="text-[11px] font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight leading-none">
                {connectionConfig?.username || 'USER'}
              </span>
              <span className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 leading-none mt-0.5">
                {connectionConfig?.server}:{connectionConfig?.port}
              </span>
            </div>
          </div>
        </div>

        {/* Right: User Info and Disconnect */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end mr-2">
            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">App User: {authUser}</span>
            <button 
              onClick={handleAppLogout}
              className="text-[10px] text-blue-500 hover:underline"
            >
              Sign out of App
            </button>
          </div>
          <button 
            onClick={handleDisconnect}
            title="Disconnect DB"
            className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-red-500 hover:bg-red-500 hover:text-white transition-all duration-200 border border-red-300/30 hover:border-red-500 hover:shadow-lg hover:shadow-red-500/20 hover:scale-105 active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
            <span className="text-[10px] font-black uppercase tracking-widest">Disconnect DB</span>
          </button>
        </div>
      </div>

      {/* App Content */}
      <div className="app-content relative flex overflow-hidden">
        {/* Mobile Sidebar Handle (Left Edge) */}
        {!isSidebarVisible && isMobile && (
          <div
            onClick={() => setIsSidebarVisible(true)}
            className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#0078d4] hover:w-3 cursor-pointer z-[100] transition-all flex items-center justify-center group"
            title="Show Object Browser"
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

        {/* Mobile Drawer Backdrop & Sidebar */}
        {isMobile && isSidebarVisible && (
          <div className="fixed inset-0 z-[300] flex">
            <div 
              className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" 
              onClick={() => setIsSidebarVisible(false)}
            />
            <div className="relative w-[80%] h-full bg-white dark:bg-[#1e1e1e] shadow-2xl animate-slide-in-left">
              <ObjectBrowser
                databases={databases}
                selectedDatabase={selectedDatabase}
                isOffline={isOffline}
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
                onShowConnectionForm={() => setShowConnectionModal(true)}
              />
              <button 
                onClick={() => setIsSidebarVisible(false)}
                className="absolute top-1/2 -right-4 w-8 h-8 bg-[#0078d4] text-white rounded-full flex items-center justify-center shadow-lg z-[301]"
              >
                <span className="text-xs font-bold">◀</span>
              </button>
            </div>
          </div>
        )}

        <PanelGroup orientation={isMobile ? "vertical" : "horizontal"}>
          {/* Object Browser Panel (Desktop Only) */}
          {!isMobile && isSidebarVisible && (
            <>
              <Panel defaultSize={25} minSize={15}>
                <ObjectBrowser
                  databases={databases}
                  selectedDatabase={selectedDatabase}
                  isOffline={isOffline}
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
                  onShowConnectionForm={() => setShowConnectionModal(true)}
                />
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
                  onTouchStart={(e) => {
                    const touch = e.touches[0];
                    drawerDragRef.current = { startY: touch.clientY, startHeight: drawerHeight };
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
                    window.addEventListener('touchmove', onTouchMove);
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

      {/* Modified Objects Modal */}
      <ModifiedObjects
        database={selectedDatabase}
        isOpen={showModifiedObjects}
        onClose={() => setShowModifiedObjects(false)}
        onAction={handleModifiedObjectAction}
      />

      {/* Object Compare Modal */}
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

      {/* Excel Tool Modal */}
      <ExcelTool
        isOpen={showExcelTool}
        onClose={() => setShowExcelTool(false)}
        database={selectedDatabase}
      />

      {/* Session Modal */}
      {showSessionModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
          <div className="bg-white dark:bg-[#1e1e1e] w-full max-w-5xl max-h-[80vh] flex flex-col border border-gray-300 dark:border-gray-700 shadow-2xl rounded-sm m-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-[#2d2d2d]">
              <h3 className="font-bold text-gray-800 dark:text-gray-100 uppercase tracking-tight">Active User Sessions</h3>
              <button onClick={() => setShowSessionModal(false)} className="text-gray-500 hover:text-red-500 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {isSessionLoading ? (
                <div className="flex flex-col items-center justify-center text-gray-500 my-12 gap-3">
                  <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
                  <span className="font-semibold uppercase tracking-widest text-xs">Loading sessions...</span>
                </div>
              ) : sessionData.length > 0 ? (
                <div className="overflow-x-auto border border-gray-300 dark:border-gray-700 rounded">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-100 dark:bg-[#2d2d2d] text-gray-700 dark:text-gray-300 border-b border-gray-300 dark:border-gray-700">
                        {sessionColumns.map(col => <th key={col} className="p-2 border-r border-gray-300 dark:border-gray-700 font-bold whitespace-nowrap">{col}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {sessionData.map((row, i) => (
                        <tr key={i} className="border-b border-gray-200 dark:border-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/20">
                          {sessionColumns.map((col, j) => (
                            <td key={j} className="p-2 border-r border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200 whitespace-nowrap">
                              {row[col] !== null ? String(row[col]) : <span className="text-gray-400 italic">NULL</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center text-gray-500 my-8 font-bold">No active user sessions found.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
