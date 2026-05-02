import { useRef, useEffect, useState } from 'react';
import { askAI } from '../api';

interface QueryEditorProps {
  onExecute: (query: string) => Promise<void>;
  onCancel: () => void;
  isExecuting: boolean;
  script: string | null;
  isOffline?: boolean;
  highlightTerm?: string;
  query: string;
  onQueryChange: (q: string) => void;
  onShowAIResult?: (message: string) => void;
  isAIModalOpen: boolean;
  onToggleAI: (open: boolean) => void;
}

export function QueryEditor({ 
  onExecute, 
  onCancel, 
  isExecuting, 
  script, 
  isOffline = false, 
  highlightTerm,
  query,
  onQueryChange,
  onShowAIResult,
  isAIModalOpen,
  onToggleAI
}: QueryEditorProps) {
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAILoading, setIsAILoading] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoAction = useRef(false);

  const vibrate = (ms: number = 10) => {
    if (navigator.vibrate) navigator.vibrate(ms);
  };

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (script !== null) {
      onQueryChange(script);
    }
  }, [script, onQueryChange]);

  // Handle History for Undo
  useEffect(() => {
    if (isUndoAction.current) {
      isUndoAction.current = false;
      return;
    }
    
    // Push to history if query is different from current index
    if (query !== history[historyIndex]) {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(query);
      if (newHistory.length > 50) newHistory.shift();
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
  }, [query]);

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      isUndoAction.current = true;
      setHistoryIndex(historyIndex - 1);
      onQueryChange(prev);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      isUndoAction.current = true;
      setHistoryIndex(historyIndex + 1);
      onQueryChange(next);
    }
  };

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
      vibrate(20);
      onExecute(query);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const key = e.key.toLowerCase();

    // Alt + X: Execute
    if (key === 'x' && e.altKey) {
      e.preventDefault();
      handleExecute();
    }
    
    // Alt + A: Ask AI
    if (key === 'a' && e.altKey) {
      e.preventDefault();
      onToggleAI(true);
    }

    // Alt + C: Copy All
    if (key === 'c' && e.altKey) {
      e.preventDefault();
      navigator.clipboard.writeText(query);
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const start = (e.currentTarget as HTMLTextAreaElement).selectionStart;
      const end = (e.currentTarget as HTMLTextAreaElement).selectionEnd;
      const newValue = query.substring(0, start) + '    ' + query.substring(end);
      onQueryChange(newValue);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 4;
        }
      }, 0);
    }
  };

  const handleAIAsk = async () => {
    if (!aiPrompt.trim()) return;
    
    // Validation for word count (Groq free limit approx 6000 words)
    const combinedWords = (query + ' ' + aiPrompt).trim().split(/\s+/).length;
    if (combinedWords > 6000) {
      alert(`The combined length of your query and prompt is too large (${combinedWords} words). Please shorten it to stay under 6000 words.`);
      return;
    }
    
    setIsAILoading(true);
    try {
      const result = await askAI(query, aiPrompt);
      if (onShowAIResult) {
        onShowAIResult(result.message);
      }
      onToggleAI(false);
      setAiPrompt('');
    } catch (error: any) {
      vibrate([50, 50, 50]);
      alert(error.message || 'AI request failed');
    } finally {
      setIsAILoading(false);
    }
  };

  const getLineNumbers = () => {
    const lines = query.split('\n');
    return Array.from({ length: Math.max(lines.length, 1) }, (_, i) => i + 1);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#1e1e1e] overflow-hidden">
      {/* Toolbar - SSMS Style */}
      <div className="flex items-center justify-between bg-[#f5f5f5] dark:bg-[#2d2d2d] border-b border-gray-300 dark:border-[#3c3c3c] shadow-sm">
        {/* Action Toolbar */}
        <div className="flex-1 overflow-x-auto no-scrollbar py-1">
          <div className="flex items-center gap-1 md:gap-2 px-2 min-w-max">
            {/* Execute / Stop Toggle - Fixed Width to prevent shift */}
            <div className="min-w-[40px] sm:min-w-[90px]">
              {isExecuting ? (
                <button
                  className="w-full flex items-center justify-center gap-1 md:gap-2 px-2 md:px-3 py-1 bg-red-600 text-white rounded text-[10px] md:text-xs font-bold border border-red-700 transition-all shadow-sm animate-pulse"
                  onClick={() => { vibrate(15); onCancel(); }}
                  title="Stop Execution"
                >
                  <span className="text-xs md:text-[14px]">⏹</span>
                  <span className="hidden sm:inline">Stop</span>
                </button>
              ) : (
                <button
                  className={`w-full flex items-center justify-center gap-1 md:gap-2 px-2 md:px-3 py-1 rounded transition-all text-[10px] md:text-xs font-bold shadow-sm ${!query.trim() || isOffline ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-[#eef6ff] text-[#0078d4] hover:bg-[#0078d4] hover:text-white border border-[#0078d4]/20'}`}
                  onClick={handleExecute}
                  disabled={!query.trim() || isOffline}
                  title="Execute (Alt+X)"
                >
                  <span className="text-xs md:text-[14px]">▶</span>
                  <span className="hidden sm:inline">Execute</span>
                </button>
              )}
            </div>

            <div className="h-4 md:h-6 w-px bg-gray-300 dark:bg-gray-700 mx-1"></div>

            {/* Undo Button */}
            <button
              onClick={() => { vibrate(5); handleUndo(); }}
              disabled={historyIndex <= 0}
              className={`flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 rounded text-[10px] md:text-xs font-bold border shadow-sm transition-all ${historyIndex <= 0 ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600'}`}
              title="Undo (Ctrl+Z)"
            >
              <span className="text-xs md:text-sm">↩️</span>
              <span className="hidden sm:inline">Undo</span>
            </button>

            {/* Redo Button */}
            <button
              onClick={() => { vibrate(5); handleRedo(); }}
              disabled={historyIndex >= history.length - 1}
              className={`flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 rounded text-[10px] md:text-xs font-bold border shadow-sm transition-all ${historyIndex >= history.length - 1 ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600'}`}
              title="Redo (Ctrl+Y)"
            >
              <span className="text-xs md:text-sm">↪️</span>
              <span className="hidden sm:inline">Redo</span>
            </button>

            {/* Paste Button */}
            <button
              onClick={async () => {
                vibrate(10);
                try {
                  const text = await navigator.clipboard.readText();
                  if (text) onQueryChange(query + (query ? '\n' : '') + text);
                } catch (err) {
                  alert('Click into the editor and use Ctrl+V to paste. Browser security prevented automatic pasting.');
                }
              }}
              className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-[#0078d4] border border-gray-300 dark:border-gray-600 rounded text-[10px] md:text-xs font-bold shadow-sm transition-all"
              title="Paste from Clipboard"
            >
              <span className="text-xs md:text-sm">📋</span>
              <span className="hidden sm:inline">Paste</span>
            </button>

            {/* Dedicated Copy Button */}
            <button
              onClick={() => { vibrate(10); navigator.clipboard.writeText(query); }}
              className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-[#0078d4] border border-gray-300 dark:border-gray-600 rounded text-[10px] md:text-xs font-bold shadow-sm transition-all"
              title="Copy to Clipboard"
            >
              <span className="text-xs md:text-sm">📑</span>
              <span className="hidden sm:inline">Copy</span>
            </button>

            {/* Clear All Button */}
            <button
              onClick={() => { vibrate(30); onQueryChange(''); }}
              className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 bg-white dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 border border-red-200 dark:border-red-900/50 rounded text-[10px] md:text-xs font-bold shadow-sm transition-all"
              title="Clear All"
            >
              <span className="text-sm">🗑️</span>
              <span className="hidden sm:inline">Clear</span>
            </button>

            <div className="h-4 md:h-6 w-px bg-gray-300 dark:bg-gray-700 mx-1"></div>

            {/* Groq AI Button */}
            <button
              onClick={() => { vibrate(15); onToggleAI(true); }}
              className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 bg-[#f0f9ff] dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-[#0078d4] border border-blue-200 dark:border-blue-800 rounded text-[10px] md:text-xs font-bold shadow-sm transition-all"
              title="Ask AI (Alt+A)"
            >
              <span className="text-xs md:text-sm">🤖</span>
              <span className="hidden sm:inline">Ask AI</span>
            </button>
          </div>
        </div>
        
        <div className="text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2 whitespace-nowrap min-w-[70px] text-right">
          {isExecuting && <span className="text-blue-500 animate-pulse">Executing...</span>}
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
            onChange={(e) => { vibrate(2); onQueryChange(e.target.value); }}
            onScroll={syncScroll}
            onKeyDown={handleKeyDown}
            placeholder={isOffline ? "-- Database is offline" : "-- Write your SQL query here\nSELECT * FROM TableName"}
            spellCheck={false}
            disabled={isOffline}
          />
        </div>
      </div>

      {/* AI Modal Overlay */}
      {isAIModalOpen && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
          <div className="bg-white dark:bg-[#252526] w-full max-w-md p-5 border border-gray-300 dark:border-gray-700 shadow-2xl rounded-sm">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">🤖</span>
              <div>
                <h3 className="text-sm font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">Ask Groq AI</h3>
                <p className="text-[10px] text-gray-500 font-bold uppercase">Llama 3.3 • SQL Server Expert</p>
              </div>
            </div>
            
            <textarea
              className="w-full h-24 p-3 bg-gray-50 dark:bg-[#1e1e1e] border border-gray-300 dark:border-gray-700 text-sm outline-none focus:border-[#0078d4] resize-none mb-4 dark:text-gray-200"
              placeholder="What do you want to do with this query? (e.g., 'Explain this', 'Optimize it', 'Convert to JOIN')"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Tab') {
                  e.preventDefault();
                  const start = e.currentTarget.selectionStart;
                  const end = e.currentTarget.selectionEnd;
                  const newValue = aiPrompt.substring(0, start) + '    ' + aiPrompt.substring(end);
                  setAiPrompt(newValue);
                  setTimeout(() => {
                    (e.target as HTMLTextAreaElement).selectionStart = (e.target as HTMLTextAreaElement).selectionEnd = start + 4;
                  }, 0);
                }
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAIAsk();
                }
              }}
              autoFocus
            />
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { onToggleAI(false); setAiPrompt(''); }}
                className="px-4 py-1.5 text-xs font-bold text-gray-500 hover:text-gray-700 uppercase"
                disabled={isAILoading}
              >
                Cancel
              </button>
              <button
                onClick={handleAIAsk}
                disabled={isAILoading || !aiPrompt.trim()}
                className={`px-6 py-1.5 text-xs font-black rounded uppercase tracking-tighter shadow-md ${isAILoading || !aiPrompt.trim() ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-[#0078d4] text-white hover:bg-[#005a9e]'}`}
              >
                {isAILoading ? 'Thinking...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}