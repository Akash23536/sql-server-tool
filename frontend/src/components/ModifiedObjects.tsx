import { useState, useEffect, useRef, type MouseEvent } from 'react';
import { getModifiedObjects } from '../api';
import type { DbObject } from '../api';
import { ObjectContextMenu } from './ObjectContextMenu';
import './ModifiedObjects.css';

interface ModifiedObjectsProps {
  database: string;
  isOpen: boolean;
  onClose: () => void;
  onAction: (obj: DbObject, action: string) => void;
}

export function ModifiedObjects({ database, isOpen, onClose, onAction }: ModifiedObjectsProps) {
  const [objects, setObjects] = useState<DbObject[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; obj: DbObject } | null>(null);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSearchTerm, setActiveSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen && database) {
      setObjects([]);
      setPage(1);
      setHasMore(false);
      setTotalCount(0);
      setSearchTerm('');
      setActiveSearchTerm('');
      loadModifiedObjects(1, '');
    }
  }, [isOpen, database]);

  useEffect(() => {
    if (!isOpen || !loadMoreRef.current) return;

    const root = loadMoreRef.current.closest('.modal-body');
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore && !isLoading) {
          loadModifiedObjects(page + 1, activeSearchTerm);
        }
      },
      { root: root instanceof HTMLElement ? root : null, threshold: 0.1 }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, isLoading, page, isOpen, activeSearchTerm]);

  const executeSearch = () => {
    setActiveSearchTerm(searchTerm);
    setObjects([]);
    setPage(1);
    setHasMore(false);
    setTotalCount(0);
    loadModifiedObjects(1, searchTerm);
  };

  const loadModifiedObjects = async (pageNumber: number, search: string = activeSearchTerm) => {
    try {
      if (pageNumber === 1) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }
      setError(null);

      const result = await getModifiedObjects(database, pageNumber, 10, search);
      setObjects((prev) => (pageNumber === 1 ? result.objects : [...prev, ...result.objects]));
      setPage(result.page);
      setHasMore(result.hasMore);
      setTotalCount(result.totalCount);
    } catch (err: any) {
      setError(err.message || 'Failed to load modified objects');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const handleContextMenu = (e: MouseEvent<HTMLTableRowElement>, obj: DbObject) => {
    e.preventDefault();
    setSelectedRow(obj.objectId || null);
    setContextMenu({ x: e.clientX, y: e.clientY, obj });
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Recently Modified Objects</h2>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                setObjects([]);
                setPage(1);
                setHasMore(false);
                setTotalCount(0);
                loadModifiedObjects(1, activeSearchTerm);
              }}
              disabled={isLoading || isLoadingMore}
              className="p-2 text-gray-500 hover:text-[#0078d4] hover:bg-[#0078d4]/10 rounded-lg transition-all"
              title="Refresh Activity Log"
            >
              <svg className={`w-5 h-5 ${(isLoading || isLoadingMore) ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
        </div>

        <div className="modal-body">
          <div className="p-2 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              type="text"
              placeholder="Search modified objects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  executeSearch();
                }
              }}
              className="flex-1 px-3 py-1.5 text-[11px] bg-white dark:bg-[#1e1e1e] border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:border-[#0078d4] dark:text-gray-200"
            />
            <button
              onClick={executeSearch}
              disabled={isLoading || isLoadingMore}
              className="px-3 py-1.5 bg-[#0078d4] hover:bg-[#005a9e] disabled:opacity-50 text-white text-[11px] font-bold rounded shadow-sm transition-colors whitespace-nowrap"
            >
              Search
            </button>
            {(activeSearchTerm || searchTerm) && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setActiveSearchTerm('');
                  setObjects([]);
                  setPage(1);
                  setHasMore(false);
                  setTotalCount(0);
                  loadModifiedObjects(1, '');
                }}
                className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-[11px] font-bold rounded shadow-sm transition-colors whitespace-nowrap"
              >
                Clear
              </button>
            )}
          </div>
          {isLoading && <div className="loading">Loading...</div>}
          {error && <div className="error-message">{error}</div>}

          {!isLoading && !error && objects.length === 0 && (
            <div className="no-data">No modified objects found</div>
          )}

          {!isLoading && !error && objects.length > 0 && (
            <>
              <div className="table-wrapper">
                <table className="modified-objects-table">
                  <thead>
                    <tr>
                      <th>Object ID</th>
                      <th>Object Type</th>
                      <th>Object Name</th>
                      <th>Created Date</th>
                      <th>Modified Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {objects.map((obj, index) => (
                      <tr
                        key={`${obj.objectId}-${obj.objectName}-${index}`}
                        className={selectedRow === obj.objectId ? 'selected-row' : ''}
                        onClick={() => setSelectedRow(obj.objectId || null)}
                        onContextMenu={(e) => handleContextMenu(e, obj)}
                        onDoubleClick={(e) => handleContextMenu(e, obj)}
                      >
                        <td className="object-id">{obj.objectId}</td>
                        <td className="object-type">{obj.objectType}</td>
                        <td className="object-name">{obj.objectName}</td>
                        <td className="date">{formatDate(obj.createDate)}</td>
                        <td className="date modified-highlight">{formatDate(obj.modifyDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div ref={loadMoreRef} className="load-more-trigger">
                {isLoadingMore ? 'Loading more...' : hasMore ? 'Scroll to load more' : `Loaded ${objects.length} / ${totalCount}`}
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-close" onClick={onClose}>Close</button>
        </div>
      </div>

      {contextMenu && (
        <ObjectContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          obj={contextMenu.obj}
          onAction={onAction}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
