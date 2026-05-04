import { useState, useRef, useEffect } from 'react';
import type { Database } from '../api';
import { OBJECT_TYPE_OPTIONS } from '../api';
import type { ObjectTypeFilter } from '../api';
import { ObjectContextMenu } from './ObjectContextMenu';

interface DbObject {
  objectName: string;
  objectType: string;
  schemaName?: string;
  objectId?: number;
  createDate?: string;
  modifyDate?: string;
}

interface ObjectBrowserProps {
  databases: Database[];
  selectedDatabase: string;
  onSelectDatabase: (db: string) => void;
  objects: DbObject[];
  onSelectObject: (obj: DbObject, action: string) => void;
  selectedObject: DbObject | null;
  onObjectTypeFilter: (type: ObjectTypeFilter) => void;
  currentFilter: ObjectTypeFilter;
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  totalObjects: number;
  onSearch: (term: string, typeOverride?: ObjectTypeFilter) => void;
  searchTerm: string;
  isOffline?: boolean;
  isDeepSearch?: boolean;
  onToggleDeepSearch?: (enabled: boolean) => void;
  onShowModifiedObjects?: () => void;
  onShowExcelTool?: () => void;
  onShowCompare?: (obj: DbObject) => void;
}

export function ObjectBrowser({
  databases,
  selectedDatabase,
  onSelectDatabase,
  objects,
  onSelectObject,
  selectedObject,
  onObjectTypeFilter,
  currentFilter,
  hasMore,
  isLoading,
  onLoadMore,
  totalObjects,
  onSearch,
  searchTerm,
  isDeepSearch,
  onToggleDeepSearch,
  onShowModifiedObjects,
  onShowExcelTool,
  onShowCompare,
}: ObjectBrowserProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; obj: DbObject } | null>(null);
  const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm);
  const [showHistory, setShowHistory] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('searchHistory') || '[]');
    } catch { return []; }
  });
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Disable automatic search for Deep Search (Code mode)
    if (isDeepSearch) return;

    const timer = setTimeout(() => {
      const normalizedSearch = localSearchTerm.replace(/\s+/g, ' ').trim();
      if (normalizedSearch !== searchTerm) {
        onSearch(normalizedSearch);
        if (normalizedSearch) {
          setSearchHistory(prev => {
            const updated = [normalizedSearch, ...prev.filter(h => h !== normalizedSearch)].slice(0, 10);
            localStorage.setItem('searchHistory', JSON.stringify(updated));
            return updated;
          });
        }
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [localSearchTerm, searchTerm, isDeepSearch]);

  const handleManualSearch = () => {
    const normalizedSearch = localSearchTerm.replace(/\s+/g, ' ').trim();
    onSearch(normalizedSearch);
    if (normalizedSearch) {
      setSearchHistory(prev => {
        const updated = [normalizedSearch, ...prev.filter(h => h !== normalizedSearch)].slice(0, 10);
        localStorage.setItem('searchHistory', JSON.stringify(updated));
        return updated;
      });
    }
    setShowHistory(false);
  };

  useEffect(() => {
    setShowHistory(false);
  }, [currentFilter]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowHistory(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          onLoadMore();
        }
      },
      { threshold: 0.1 }
    );
    if (loadingRef.current) observerRef.current.observe(loadingRef.current);
    return () => observerRef.current?.disconnect();
  }, [hasMore, isLoading, onLoadMore]);

  const handleContextMenu = (e: React.MouseEvent | React.TouchEvent | React.PointerEvent, obj: DbObject) => {
    e.preventDefault();
    e.stopPropagation();
    let x = 0;
    let y = 0;

    if ('clientX' in e) {
      x = e.clientX;
      y = e.clientY;
    } else {
      const touch = (e as unknown as React.TouchEvent).touches[0];
      x = touch.clientX;
      y = touch.clientY;
    }

    setContextMenu({ x, y, obj });
  };

  const handleMenuAction = (obj: DbObject, action: string) => {
    if (action === 'compare') {
      onShowCompare?.(obj);
    } else {
      onSelectObject(obj, action);
    }
  };

  const getShortType = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('inline')) return 'IF';
    if (t.includes('table valued function')) return 'TF';
    if (t.includes('scalar function')) return 'FN';
    if (t.includes('table')) return 'U';
    if (t.includes('view')) return 'V';
    if (t.includes('procedure')) return 'P';
    if (t.includes('trigger')) return 'TR';
    if (t.includes('synonym')) return 'SN';
    return 'O';
  };

  return (
    <div className="flex flex-col h-full bg-[#f0f0f0] dark:bg-[#252526] border-r border-gray-300 dark:border-[#3c3c3c] overflow-hidden select-none">
      {/* Header Section */}
      <div className="flex flex-col gap-2 p-2 bg-[#f3f3f3] dark:bg-[#252526] border-b border-gray-300 dark:border-[#3c3c3c] shadow-sm">
        {/* Database Selector Row - no label */}
        <div className="relative flex items-center">
          {/* DB icon prefix */}
          <div className="absolute left-2 z-10 pointer-events-none">
            <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7c0 2.21-3.582 4-8 4S4 9.21 4 7m16 0c0-2.21-3.582-4-8-4S4 4.79 4 7m16 0v5c0 2.21-3.582 4-8 4S4 14.21 4 12V7m16 5v5c0 2.21-3.582 4-8 4S4 19.21 4 17v-5" />
            </svg>
          </div>
          <select 
            className="w-full pl-7 pr-7 py-1.5 bg-white dark:bg-[#1e1e1e] border border-gray-300 dark:border-gray-600 rounded text-[11px] font-bold focus:outline-none focus:border-blue-500 dark:text-white appearance-none cursor-pointer"
            value={selectedDatabase}
            onChange={(e) => onSelectDatabase(e.target.value)}
            disabled={databases.length === 0}
          >
            <option value="">Select Database…</option>
            {databases.map((db) => (
              <option key={db.name} value={db.name}>
                {db.status === 'OFFLINE' ? '🔴 ' : '🟢 '}{db.name}
              </option>
            ))}
          </select>
          {/* Custom dropdown arrow */}
          <div className="absolute right-2 pointer-events-none">
            <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Action buttons row - 50/50 split */}
        <div className="flex gap-2">
          <button
            onClick={() => onShowModifiedObjects?.()}
            disabled={!selectedDatabase}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-[#4f46e5] hover:bg-[#4338ca] disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-[10px] font-black rounded shadow-sm transition-all hover:translate-y-[-1px] active:translate-y-[0px] uppercase tracking-wider"
            title="Show Modified Database Object Log"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="truncate">Logs</span>
          </button>
          <button
            onClick={() => onShowExcelTool?.()}
            disabled={!selectedDatabase}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-[#107c41] hover:bg-[#0d6635] disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-[10px] font-black rounded shadow-sm transition-all hover:translate-y-[-1px] active:translate-y-[0px] uppercase tracking-wider"
            title="Excel Export / Import"
          >
            <svg viewBox="0 0 32 32" className="w-3.5 h-3.5" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17 3H7C5.89543 3 5 3.89543 5 5V27C5 28.1046 5.89543 29 7 29H25C26.1046 29 27 28.1046 27 27V13L17 3Z" fill="currentColor" fillOpacity="0.2"/>
              <path d="M17 3V13H27L17 3Z" fill="currentColor" fillOpacity="0.4"/>
              <path d="M11 15L15 21L11 27H14L16.5 23L19 27H22L18 21L22 15H19L16.5 19L14 15H11Z" fill="white"/>
            </svg>
            <span className="truncate">Excel</span>
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="p-2 md:p-3 border-b border-gray-200 dark:border-white/5 space-y-2 md:space-y-3 bg-white dark:bg-[#1e1e1e]">
        {/* Deep Search Toggle */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <span className={`text-[9px] font-black uppercase tracking-widest ${!isDeepSearch ? 'text-[#0078d4]' : 'text-gray-400'}`}>Object Name</span>
            <button
              onClick={() => onToggleDeepSearch?.(!isDeepSearch)}
              className={`relative w-8 h-4 rounded-full transition-colors ${isDeepSearch ? 'bg-[#0078d4]' : 'bg-gray-300 dark:bg-gray-700'}`}
              title="Toggle Deep Search (Search inside object code)"
            >
              <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${isDeepSearch ? 'left-[18px]' : 'left-0.5 shadow-sm'}`} />
            </button>
            <span className={`text-[9px] font-black uppercase tracking-widest ${isDeepSearch ? 'text-[#0078d4]' : 'text-gray-400'}`}>Deep Search</span>
          </div>
          <div className="text-[9px] font-bold text-gray-400 uppercase italic">
            {isDeepSearch ? 'Searching in Code...' : 'Searching by Name'}
          </div>
        </div>

        <div className="relative group" ref={searchRef}>
          <input
            ref={inputRef}
            type="text"
            placeholder={isDeepSearch ? "Enter word to find in code..." : "Filter objects by name..."}
            className={`w-full pl-8 py-1.5 md:py-2 bg-gray-100 dark:bg-white/5 border-none rounded text-[11px] md:text-xs outline-none focus:ring-1 focus:ring-[#0078d4]/50 transition-all font-medium dark:text-gray-200 ${isDeepSearch ? 'pr-14' : 'pr-10'}`}
            value={localSearchTerm}
            onChange={(e) => setLocalSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleManualSearch();
              }
            }}
          />
          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {isLoading && (
              <div className="w-3 h-3 border-2 border-[#0078d4]/20 border-t-[#0078d4] rounded-full animate-spin mr-1"></div>
            )}
            {localSearchTerm && !isLoading && (
              <button
                onClick={() => { setLocalSearchTerm(''); onSearch(''); }}
                className="p-1 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                title="Clear Search"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            {isDeepSearch && (
              <button
                onClick={handleManualSearch}
                disabled={isLoading || !localSearchTerm.trim()}
                className={`flex items-center justify-center w-7 h-7 rounded bg-[#0078d4] text-white hover:bg-[#005a9e] disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed shadow-md transition-all active:scale-95`}
                title="Run Deep Search"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            )}
            <button 
              onClick={() => setShowHistory(!showHistory)} 
              className={`p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors ${showHistory ? 'text-[#0078d4]' : ''}`}
              title="Search History"
            >
              <svg className={`w-3 h-3 transition-transform ${showHistory ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
          
          {showHistory && searchHistory.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-50 bg-white dark:bg-[#252526] border border-gray-300 dark:border-gray-700 shadow-lg max-h-40 overflow-y-auto">
              <div className="flex justify-between px-2 py-1 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <span className="text-[9px] font-bold text-gray-500 uppercase">Recent</span>
                <button onClick={() => { setSearchHistory([]); localStorage.removeItem('searchHistory'); }} className="text-[9px] text-blue-500">Clear</button>
              </div>
              {searchHistory.map((h, i) => (
                <div key={i} onMouseDown={() => { setLocalSearchTerm(h); onSearch(h); setShowHistory(false); }} className="px-2 py-1 text-xs hover:bg-blue-100 dark:hover:bg-blue-900 cursor-pointer truncate dark:text-gray-300">
                  {h}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Filter Section */}
      <div className="px-2 py-1 bg-[#dee1e6] dark:bg-[#2d2d2d] flex items-center justify-between border-b border-gray-300 dark:border-[#3c3c3c]">
        <select 
          className="text-[10px] font-bold bg-transparent border-none focus:outline-none text-gray-600 dark:text-gray-300 cursor-pointer"
          value={currentFilter}
          onChange={(e) => onObjectTypeFilter(e.target.value as ObjectTypeFilter)}
        >
          {OBJECT_TYPE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value} className="bg-white dark:bg-gray-800">{opt.label.toUpperCase()}</option>
          ))}
        </select>
        <span className="text-[10px] font-bold text-gray-400">{totalObjects} objects</span>
      </div>

      {/* List Section */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 relative">
        {/* Top Loading Bar (Processing) */}
        {isLoading && (
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#0078d4]/10 overflow-hidden z-20">
            <div className="h-full bg-[#0078d4] w-1/3 animate-[loading_1.5s_infinite_ease-in-out]"></div>
          </div>
        )}

        {/* Initial Search Spinner */}
        {isLoading && objects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="relative group">
              <div className="w-14 h-14 border-4 border-[#0078d4]/5 rounded-full scale-110 transition-transform"></div>
              <div className="absolute inset-0 border-4 border-transparent border-t-[#0078d4] border-r-[#0078d4]/30 rounded-full animate-spin"></div>
              <div className="absolute inset-2 border-2 border-transparent border-b-[#0078d4]/60 rounded-full animate-[spin_2s_linear_infinite_reverse]"></div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[11px] font-black text-gray-700 dark:text-gray-200 uppercase tracking-widest animate-pulse">Processing...</span>
              <span className="text-[9px] text-gray-400 font-bold uppercase italic tracking-tight">Fetching Data from Server</span>
            </div>
          </div>
        ) : objects.length === 0 && !isLoading ? (
          <div className="p-8 text-center flex flex-col items-center gap-2">
            <span className="text-2xl opacity-20">🔍</span>
            <span className="text-[11px] text-gray-400 font-bold uppercase italic">No objects found matching your criteria</span>
          </div>
        ) : (
          <div className="divide-y divide-gray-200/50 dark:divide-white/5 pb-10">
            {objects.map((obj) => (
              <div
                key={`${obj.objectType}-${obj.objectName}`}
                className={`flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1 md:py-1.5 cursor-pointer text-[10px] md:text-xs transition-colors ${selectedObject?.objectName === obj.objectName ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100' : 'hover:bg-gray-200 dark:hover:bg-white/5 dark:text-gray-300'}`}
                onClick={() => onSelectObject(obj, 'highlight')}
                onContextMenu={(e) => handleContextMenu(e, obj)}
              >
                <span className={`w-4 h-4 md:w-5 md:h-5 flex items-center justify-center text-[7px] md:text-[8px] font-black rounded border border-gray-300 dark:border-gray-600 ${selectedObject?.objectName === obj.objectName ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}`}>
                  {getShortType(obj.objectType)}
                </span>
                <span className="flex-1 min-w-0 text-[10px] md:text-xs break-words">{obj.schemaName ? `${obj.schemaName}.${obj.objectName}` : obj.objectName}</span>
              </div>
            ))}
            <div ref={loadingRef} className="p-2 text-center text-[10px] text-gray-400">
              {isLoading ? 'Loading objects...' : (hasMore ? 'Scroll for more' : 'End of list')}
            </div>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ObjectContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          obj={contextMenu.obj}
          onAction={handleMenuAction}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}