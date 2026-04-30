import { useState, useRef, useEffect } from 'react';
import './ObjectBrowser.css';
import type { Database, ObjectCounts } from '../api';
import { OBJECT_TYPE_OPTIONS, getObjectCounts } from '../api';
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
  onSearch: (term: string) => void;
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
  isOffline = false,
}: ObjectBrowserProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; obj: DbObject } | null>(null);
  const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm);
  const [showHistory, setShowHistory] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('searchHistory') || '[]');
    } catch { return []; }
  });
  const [objectCounts, setObjectCounts] = useState<ObjectCounts | null>(null);

  useEffect(() => {
    if (selectedDatabase) {
      getObjectCounts(selectedDatabase).then(setObjectCounts).catch(console.error);
    } else {
      setObjectCounts(null);
    }
  }, [selectedDatabase]);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearchTerm !== searchTerm) {
        onSearch(localSearchTerm);
        // Save to history if non-empty
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

  // Reset search when filter changes
  useEffect(() => {
    setLocalSearchTerm('');
    setShowHistory(false);
  }, [currentFilter]);

  // Close history dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowHistory(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          onLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadingRef.current) {
      observerRef.current.observe(loadingRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, isLoading, onLoadMore]);

  const getShortType = (type: string) => {
    const t = type.toLowerCase().replace(/_/g, ' ');
    if (t.includes('table valued function')) return 'TF';
    if (t.includes('scalar function')) return 'FN';
    if (t.includes('table')) return 'U';
    if (t.includes('view')) return 'V';
    if (t.includes('procedure')) return 'P';
    if (t.includes('function')) return 'F';
    if (t.includes('trigger')) return 'TR';
    if (t.includes('synonym')) return 'SN';
    return 'O';
  };

  // Handle right-click context menu
  const handleContextMenu = (e: React.MouseEvent, obj: DbObject) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, obj });
  };

  // Handle menu action
  const handleMenuAction = (action: string) => {
    if (contextMenu) {
      onSelectObject(contextMenu.obj, action);
      setContextMenu(null);
    }
  };

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Handle dropdown change
  const handleObjectTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onObjectTypeFilter(e.target.value as ObjectTypeFilter);
  };

  return (
    <div className="object-browser">
      {/* Database Selector */}
      <div className="database-selector">
        <label>Database:</label>
        <select
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

      {/* Search Box with History */}
      <div className="search-box" ref={searchRef}>
        <input
          ref={inputRef}
          type="text"
          placeholder={isOffline ? "Database offline" : "Search objects..."}
          value={localSearchTerm}
          onChange={(e) => setLocalSearchTerm(e.target.value)}
          onFocus={() => {
            if (!isOffline) setShowHistory(true);
          }}
          disabled={isOffline || !selectedDatabase}
        />
        {localSearchTerm && !isOffline && (
          <button className="clear-search" onClick={() => {
            setLocalSearchTerm('');
            onSearch('');
            inputRef.current?.focus();
          }}>×</button>
        )}
        {showHistory && searchHistory.length > 0 && (
          <div className="search-history-dropdown">
            <div className="search-history-header">
              <span>Recent Searches</span>
              <button className="clear-history-btn" onClick={() => {
                setSearchHistory([]);
                localStorage.removeItem('searchHistory');
              }}>Clear All</button>
            </div>
            {searchHistory
              .filter(h => !localSearchTerm || h.toLowerCase().includes(localSearchTerm.toLowerCase()))
              .map((term, i) => (
                <div
                  key={i}
                  className="search-history-item"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setLocalSearchTerm(term);
                    onSearch(term);
                    setShowHistory(false);
                  }}
                >
                  <span className="history-icon">🕐</span>
                  <span className="history-term">{term}</span>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Object Type Dropdown */}
      <div className="filter-dropdown">
        <label>Object Type:</label>
        <select
          value={currentFilter}
          onChange={handleObjectTypeChange}
          disabled={!selectedDatabase || isOffline}
        >
          {OBJECT_TYPE_OPTIONS.map((option) => {
            let count = 0;
            let shortName = 'O';
            if (option.value === 'all') { count = objectCounts?.all || 0; shortName = '*'; }
            if (option.value === 'tables') { count = objectCounts?.tables || 0; shortName = 'U'; }
            if (option.value === 'views') { count = objectCounts?.views || 0; shortName = 'V'; }
            if (option.value === 'procedures') { count = objectCounts?.procedures || 0; shortName = 'P'; }
            if (option.value === 'scalar_functions') { count = objectCounts?.scalar_functions || 0; shortName = 'FN'; }
            if (option.value === 'table_valued_functions') { count = objectCounts?.table_valued_functions || 0; shortName = 'TF'; }
            if (option.value === 'triggers') { count = objectCounts?.triggers || 0; shortName = 'TR'; }
            if (option.value === 'synonyms') { count = objectCounts?.synonyms || 0; shortName = 'SN'; }
            
            return (
              <option key={option.value} value={option.value}>
                {option.label} [{shortName}] =&gt; ({count})
              </option>
            );
          })}
        </select>
      </div>

      {/* Objects List with Infinite Scroll */}
      <div className="objects-list" ref={listRef}>
        {objects.length === 0 && !isLoading ? (
          <div className="empty-state">
            {selectedDatabase ? 'No objects found' : 'Select a database to view objects'}
          </div>
        ) : (
          <>
            {objects.map((obj) => (
              <div
                key={`${obj.objectType}-${obj.objectName}`}
                className={`object-item ${selectedObject?.objectName === obj.objectName ? 'selected' : ''}`}
                onClick={() => onSelectObject(obj, 'highlight')}
                onContextMenu={(e) => handleContextMenu(e, obj)}
              >
              <span className="object-type-tab" title={obj.objectType}>{getShortType(obj.objectType)}</span>
          <span className="object-full-name">{obj.schemaName ? `${obj.schemaName}.${obj.objectName}` : obj.objectName}</span>
              </div>
            ))}
            
            {/* Loading indicator / Infinite scroll trigger */}
            <div ref={loadingRef} className="loading-trigger">
              {isLoading && (
                <div className="loading-spinner">
                  <span className="spinner"></span>
                  Loading more objects...
                </div>
              )}
              {!hasMore && objects.length > 0 && (
                <div className="end-message">
                  No more objects to load ({totalObjects} total)
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <div className="context-menu-item" onClick={() => handleMenuAction('create')}>
            📄 Create Script
          </div>
          <div className="context-menu-item" onClick={() => handleMenuAction('alter')}>
            ✏️ Alter Script
          </div>
          <div className="context-menu-item" onClick={() => handleMenuAction('drop')}>
            🗑️ Drop Script
          </div>
          <div className="context-menu-divider"></div>
          <div className="context-menu-item" onClick={() => handleMenuAction('rename')}>
            📝 Rename
          </div>
        </div>
      )}
    </div>
  );
}