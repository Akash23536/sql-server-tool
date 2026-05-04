import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { useState, useEffect } from 'react';
import { ConnectionForm } from './components/ConnectionForm';
import { ObjectBrowser } from './components/ObjectBrowser';
import { QueryEditor } from './components/QueryEditor';
import { ResultsGrid } from './components/ResultsGrid';
import { ModifiedObjects } from './components/ModifiedObjects';
import { ObjectCompare } from './components/ObjectCompare';
import { ExcelTool } from './components/ExcelTool';
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
  const [objectToCompare, setObjectToCompare] = useState<DbObject | null>(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [isDeepSearch, setIsDeepSearch] = useState(() => localStorage.getItem('sql_isDeepSearch') === 'true');

  // Persistence Effects
  useEffect(() => { localStorage.setItem('sql_lastDb', selectedDatabase); }, [selectedDatabase]);
  useEffect(() => { localStorage.setItem('sql_lastFilter', objectFilter); }, [objectFilter]);
  useEffect(() => { localStorage.setItem('sql_lastSearch', searchTerm); }, [searchTerm]);
  useEffect(() => { localStorage.setItem('sql_lastQuery', query); }, [query]);
  useEffect(() => { localStorage.setItem('sql_isDeepSearch', isDeepSearch.toString()); }, [isDeepSearch]);

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
    } catch (error: any) {
      if (error.name === 'AbortError') {
        setQueryError('Query cancelled');
      } else {
        setQueryError(error.message);
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

  if (!isConnected) {
    return (
      <div className="app bg-slate-200 dark:bg-slate-900">
        <ConnectionForm
          onConnect={handleConnect}
          onCancel={handleCancel}
          isConnecting={isConnecting}
          error={connectionError}
        />
      </div>
    );
  }

  return (
    <div className={`app h-screen flex flex-col ${isDarkTheme ? 'dark' : ''}`} data-theme={isDarkTheme ? 'dark' : 'light'}>
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

          {/* Combined Avatar Card */}
          <div className="flex items-center gap-2.5 px-3 py-1 bg-white/40 dark:bg-white/5 rounded-lg border border-white/30 dark:border-white/10 backdrop-blur-sm shadow-sm">
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

        {/* Right: Disconnect icon button only */}
        <button 
          onClick={handleDisconnect}
          title="Disconnect"
          className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-red-500 hover:bg-red-500 hover:text-white transition-all duration-200 border border-red-300/30 hover:border-red-500 hover:shadow-lg hover:shadow-red-500/20 hover:scale-105 active:scale-95"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
          </svg>
          <span className="text-[10px] font-black uppercase tracking-widest">Disconnect</span>
        </button>
      </div>

      {/* App Content */}
      <div className="app-content relative flex overflow-hidden">
        {/* Mobile Top Toggle Handle (when sidebar hidden) */}
        {!isSidebarVisible && isMobile && (
          <div
            onClick={() => setIsSidebarVisible(true)}
            className="absolute top-0 left-0 right-0 h-1.5 bg-[#0078d4] hover:h-3 cursor-pointer z-[100] transition-all flex items-center justify-center group"
            title="Show Object Browser"
          >
            <span className="text-[8px] text-white opacity-0 group-hover:opacity-100 font-bold">▼</span>
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

        <PanelGroup orientation={isMobile ? "vertical" : "horizontal"}>
          {/* Object Browser Panel */}
          {isSidebarVisible && (
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
                />
              </Panel>
              <PanelResizeHandle className={isMobile ? "resize-handle-vertical" : "resize-handle-horizontal"} />
            </>
          )}
          
          {/* Main Area (Editor + Results) */}
          <Panel defaultSize={isSidebarVisible ? 75 : 100} minSize={30}>
            <div className="main-panel h-full w-full">
              <PanelGroup orientation="vertical">
                {/* Editor Panel */}
                <Panel defaultSize={60} minSize={20}>
                  <QueryEditor
                    onExecute={handleExecuteQuery}
                    onCancel={handleCancelQuery}
                    isExecuting={isExecuting}
                    script={objectScript}
                    isOffline={isOffline}
                    highlightTerm={searchTerm}
                    query={query}
                    onQueryChange={setQuery}
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
                </Panel>
                
                <PanelResizeHandle className="resize-handle-vertical" />
                
                {/* Results Panel */}
                <Panel defaultSize={40} minSize={20} collapsible>
                  <ResultsGrid result={queryResult} error={queryError} aiResult={aiResult} />
                </Panel>
              </PanelGroup>
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
    </div>
  );
}

export default App;
