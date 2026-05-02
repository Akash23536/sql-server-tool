import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import type { ImperativePanelHandle } from 'react-resizable-panels';
import { useRef, useState, useEffect } from 'react';
import { ConnectionForm } from './components/ConnectionForm';
import { ObjectBrowser } from './components/ObjectBrowser';
import { QueryEditor } from './components/QueryEditor';
import { ResultsGrid } from './components/ResultsGrid';
import {
  connectToServer,
  getDatabases,
  getObjects,
  getObjectScript,
  executeQuery,
  disconnect,
  searchScripts,
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
  const resultsPanelRef = useRef<ImperativePanelHandle>(null);

  // Persistence Effects
  useEffect(() => { localStorage.setItem('sql_lastDb', selectedDatabase); }, [selectedDatabase]);
  useEffect(() => { localStorage.setItem('sql_lastFilter', objectFilter); }, [objectFilter]);
  useEffect(() => { localStorage.setItem('sql_lastSearch', searchTerm); }, [searchTerm]);
  useEffect(() => { localStorage.setItem('sql_lastQuery', query); }, [query]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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

  // Load objects with pagination
  const loadObjects = async (
    database: string, 
    filter: ObjectTypeFilter, 
    page: number, 
    size: number,
    search: string
  ) => {
    setIsLoadingObjects(true);
    try {
      const result = await getObjects(database, filter, page, size, search || undefined);
      
      if (page === 1) {
        // First page - replace objects
        setObjects(result.objects);
      } else {
        // Subsequent pages - append objects
        setObjects(prev => [...prev, ...result.objects]);
      }
      
      setObjectTotal(result.total);
      setObjectHasMore(result.hasMore);
      setCurrentPage(page);
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
  const handleSearch = async (term: string, typeOverride?: ObjectTypeFilter) => {
    setSearchTerm(term);
    setCurrentPage(1);
    setObjectHasMore(false);

    if (selectedDatabase) {
      loadObjects(selectedDatabase, objectFilter, 1, pageSize, term);
    }
  };

  const isOffline = databases.find(db => db.name === selectedDatabase)?.status === 'OFFLINE';

  // Handle object selection
  const handleSelectObject = async (obj: any, action: string = 'select') => {
    setSelectedObject(obj);
    
    // Only generate script if it's explicitly requested (not just highlighting via left-click)
    if (action === 'highlight') {
      return;
    }

    if (selectedDatabase) {
      try {
        const script = await getObjectScript(selectedDatabase, obj.objectName, obj.objectType, action);
        setObjectScript(script);
      } catch (error: any) {
        setObjectScript('Failed to load script');
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

    // Auto-expand results panel when executing
    if (resultsPanelRef.current) {
      resultsPanelRef.current.expand();
    }

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
      {/* SSMS Style Toolbar Header */}
      {/* SSMS Style Toolbar Header */}
      <div className="flex items-center justify-between px-3 py-1 bg-[#dee1e6] dark:bg-[#2d2d2d] border-b border-gray-300 dark:border-[#3c3c3c] text-sm shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-2 py-0.5 bg-black/5 dark:bg-white/5 rounded border border-gray-400/20">
            <div className={`w-2 h-2 rounded-full ${isOffline ? 'bg-red-500' : 'bg-green-500'} animate-pulse`}></div>
            <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300 tracking-tight">
              {connectionConfig?.server}:{connectionConfig?.port}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">User:</span>
            <span className="text-[11px] font-extrabold text-[#0078d4] dark:text-[#3a96dd]">
              {connectionConfig?.username?.toUpperCase()}
            </span>
          </div>
          
          <button 
            onClick={handleDisconnect}
            className="px-4 py-1 text-[11px] font-black text-white bg-[#0078d4] hover:bg-[#005a9e] rounded shadow-sm transition-all uppercase tracking-tighter"
          >
            Disconnect
          </button>
        </div>
      </div>

      {/* App Content */}
      <div className="app-content relative">
        <PanelGroup orientation={isMobile ? "vertical" : "horizontal"}>
          {/* Object Browser Panel */}
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
            />
          </Panel>
          
          <PanelResizeHandle className={isMobile ? "resize-handle-vertical" : "resize-handle-horizontal"} />
          
          {/* Main Area (Editor + Results) */}
          <Panel defaultSize={75} minSize={30}>
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
                <Panel defaultSize={40} minSize={20} ref={resultsPanelRef} collapsible>
                  <ResultsGrid result={queryResult} error={queryError} aiResult={aiResult} />
                </Panel>
              </PanelGroup>
            </div>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}

export default App;
