import { useState, useEffect } from 'react';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
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
} from './api';
import type { ConnectionConfig, DbObject, QueryResult, Database } from './api';
import type { ObjectTypeFilter } from './api';
import './App.css';

function App() {
  // Theme state
  const [isDarkTheme, setIsDarkTheme] = useState(() => {
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
  const [connectionController, setConnectionController] = useState<AbortController | null>(null);

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
  const [selectedDatabase, setSelectedDatabase] = useState('');

  // Object state
  const [objects, setObjects] = useState<DbObject[]>([]);
  const [selectedObject, setSelectedObject] = useState<DbObject | null>(null);
  const [objectFilter, setObjectFilter] = useState<ObjectTypeFilter>('all');
  const [objectScript, setObjectScript] = useState<string | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [objectTotal, setObjectTotal] = useState(0);
  const [objectHasMore, setObjectHasMore] = useState(false);
  const [isLoadingObjects, setIsLoadingObjects] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Query state
  const [isExecuting, setIsExecuting] = useState(false);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);

  // Handle connection
  const handleConnect = async (server: string, port: number, username: string, password: string) => {
    // Create new AbortController for this connection attempt
    const controller = new AbortController();
    setConnectionController(controller);
    setIsConnecting(true);
    setConnectionError(null);

    // Auto-cancel after 15 seconds timeout
    const timeoutId = setTimeout(() => {
      if (connectionController) {
        controller.abort();
      }
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
      setConnectionController(null);
    }
  };

  // Cancel connection
  const handleCancel = () => {
    // Use the connectionController from state
    setConnectionController((prev) => {
      if (prev) {
        prev.abort();
        setIsConnecting(false);
        setConnectionError('Connection cancelled');
        return null;
      }
      return prev;
    });
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
    setSearchTerm('');
    if (selectedDatabase) {
      loadObjects(selectedDatabase, type, 1, pageSize, '');
    }
  };

  // Handle page size change
  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
    setObjectHasMore(false);
    if (selectedDatabase) {
      loadObjects(selectedDatabase, objectFilter, 1, size, searchTerm);
    }
  };

  // Handle search
  const handleSearch = (term: string) => {
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

    setIsExecuting(true);
    setQueryError(null);
    setQueryResult(null);

    try {
      const result = await executeQuery(selectedDatabase, queryText);
      setQueryResult(result);
    } catch (error: any) {
      setQueryError(error.message);
    }
    setIsExecuting(false);
  };

  // Handle disconnect
  const handleDisconnect = async () => {
    await disconnect();
    // Only clear on EXPLICIT disconnect - never on errors/reload
    localStorage.removeItem('sqlConnectionConfig');
    setIsConnected(false);
    setConnectionConfig(null);
    setDatabases([]);
    setSelectedDatabase('');
    setObjects([]);
    setSelectedObject(null);
    setObjectScript(null);
    setQueryResult(null);
  };

  // Show a full-screen loader while silently reconnecting
  if (isAutoReconnecting) {
    return (
      <div className="app">
        <div className="app-header">
          <h1>SQL Server Tool</h1>
          <button className="theme-toggle" onClick={() => setIsDarkTheme(!isDarkTheme)}>
            {isDarkTheme ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>
        <div className="reconnect-screen">
          <div className="reconnect-card">
            <div className="reconnect-spinner"></div>
            <h2>Reconnecting…</h2>
            <p>Restoring your session, please wait.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="app">
        <div className="app-header">
          <h1>SQL Server Tool</h1>
          <button className="theme-toggle" onClick={() => setIsDarkTheme(!isDarkTheme)}>
            {isDarkTheme ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>
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
    <div className="app">
      <div className="app-header">
        <h1>SQL Server Tool</h1>
        <div className="header-actions">
          <button className="theme-toggle" onClick={() => setIsDarkTheme(!isDarkTheme)}>
            {isDarkTheme ? '☀️ Light' : '🌙 Dark'}
          </button>
          <div className="connection-info">
            <div className="connection-status">
              <span className={`status-dot ${connectionError ? 'error' : ''}`}></span>
              <span>{connectionConfig?.server}<span className="connection-port">:{connectionConfig?.port}</span></span>
            </div>
          <button className="disconnect-btn" onClick={handleDisconnect}>
            Disconnect
          </button>
        </div>
        </div>
      </div>

      <div className="app-content">
        <PanelGroup orientation="horizontal">
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
              pageSize={pageSize}
              onPageSizeChange={handlePageSizeChange}
              totalObjects={objectTotal}
              onSearch={handleSearch}
              searchTerm={searchTerm}
            />
          </Panel>
          <PanelResizeHandle className="resize-handle-horizontal" />
          <Panel defaultSize={75} minSize={30}>
            <div className="main-panel" style={{ height: '100%', width: '100%' }}>
              <PanelGroup orientation="vertical">
                <Panel defaultSize={60} minSize={20}>
                  <QueryEditor
                    onExecute={handleExecuteQuery}
                    isExecuting={isExecuting}
                    script={objectScript}
                    isOffline={isOffline}
                  />
                </Panel>
                <PanelResizeHandle className="resize-handle-vertical" />
                <Panel defaultSize={40} minSize={20}>
                  <ResultsGrid result={queryResult} error={queryError} />
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
