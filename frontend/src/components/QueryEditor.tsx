import { useRef, useEffect, useState } from 'react';
import { askAI, getAIModels } from '../api';

interface QueryEditorProps {
  onExecute: (query: string) => Promise<void>;
  onCancel: () => void;
  isExecuting: boolean;
  isOffline?: boolean;
  highlightTerm?: string;
  query: string;
  onQueryChange: (q: string) => void;
  onShowAIResult?: (message: string) => void;
  isAIModalOpen: boolean;
  onToggleAI: (open: boolean) => void;
  queryError?: string | null;
  fontSize: number;
  setFontSize: (size: number | ((prev: number) => number)) => void;
}

export function QueryEditor({ 
  onExecute, 
  onCancel, 
  isExecuting, 
  isOffline = false, 
  highlightTerm,
  query,
  onQueryChange,
  onShowAIResult,
  isAIModalOpen,
  onToggleAI,
  queryError,
  fontSize,
  setFontSize
}: QueryEditorProps) {
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiModel, setAiModel] = useState('llama-3.3-70b-versatile');
  const [isAILoading, setIsAILoading] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [availableModels, setAvailableModels] = useState<{id: string, name: string}[]>([]);
  const isUndoAction = useRef(false);

  useEffect(() => {
    if (isAIModalOpen && availableModels.length === 0) {
      getAIModels().then(models => {
        if (models && models.length > 0) {
          setAvailableModels(models);
          // Auto-select a valid model if current is discontinued
          if (!models.find(m => m.id === aiModel)) {
            const defaultModel = models.find(m => m.id.includes('llama-3.3')) || models[0];
            setAiModel(defaultModel.id);
          }
        }
      }).catch(err => console.error("Failed to load models", err));
    }
  }, [isAIModalOpen]);

  const vibrate = (pattern: number | number[] = 10) => {
    if (navigator.vibrate) navigator.vibrate(pattern as any);
  };

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);



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

    // Alt + Plus: Zoom In
    if ((e.key === '+' || e.key === '=') && e.altKey) {
      e.preventDefault();
      handleZoomIn();
    }

    // Alt + Minus: Zoom Out
    if (e.key === '-' && e.altKey) {
      e.preventDefault();
      handleZoomOut();
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
      const result = await askAI(query, aiPrompt, queryError || undefined, aiModel);
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

  const handleZoomIn = () => {
    vibrate(5);
    setFontSize((prev: number) => Math.min(prev + 2, 32));
  };

  const handleZoomOut = () => {
    vibrate(5);
    setFontSize((prev: number) => Math.max(prev - 2, 8));
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

            {/* Clear Editor Button */}
            <button
              onClick={() => { vibrate(30); onQueryChange(''); }}
              className="flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-[#252526] hover:bg-red-500 dark:hover:bg-red-600 text-gray-600 dark:text-gray-300 hover:text-white border border-gray-300 dark:border-[#3c3c3c] hover:border-red-500 dark:hover:border-red-600 rounded text-[11px] font-bold transition-all shadow-sm group"
              title="Clear Editor"
            >
              <svg className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span className="hidden sm:inline tracking-wide">CLEAR</span>
            </button>

          </div>
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Line Numbers Gutter */}
        <div 
          ref={lineNumbersRef}
          className="w-12 bg-[#f0f0f0] dark:bg-[#1e1e1e] text-gray-400 dark:text-gray-600 text-right py-4 pr-3 font-mono select-none border-r border-gray-200 dark:border-gray-800 overflow-hidden pointer-events-none transition-all"
          style={{ fontSize: `${fontSize}px`, lineHeight: `${fontSize * 1.5}px` }}
        >
          {getLineNumbers().map((num) => (
            <div key={num}>{num}</div>
          ))}
        </div>
        
        <div className="flex-1 relative bg-white dark:bg-[#1e1e1e] overflow-hidden">
          {/* Highlight Overlay */}
          <div 
            ref={highlightRef}
            className="absolute inset-0 p-4 font-mono text-transparent pointer-events-none z-0 overflow-hidden transition-all border border-transparent"
            style={{ 
              fontFamily: '"Consolas", "Courier New", monospace',
              fontSize: `${fontSize}px`, 
              lineHeight: `${fontSize * 1.5}px`,
              whiteSpace: 'pre',
              wordWrap: 'normal',
              tabSize: 4,
              letterSpacing: 'normal'
            }}
          >
            {highlightTerm && highlightTerm.trim() !== '' ? (
              query.replace(/\r\n/g, '\n').split(new RegExp(`(${highlightTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')).map((part, i) => (
                part.toLowerCase() === highlightTerm.toLowerCase() 
                  ? <mark key={i} className="bg-red-500/50 dark:bg-red-600/60 text-transparent rounded-sm">{part}</mark>
                  : part
              ))
            ) : (
              query.replace(/\r\n/g, '\n')
            )}
          </div>

          {/* Actual Textarea */}
          <textarea
            ref={textareaRef}
            className="absolute inset-0 w-full h-full p-4 bg-transparent dark:text-gray-300 font-mono outline-none border-none resize-none z-10 overflow-auto transition-all"
            style={{ 
              fontFamily: '"Consolas", "Courier New", monospace',
              fontSize: `${fontSize}px`, 
              lineHeight: `${fontSize * 1.5}px`,
              whiteSpace: 'pre',
              wordWrap: 'normal',
              tabSize: 4,
              letterSpacing: 'normal'
            }}
            value={query}
            onChange={(e) => { vibrate(2); onQueryChange(e.target.value); }}
            onScroll={syncScroll}
            onKeyDown={handleKeyDown}
            placeholder={isOffline ? "-- Database is offline" : "-- Write your SQL query here\nSELECT * FROM TableName"}
            spellCheck={false}
            wrap="off"
            disabled={isOffline}
          />
        </div>
      </div>

      {/* AI Modal Overlay */}
      {isAIModalOpen && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
          <div className="bg-white dark:bg-[#252526] w-full max-w-md p-5 border border-gray-300 dark:border-gray-700 shadow-2xl rounded-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🤖</span>
                <div>
                  <h3 className="text-sm font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">Ask Groq AI</h3>
                  <p className="text-[10px] text-gray-500 font-bold uppercase">SQL Server Expert</p>
                </div>
              </div>
              <select
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                className="bg-gray-50 dark:bg-[#1e1e1e] border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-xs rounded px-2 py-1 outline-none max-w-[160px] truncate"
              >
                {availableModels.length > 0 ? (
                  availableModels.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))
                ) : (
                  <option value={aiModel}>{aiModel} (Loading...)</option>
                )}
              </select>
            </div>
            
            {queryError && (
              <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded text-xs text-red-600 dark:text-red-400 font-mono">
                <span className="font-bold">ErrorContext:</span> {queryError.substring(0, 150)}{queryError.length > 150 ? '...' : ''}
              </div>
            )}

            <div className="relative mb-4 flex border border-gray-300 dark:border-gray-700 rounded-md overflow-hidden bg-gray-50 dark:bg-[#1e1e1e] focus-within:border-[#0078d4] focus-within:ring-1 focus-within:ring-[#0078d4]">
              {/* Line numbers gutter */}
              <div className="w-8 py-3 bg-gray-200/50 dark:bg-[#2d2d2d] text-gray-400 dark:text-gray-500 text-right pr-2 text-[11px] font-mono select-none flex-shrink-0 border-r border-gray-300 dark:border-gray-700 overflow-hidden">
                {aiPrompt.split('\n').map((_, i) => (
                  <div key={i} className="leading-[1.4]">{i + 1}</div>
                ))}
              </div>
              <textarea
                className="flex-1 w-full p-3 bg-transparent text-sm font-mono outline-none resize-y min-h-[96px] dark:text-gray-200 leading-[1.4]"
                placeholder="What do you want to do with this query?&#10;(e.g., 'Explain this', 'Optimize it')"
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
            </div>
            
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