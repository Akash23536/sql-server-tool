import { useState, useEffect, useRef } from 'react';
import './QueryEditor.css';

interface QueryEditorProps {
  onExecute: (query: string) => void;
  isExecuting: boolean;
  script: string | null;
  isOffline?: boolean;
}

export function QueryEditor({ onExecute, isExecuting, script, isOffline = false }: QueryEditorProps) {
  const [query, setQuery] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Update query when script changes (from context menu actions)
  useEffect(() => {
    if (script) {
      setQuery(script);
    }
  }, [script]);

  const handleExecute = () => {
    if (query.trim()) {
      onExecute(query);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'x' && e.altKey) {
      e.preventDefault();
      handleExecute();
    }
  };

  // Get line numbers
  const getLineNumbers = () => {
    const lines = query.split('\n');
    return lines.map((_, i) => i + 1);
  };

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const lineNumbersEl = document.querySelector('.line-numbers') as HTMLElement;
    if (lineNumbersEl) {
      lineNumbersEl.scrollTop = e.currentTarget.scrollTop;
    }
  };

  return (
    <div className="query-editor">
      <div className="editor-header">
        <h3>Query Editor {isOffline && <span style={{color: 'var(--error-color)', marginLeft: '10px', fontSize: '12px'}}>Database Offline</span>}</h3>
        <button 
          className="execute-btn" 
          onClick={handleExecute}
          disabled={isExecuting || !query.trim() || isOffline}
        >
          {isExecuting ? 'Running...' : 'Execute (Alt+X)'}
        </button>
      </div>
      
      <div className="editor-content">
        <div className="editor-wrapper">
          <div className="line-numbers">
            {getLineNumbers().map((num) => (
              <div key={num} className="line-number">{num}</div>
            ))}
          </div>
          <textarea
            ref={textareaRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onScroll={handleScroll}
            placeholder={isOffline ? "-- Database is offline" : "-- Write your SQL query here\nSELECT * FROM TableName"}
            spellCheck={false}
            style={{ caretColor: 'auto' }}
            disabled={isOffline}
          />
        </div>
      </div>
    </div>
  );
}