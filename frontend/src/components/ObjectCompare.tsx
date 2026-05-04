import { useState, useEffect } from 'react';
import ReactDiffViewer from 'react-diff-viewer-continued';
import { getObjectScript } from '../api';
import type { DbObject, Database } from '../api';
import './ObjectCompare.css';

interface ObjectCompareProps {
  isOpen: boolean;
  onClose: () => void;
  databases: Database[];
  selectedDatabase: string;
  selectedObject: DbObject | null;
}

export function ObjectCompare({
  isOpen,
  onClose,
  databases,
  selectedDatabase,
  selectedObject,
}: ObjectCompareProps) {
  const [targetDatabase, setTargetDatabase] = useState('');
  const [sourceScript, setSourceScript] = useState('');
  const [targetScript, setTargetScript] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targetExists, setTargetExists] = useState<boolean | null>(null);

  useEffect(() => {
    if (isOpen && selectedObject && selectedDatabase) {
      fetchSourceScript();
    } else if (!isOpen) {
        setTargetDatabase('');
        setSourceScript('');
        setTargetScript('');
        setError(null);
        setTargetExists(null);
    }
  }, [isOpen, selectedObject, selectedDatabase]);

  useEffect(() => {
    if (isOpen && selectedObject && targetDatabase) {
      fetchTargetScript();
    } else {
        setTargetScript('');
        setTargetExists(null);
    }
  }, [isOpen, selectedObject, targetDatabase]);

  const fetchSourceScript = async () => {
    if (!selectedObject) return;
    try {
      setIsLoading(true);
      setError(null);
      const script = await getObjectScript(
        selectedDatabase,
        selectedObject.objectName,
        selectedObject.objectType,
        'create',
        selectedObject.schemaName
      );
      setSourceScript(script);
    } catch (err: any) {
      setError(err.message || 'Failed to load source script');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTargetScript = async () => {
    if (!selectedObject || !targetDatabase) return;
    try {
      setIsLoading(true);
      setError(null);
      setTargetExists(null);
      const script = await getObjectScript(
        targetDatabase,
        selectedObject.objectName,
        selectedObject.objectType,
        'create',
        selectedObject.schemaName
      );
      setTargetScript(script);
      setTargetExists(true);
    } catch (err: any) {
      setTargetScript('');
      setTargetExists(false);
      setError(`Object "${selectedObject.objectName}" does not exist in database "${targetDatabase}"`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content compare-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="header-title-row">
            <span className="compare-icon">↔️</span>
            <h2>Compare Object: <span className="highlight-text">{selectedObject?.objectName}</span></h2>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="compare-controls">
            <div className="control-group">
              <label>Source Database</label>
              <div className="db-badge source">
                <span className={`status-indicator ${databases.find(d => d.name === selectedDatabase)?.status === 'OFFLINE' ? 'offline' : 'online'}`}></span>
                {selectedDatabase}
              </div>
            </div>
            <div className="compare-arrow">➡️</div>
            <div className="control-group">
              <label>Target Database</label>
              <select 
                className="db-select"
                value={targetDatabase} 
                onChange={(e) => setTargetDatabase(e.target.value)}
              >
                <option value="">Select Database to Compare</option>
                {databases.filter(db => db.name !== selectedDatabase).map(db => (
                  <option key={db.name} value={db.name}>
                    {db.status === 'OFFLINE' ? '🔴 ' : '🟢 '}{db.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {targetExists === false && (
            <div className="missing-object-alert">
              <span className="alert-icon">⚠️</span>
              <div className="alert-content">
                <strong>Object Not Found</strong>
                <p>The object <code>{selectedObject?.objectName}</code> does not exist in <code>{targetDatabase}</code>.</p>
              </div>
            </div>
          )}

          {error && targetExists !== false && <div className="error-message">{error}</div>}
          
          <div className="diff-container">
            {isLoading && (
              <div className="loading-overlay">
                <div className="spinner"></div>
                <span>Fetching scripts...</span>
              </div>
            )}
            <div className="diff-scroll-wrapper">
              {targetExists !== false && (
                <ReactDiffViewer
                  oldValue={sourceScript}
                  newValue={targetScript}
                  splitView={true}
                  leftTitle={`SOURCE: ${selectedDatabase}`}
                  rightTitle={targetDatabase ? `TARGET: ${targetDatabase}` : 'TARGET: SELECT DATABASE'}
                  useDarkTheme={isDark}
                  styles={{
                    variables: {
                      dark: {
                        diffViewerBackground: '#1e1e1e',
                        diffViewerTitleBackground: '#252526',
                        diffViewerTitleColor: '#ccc',
                        addedBackground: '#063706',
                        addedColor: '#cfc',
                        removedBackground: '#3d0a0a',
                        removedColor: '#fcc',
                        wordAddedBackground: '#055d05',
                        wordRemovedBackground: '#632b2b',
                      },
                      light: {
                        diffViewerBackground: '#fff',
                        diffViewerTitleBackground: '#f3f3f3',
                        diffViewerTitleColor: '#555',
                      }
                    }
                  }}
                />
              )}
              {targetExists === false && (
                <div className="empty-diff-placeholder">
                  Comparison unavailable because the object is missing in the target database.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-close" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
