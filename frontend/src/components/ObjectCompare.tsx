import { useState, useEffect } from 'react';
import ReactDiffViewer from 'react-diff-viewer-continued';
import { getObjectScript } from '../api';
import type { DbObject, Database } from '../api';
import { DatabaseSearchSelector } from './DatabaseSearchSelector';
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
      setTargetExists(null);
      setError(null);
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
            <h2 title={`Compare Object: ${selectedObject?.objectName}`}>Compare Object: <span className="highlight-text">{selectedObject?.objectName}</span></h2>
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
            <div className="compare-arrow">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </div>
            <div className="control-group flex-1 min-w-[300px]">
              <label>Target Database (Searchable)</label>
              <DatabaseSearchSelector
                databases={databases.filter(db => db.name !== selectedDatabase)}
                selectedDatabase={targetDatabase}
                onSelectDatabase={setTargetDatabase}
                placeholder="Type to search database..."
                className="compare-db-selector"
              />
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
              {targetExists !== false && sourceScript && targetScript && sourceScript.replace(/\r\n/g, '\n').trim() === targetScript.replace(/\r\n/g, '\n').trim() ? (
                <div className="empty-diff-placeholder" style={{ color: '#10b981', fontStyle: 'normal' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <svg style={{ width: '48px', height: '48px', marginBottom: '8px' }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <strong style={{ fontSize: '1.2rem' }}>Objects are Identical</strong>
                    <span style={{ fontSize: '0.9rem', color: '#059669', opacity: 0.8 }}>No differences found between the source and target database.</span>
                  </div>
                </div>
              ) : targetExists !== false && (
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
