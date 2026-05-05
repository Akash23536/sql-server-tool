import { useState, useRef, useEffect, useMemo } from 'react';
import type { Database } from '../api';

interface DatabaseSearchSelectorProps {
  databases: Database[];
  selectedDatabase: string;
  onSelectDatabase: (db: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function DatabaseSearchSelector({
  databases,
  selectedDatabase,
  onSelectDatabase,
  disabled = false,
  placeholder = "Select Database…",
  className = ""
}: DatabaseSearchSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync search term with selected database when dropdown is closed
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm(selectedDatabase);
    }
  }, [selectedDatabase, isOpen]);

  const filteredDatabases = useMemo(() => {
    if (!searchTerm || searchTerm === selectedDatabase) return databases;
    const term = searchTerm.toLowerCase();
    return databases.filter(db => db.name.toLowerCase().includes(term));
  }, [databases, searchTerm, selectedDatabase]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputClick = () => {
    if (!disabled) {
      setIsOpen(true);
      // Auto-select text so user can immediately type to overwrite or see current selection
      setTimeout(() => inputRef.current?.select(), 0);
    }
  };

  const handleSelect = (dbName: string) => {
    onSelectDatabase(dbName);
    setSearchTerm(dbName);
    setIsOpen(false);
  };

  const selectedDbObj = databases.find(db => db.name === selectedDatabase);

  return (
    <div className={`relative flex-1 ${className}`} ref={containerRef}>
      <div className="relative flex items-center">
        {/* Left Side Status/Icon */}
        <div className="absolute left-2 z-10 pointer-events-none flex items-center gap-1">
          {selectedDatabase ? (
            <span className="text-[10px]">{selectedDbObj?.status === 'OFFLINE' ? '🔴' : '🟢'}</span>
          ) : (
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7c0 2.21-3.582 4-8 4S4 9.21 4 7m16 0c0-2.21-3.582-4-8-4S4 4.79 4 7m16 0v5c0 2.21-3.582 4-8 4S4 14.21 4 12V7m16 5v5c0 2.21-3.582 4-8 4S4 19.21 4 17v-5" />
            </svg>
          )}
        </div>

        <input
          ref={inputRef}
          type="text"
          className={`w-full pl-7 pr-8 py-1.5 bg-white dark:bg-[#1e1e1e] border border-gray-300 dark:border-gray-600 rounded text-[11px] font-bold focus:outline-none focus:ring-1 focus:ring-blue-500/50 dark:text-white placeholder-gray-400 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          placeholder={placeholder}
          value={isOpen ? searchTerm : (selectedDatabase || '')}
          onChange={(e) => setSearchTerm(e.target.value)}
          onClick={handleInputClick}
          onFocus={handleInputClick}
          disabled={disabled}
        />

        {/* Custom dropdown arrow */}
        <div className="absolute right-2 flex items-center gap-1 pointer-events-none">
          <svg className={`w-3 h-3 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && !disabled && (
        <div className="absolute top-full left-0 right-0 mt-1 z-[100] bg-white dark:bg-[#252526] border border-gray-300 dark:border-gray-700 shadow-xl rounded-md overflow-hidden max-h-60 flex flex-col">
          <div className="overflow-y-auto custom-scrollbar">
            {filteredDatabases.length > 0 ? (
              filteredDatabases.map((db) => {
                const isSystemDb = ['master', 'tempdb', 'model', 'msdb'].includes(db.name.toLowerCase());
                return (
                  <div
                    key={db.name}
                    className={`flex items-center gap-2 px-3 py-2 text-[11px] font-bold cursor-pointer transition-colors ${
                      selectedDatabase === db.name 
                        ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' 
                        : isSystemDb 
                          ? 'bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400 border-l-[3px] border-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/20'
                          : 'hover:bg-gray-100 dark:hover:bg-white/5 dark:text-gray-200'
                    }`}
                    onMouseDown={(e) => {
                      e.preventDefault(); // Prevent input blur before selection
                      handleSelect(db.name);
                    }}
                  >
                    <span className="flex-shrink-0">{db.status === 'OFFLINE' ? '🔴' : '🟢'}</span>
                    <span className="truncate flex-1">{db.name}</span>
                    {isSystemDb && (
                      <span className="text-[8px] font-black uppercase bg-amber-200 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 px-1 rounded ml-auto">System</span>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="px-3 py-4 text-[10px] text-gray-400 font-bold uppercase italic text-center">
                No databases found
              </div>
            )}
          </div>
          {databases.length > 0 && (
            <div className="px-2 py-1 bg-gray-50 dark:bg-black/20 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <span className="text-[9px] text-gray-400 font-black uppercase tracking-tighter">
                {filteredDatabases.length} of {databases.length}
              </span>
              <button 
                onMouseDown={(e) => {
                  e.preventDefault();
                  setSearchTerm('');
                }}
                className="text-[9px] text-blue-500 hover:underline font-bold uppercase"
              >
                Clear Search
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
