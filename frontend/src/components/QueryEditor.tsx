import { useRef, useEffect } from 'react';

interface QueryEditorProps {
  onExecute: (query: string) => Promise<void>;
  onCancel: () => void;
  isExecuting: boolean;
  script: string | null;
  isOffline?: boolean;
  highlightTerm?: string;
  query: string;
  onQueryChange: (q: string) => void;
}

export function QueryEditor({ 
  onExecute, 
  onCancel, 
  isExecuting, 
  script, 
  isOffline = false, 
  highlightTerm,
  query,
  onQueryChange
}: QueryEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (script !== null) {
      onQueryChange(script);
    }
  }, [script, onQueryChange]);

  const syncScroll = () => {
    if (textareaRef.current) {
      const top = textareaRef.current.scrollTop;
      const left = textareaRef.current.scrollLeft;
      
      if (lineNumbersRef.current) {
        lineNumbersRef.current.scrollTop = top;
      }
      if (highlightRef.current) {
        highlightRef.current.scrollTop = top;
        highlightRef.current.scrollLeft = left;
      }
    }
  };

  const handleExecute = () => {
    if (query.trim() && !isExecuting) {
      onExecute(query);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'x' && e.altKey) {
      e.preventDefault();
      handleExecute();
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const newValue = query.substring(0, start) + '    ' + query.substring(end);
      onQueryChange(newValue);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 4;
        }
      }, 0);
    }
  };

  const getLineNumbers = () => {
    const lines = query.split('\n');
    return Array.from({ length: Math.max(lines.length, 1) }, (_, i) => i + 1);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#1e1e1e] overflow-hidden">
      {/* Toolbar - SSMS Style */}
      <div className="flex items-center justify-between px-2 py-1.5 bg-[#f5f5f5] dark:bg-[#2d2d2d] border-b border-gray-300 dark:border-[#3c3c3c] shadow-sm">
        <div className="flex items-center gap-1">
          <button
            className={`flex items-center gap-2 px-3 py-1 rounded transition-all text-xs font-bold shadow-sm ${isExecuting || !query.trim() || isOffline ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-[#eef6ff] text-[#0078d4] hover:bg-[#0078d4] hover:text-white border border-[#0078d4]/20'}`}
            onClick={handleExecute}
            disabled={isExecuting || !query.trim() || isOffline}
            title="Execute (Alt+X)"
          >
            <span className="text-[14px]">▶</span>
            <span>Execute</span>
          </button>
          
          {isExecuting && (
            <button
              className="flex items-center gap-2 px-3 py-1 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded text-xs font-bold border border-red-200 transition-all shadow-sm"
              onClick={onCancel}
              title="Cancel Execution"
            >
              <span className="text-[14px]">⏹</span>
              <span>Stop</span>
            </button>
          )}

          <div className="h-6 w-px bg-gray-300 dark:bg-gray-700 mx-2"></div>

          {/* Universal Share Button */}
          <button
            onClick={async () => {
              try {
                // Ensure text is copied even when sharing
                await navigator.clipboard.writeText(query);
                
                if (navigator.share) {
                  await navigator.share({
                    title: 'SQL Query from SSMS Tool',
                    text: query,
                  });
                } else {
                  alert('Query copied to clipboard!');
                }
              } catch (err) {
                console.error('Action failed:', err);
                // Fallback alert for non-secure contexts where clipboard might fail
                alert('Query copied to clipboard!');
              }
            }}
            className="flex items-center gap-2 px-3 py-1 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-[#0078d4] border border-gray-300 dark:border-gray-600 rounded text-xs font-bold shadow-sm transition-all"
            title="Share Query"
          >
            <span className="text-sm">📤</span>
            <span>Share</span>
          </button>
        </div>
        
        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2">
          {isExecuting && 'Executing Query...'}
        </div>
      </div>
      
      {/* Editor Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Line Numbers Gutter */}
        <div 
          ref={lineNumbersRef}
          className="w-10 bg-[#f0f0f0] dark:bg-[#1e1e1e] text-gray-400 dark:text-gray-600 text-right py-4 pr-2 text-[11px] font-mono select-none border-r border-gray-200 dark:border-gray-800 leading-6 overflow-hidden pointer-events-none"
        >
          {getLineNumbers().map((num) => (
            <div key={num}>{num}</div>
          ))}
        </div>
        
        <div className="flex-1 relative bg-white dark:bg-[#1e1e1e] overflow-hidden">
          {/* Highlight Overlay */}
          <div 
            ref={highlightRef}
            className="absolute inset-0 p-4 font-mono text-sm leading-6 whitespace-pre break-words text-transparent pointer-events-none z-0 overflow-hidden"
          >
            {query.split(new RegExp(`(${highlightTerm})`, 'gi')).map((part, i) => (
              part.toLowerCase() === (highlightTerm || '').toLowerCase() 
                ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-900/50 border-b-2 border-yellow-500 text-transparent">{part}</mark>
                : part
            ))}
          </div>

          {/* Actual Textarea */}
          <textarea
            ref={textareaRef}
            className="absolute inset-0 w-full h-full p-4 bg-transparent dark:text-gray-300 font-mono text-sm leading-6 outline-none resize-none z-10 overflow-auto"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onScroll={syncScroll}
            onKeyDown={handleKeyDown}
            placeholder={isOffline ? "-- Database is offline" : "-- Write your SQL query here\nSELECT * FROM TableName"}
            spellCheck={false}
            disabled={isOffline}
          />
        </div>
      </div>
    </div>
  );
}