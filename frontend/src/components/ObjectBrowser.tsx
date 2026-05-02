import { useState, useRef, useEffect } from 'react';
import type { Database } from '../api';
import { OBJECT_TYPE_OPTIONS } from '../api';
import type { ObjectTypeFilter } from '../api';

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
}: ObjectBrowserProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; obj: DbObject } | null>(null);
  const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm);
  const [showHistory, setShowHistory] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('searchHistory') || '[]');
    } catch { return []; }
  });
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearchTerm !== searchTerm) {
        onSearch(localSearchTerm);
        if (localSearchTerm.trim()) {
          setSearchHistory(prev => {
            const updated = [localSearchTerm, ...prev.filter(h => h !== localSearchTerm)].slice(0, 10);
            localStorage.setItem('searchHistory', JSON.stringify(updated));
            return updated;
          });
        }
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearchTerm]);

  useEffect(() => {
    setShowHistory(false);
  }, [currentFilter]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowHistory(false);
      }
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
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
    let x = 0;
    let y = 0;

    if ('clientX' in e) {
      x = e.clientX;
      y = e.clientY;
    } else {
      // Basic touch support if needed
      const touch = (e as unknown as React.TouchEvent).touches[0];
      x = touch.clientX;
      y = touch.clientY;
    }

    setContextMenu({ x, y, obj });
  };

  const handleMenuAction = (action: string) => {
    if (contextMenu) {
      onSelectObject(contextMenu.obj, action);
      setContextMenu(null);
    }
  };

  const getShortType = (type: string) => {
    const t = type.toLowerCase();
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
      <div className="flex flex-col gap-1 p-2 bg-[#f3f3f3] dark:bg-[#252526] border-b border-gray-300 dark:border-[#3c3c3c]">
        <div className="flex items-center gap-2">
          <span className="text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-widest">Database</span>
          <select 
            className="flex-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5 text-[10px] md:text-xs font-bold focus:outline-none focus:border-blue-500 dark:text-white"
            value={selectedDatabase}
            onChange={(e) => onSelectDatabase(e.target.value)}
            disabled={databases.length === 0}
          >
            <option value="">Select Database</option>
            {databases.map((db) => (
              <option key={db.name} value={db.name}>
                {db.status === 'OFFLINE' ? '🔴 ' : '🟢 '}{db.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Search Section */}
      <div className="p-2 bg-[#f5f5f5] dark:bg-[#1e1e1e] border-b border-gray-300 dark:border-[#3c3c3c] space-y-2">
        <div className="relative" ref={searchRef}>
          <input
            ref={inputRef}
            type="text"
            className="w-full text-xs p-1.5 pr-8 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 focus:outline-none focus:border-blue-500 dark:text-white"
            placeholder="Search object name..."
            value={localSearchTerm}
            onChange={(e) => setLocalSearchTerm(e.target.value)}
          />
          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {localSearchTerm && (
              <button onClick={() => { setLocalSearchTerm(''); onSearch(''); }} className="text-gray-400 hover:text-gray-600">×</button>
            )}
            <button 
              onClick={() => setShowHistory(!showHistory)} 
              className={`text-[10px] text-gray-400 hover:text-gray-600 px-1 ${showHistory ? 'text-blue-500' : ''}`}
            >
              ▼
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
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400">
        {objects.length === 0 && !isLoading ? (
          <div className="p-4 text-center text-xs text-gray-400 italic">No objects found</div>
        ) : (
          <div className="divide-y divide-gray-200/50 dark:divide-white/5">
            {objects.map((obj) => (
              <div
                key={`${obj.objectType}-${obj.objectName}`}
                className={`flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1 md:py-1.5 cursor-pointer text-[10px] md:text-xs transition-colors ${selectedObject?.objectName === obj.objectName ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100' : 'hover:bg-gray-200 dark:hover:bg-white/5 dark:text-gray-300'}`}
                onClick={() => onSelectObject(obj, 'highlight')}
                onDoubleClick={(e) => handleContextMenu(e, obj)}
                onContextMenu={(e) => handleContextMenu(e, obj)}
              >
                <span className={`w-4 h-4 md:w-5 md:h-5 flex items-center justify-center text-[7px] md:text-[8px] font-black rounded border border-gray-300 dark:border-gray-600 ${selectedObject?.objectName === obj.objectName ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}`}>
                  {getShortType(obj.objectType)}
                </span>
                <span className="flex-1 truncate">{obj.schemaName ? `${obj.schemaName}.${obj.objectName}` : obj.objectName}</span>
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
        <div
          ref={contextMenuRef}
          className="fixed z-[100] bg-white dark:bg-[#252526] border border-gray-300 dark:border-gray-700 shadow-xl py-1 min-w-[160px] text-xs"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          {(contextMenu.obj.objectType === 'TABLE' || contextMenu.obj.objectType === 'VIEW') && (
            <>
              <div className="px-3 py-1.5 hover:bg-blue-600 hover:text-white cursor-pointer dark:text-gray-200" onClick={() => handleMenuAction('select_top_50')}>🔍 Select Top 50</div>
              <div className="h-px bg-gray-200 dark:bg-gray-700 my-1"></div>
            </>
          )}
          <div className="px-3 py-1.5 hover:bg-blue-600 hover:text-white cursor-pointer dark:text-gray-200" onClick={() => handleMenuAction('create')}>📄 Create Script</div>
          <div className="px-3 py-1.5 hover:bg-blue-600 hover:text-white cursor-pointer dark:text-gray-200" onClick={() => handleMenuAction('alter')}>✏️ Alter Script</div>
          <div className="px-3 py-1.5 hover:bg-blue-600 hover:text-white cursor-pointer dark:text-gray-200" onClick={() => handleMenuAction('drop')}>🗑️ Drop Script</div>
          <div className="h-px bg-gray-200 dark:bg-gray-700 my-1"></div>
          <div className="px-3 py-1.5 hover:bg-blue-600 hover:text-white cursor-pointer dark:text-gray-200" onClick={() => handleMenuAction('rename')}>📝 Rename</div>
        </div>
      )}
    </div>
  );
}