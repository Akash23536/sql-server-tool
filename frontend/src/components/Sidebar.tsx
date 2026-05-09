import { ServerLog } from './ServerLog';
import { ObjectBrowser } from './ObjectBrowser';
import type { DbObject, Database, ConnectionConfig, ObjectTypeFilter } from '../api';

interface SidebarProps {
  sidebarTab: 'servers' | 'objects';
  setSidebarTab: (tab: 'servers' | 'objects') => void;
  connectionConfig: ConnectionConfig | null;
  isConnected: boolean;
  isAutoReconnecting?: boolean;
  isDisconnecting?: boolean;
  handleConnect: (server: string, port: number, username: string, password: string) => void;
  handleDisconnect: () => void;
  databases: Database[];
  selectedDatabase: string;
  onSelectDatabase: (db: string) => void;
  objects: DbObject[];
  onSelectObject: (obj: any, action?: string) => void;
  selectedObject: DbObject | null;
  onObjectTypeFilter: (type: ObjectTypeFilter) => void;
  objectFilter: ObjectTypeFilter;
  objectHasMore: boolean;
  isLoadingObjects: boolean;
  onLoadMore: () => void;
  objectTotal: number;
  onSearch: (term: string, typeOverride?: ObjectTypeFilter) => void;
  searchTerm: string;
  isDeepSearch: boolean;
  onToggleDeepSearch: (val: boolean) => void;
  onShowModifiedObjects: () => void;
  onShowExcelTool: () => void;
  onShowCompare: (obj: DbObject) => void;
  onShowSessions: () => void;
  setShowLogoutConfirm: (val: boolean) => void;
}

export const Sidebar = ({
  sidebarTab,
  setSidebarTab,
  connectionConfig,
  isConnected,
  isAutoReconnecting,
  isDisconnecting,
  handleConnect,
  handleDisconnect,
  databases,
  selectedDatabase,
  onSelectDatabase,
  objects,
  onSelectObject,
  selectedObject,
  onObjectTypeFilter,
  objectFilter,
  objectHasMore,
  isLoadingObjects,
  onLoadMore,
  objectTotal,
  onSearch,
  searchTerm,
  isDeepSearch,
  onToggleDeepSearch,
  onShowModifiedObjects,
  onShowExcelTool,
  onShowCompare,
  onShowSessions,
  setShowLogoutConfirm
}: SidebarProps) => {
  return (
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
            isAutoReconnecting={isAutoReconnecting}
            isDisconnecting={isDisconnecting}
            onConnect={(config) => handleConnect(config.server, config.port, config.username, config.password)}
            onDisconnect={handleDisconnect}
          />
        ) : (
          <ObjectBrowser
            databases={databases}
            selectedDatabase={selectedDatabase}
            isOffline={databases.find(db => db.name === selectedDatabase)?.status === 'OFFLINE'}
            onSelectDatabase={onSelectDatabase}
            objects={objects}
            onSelectObject={onSelectObject}
            selectedObject={selectedObject}
            onObjectTypeFilter={onObjectTypeFilter}
            currentFilter={objectFilter}
            hasMore={objectHasMore}
            isLoading={isLoadingObjects}
            onLoadMore={onLoadMore}
            totalObjects={objectTotal}
            onSearch={onSearch}
            searchTerm={searchTerm}
            isDeepSearch={isDeepSearch}
            onToggleDeepSearch={onToggleDeepSearch}
            onShowModifiedObjects={onShowModifiedObjects}
            onShowExcelTool={onShowExcelTool}
            onShowCompare={onShowCompare}
            isConnected={isConnected}
            onShowSessions={onShowSessions}
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
          <span className="text-[10px] font-black text-[#0078d4] dark:text-[#5bb4ff] tracking-widest uppercase leading-none mt-0.5">09:05:2026:01</span>
        </div>
      </div>
    </div>
  );
};
