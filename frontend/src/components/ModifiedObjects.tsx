import { useState, useEffect, useRef, type MouseEvent } from 'react';
import { getModifiedObjects } from '../api';
import type { DbObject } from '../api';
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
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen && database) {
      setObjects([]);
      setPage(1);
      setHasMore(false);
      setTotalCount(0);
      loadModifiedObjects(1);
    }
  }, [isOpen, database]);

  useEffect(() => {
    if (!isOpen || !loadMoreRef.current) return;

    const root = loadMoreRef.current.closest('.modal-body');
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore && !isLoading) {
          loadModifiedObjects(page + 1);
        }
      },
      { root: root instanceof HTMLElement ? root : null, threshold: 0.1 }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, isLoading, page, isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: Event) => {
      if (contextMenuRef.current && e.target instanceof Node && !contextMenuRef.current.contains(e.target)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadModifiedObjects = async (pageNumber: number) => {
    try {
      if (pageNumber === 1) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }
      setError(null);

      const result = await getModifiedObjects(database, pageNumber, 10);
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

  const handleMenuAction = (action: string) => {
    if (!contextMenu) return;
    onAction(contextMenu.obj, action);
    setContextMenu(null);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Recently Modified Objects</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
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
              {contextMenu && (
                <div
                  ref={contextMenuRef}
                  className="modified-context-menu"
                  style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                  {(contextMenu.obj.objectType === 'U' || contextMenu.obj.objectType === 'V') && (
                    <>
                      <div className="menu-item" onClick={() => handleMenuAction('select_top_50')}>🔍 Select Top 50</div>
                      <div className="menu-divider" />
                    </>
                  )}
                  <div className="menu-item" onClick={() => handleMenuAction('create')}>📄 Create Script</div>
                  <div className="menu-item" onClick={() => handleMenuAction('alter')}>✏️ Alter Script</div>
                  <div className="menu-item" onClick={() => handleMenuAction('drop')}>🗑️ Drop Script</div>
                  <div className="menu-divider" />
                  <div className="menu-item" onClick={() => handleMenuAction('rename')}>📝 Rename</div>
                </div>
              )}

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
    </div>
  );
}
