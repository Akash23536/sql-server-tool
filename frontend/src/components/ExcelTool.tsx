import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { executeQuery } from '../api';

interface ExcelToolProps {
  isOpen: boolean;
  onClose: () => void;
  database: string;
}

export function ExcelTool({ isOpen, onClose, database }: ExcelToolProps) {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [query, setQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Import states
  const [targetTable, setTargetTable] = useState('');
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setPreviewData([]);
      setColumns([]);
      return;
    }

    setError(null);
    setSuccess(null);
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet) as any[];
        
        if (json.length > 0) {
          setPreviewData(json);
          setColumns(Object.keys(json[0]));
        } else {
          setError("The selected Excel file is empty.");
        }
      } catch (err) {
        setError("Failed to parse Excel file.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const validateExportQuery = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return "Query cannot be empty.";
    
    // Check if it starts with SELECT
    if (!trimmed.toUpperCase().startsWith("SELECT")) {
      return "Only SELECT queries are allowed for export.";
    }

    // Check for multiple SELECT statements or semicolons
    const selectMatches = trimmed.match(/\bSELECT\b/gi);
    if (selectMatches && selectMatches.length > 1) {
      return "Multiple SELECT statements are not allowed.";
    }

    if (trimmed.includes(';')) {
      // Allow only if it's at the very end
      const lastIndex = trimmed.lastIndexOf(';');
      if (lastIndex !== trimmed.length - 1) {
        return "Multiple statements (detected via semicolon) are not allowed.";
      }
    }

    return null;
  };

  const handleExport = async () => {
    const validationError = validateExportQuery(query);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await executeQuery(database, query);
      if (result.results && result.results.length > 0) {
        const rows = result.results[0].rows;
        if (!rows || rows.length === 0) {
          setError("No data returned from the query.");
          return;
        }

        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
        
        // Generate filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        XLSX.writeFile(workbook, `SQL_Export_${timestamp}.xlsx`);
        setSuccess("Export successful!");
      } else {
        setError("Query executed but returned no result sets.");
      }
    } catch (err: any) {
      setError(err.message || "Export failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    if (!previewData.length || !targetTable.trim()) {
      setError("Please load a file and enter a target table name.");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setSuccess(null);
    setImportProgress({ current: 0, total: previewData.length });

    try {
      let totalInserted = 0;

      for (let i = 0; i < previewData.length; i++) {
        const row = previewData[i];
        
        // Construct row-by-row execution using variables to ensure all data is treated as NVARCHAR(MAX)
        let sqlQuery = "";
        const paramNames = columns.map((_, idx) => `@p${idx}`);
        
        // Declare variables
        const declarations = columns.map((col, idx) => {
          const val = row[col];
          const formattedVal = (val === null || val === undefined) 
            ? 'NULL' 
            : `'${String(val).replace(/'/g, "''")}'`;
          return `DECLARE @p${idx} NVARCHAR(MAX) = ${formattedVal};`;
        }).join('\n');

        sqlQuery = `${declarations}\nINSERT INTO ${targetTable} (${columns.map(c => `[${c}]`).join(', ')}) VALUES (${paramNames.join(', ')});`;

        await executeQuery(database, sqlQuery);
        totalInserted++;
        setImportProgress({ current: totalInserted, total: previewData.length });
      }

      setSuccess(`Successfully imported ${totalInserted} rows into ${targetTable}.`);
      setPreviewData([]);
      setColumns([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setError(err.message || "Import failed at row " + (importProgress.current + 1));
    } finally {
      setIsProcessing(false);
      setImportProgress({ current: 0, total: 0 });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#252526] w-full max-w-4xl border border-gray-300 dark:border-gray-700 shadow-2xl rounded-sm flex flex-col h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#f3f3f3] dark:bg-[#2d2d2d] border-b border-gray-300 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <span className="text-xl">📊</span>
            <h2 className="text-sm font-black text-gray-800 dark:text-gray-100 uppercase tracking-tighter">Excel Data Tool</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-lg">×</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button 
            onClick={() => { setActiveTab('export'); setError(null); setSuccess(null); }}
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${activeTab === 'export' ? 'bg-blue-600 text-white' : 'bg-gray-50 dark:bg-[#1e1e1e] text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
          >
            Export to Excel
          </button>
          <button 
            onClick={() => { setActiveTab('import'); setError(null); setSuccess(null); }}
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${activeTab === 'import' ? 'bg-blue-600 text-white' : 'bg-gray-50 dark:bg-[#1e1e1e] text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
          >
            Import from Excel
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-hidden flex flex-col">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 text-red-700 dark:text-red-400 text-xs font-bold">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 text-green-700 dark:text-green-400 text-xs font-bold">
              {success}
            </div>
          )}

          {activeTab === 'export' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">SELECT Query</label>
                <textarea 
                  className="w-full h-40 p-3 bg-gray-50 dark:bg-[#1e1e1e] border border-gray-300 dark:border-gray-700 font-mono text-xs outline-none focus:border-blue-500 dark:text-gray-200 resize-none"
                  placeholder="SELECT * FROM TableName"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <p className="mt-1 text-[9px] text-gray-400 italic font-bold uppercase tracking-tighter">* Multiple SELECT statements are not allowed for security and data integrity.</p>
              </div>
              <button 
                onClick={handleExport}
                disabled={isProcessing || !query.trim()}
                className={`w-full py-3 text-xs font-black uppercase tracking-widest shadow-lg transition-all ${isProcessing || !query.trim() ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700 active:scale-[0.98]'}`}
              >
                {isProcessing ? "Processing..." : "Generate & Download Excel"}
              </button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">Target Table</label>
                  <input 
                    type="text"
                    className="w-full p-2 bg-gray-50 dark:bg-[#1e1e1e] border border-gray-300 dark:border-gray-700 text-xs outline-none focus:border-blue-500 dark:text-gray-200"
                    placeholder="[Schema].[TableName]"
                    value={targetTable}
                    onChange={(e) => setTargetTable(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">Excel File</label>
                  <input 
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleFileChange}
                    className="w-full text-xs text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-sm file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-gray-800 dark:file:text-gray-300"
                  />
                </div>
              </div>

              {previewData.length > 0 && (
                <div className="flex-1 flex flex-col overflow-hidden border border-gray-200 dark:border-gray-800 rounded-sm">
                  <div className="bg-gray-100 dark:bg-gray-800 px-3 py-1 text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase border-b border-gray-200 dark:border-gray-700 flex justify-between">
                    <span>Sheet Preview ({previewData.length} rows)</span>
                    {isProcessing && <span>Importing: {importProgress.current} / {importProgress.total}</span>}
                  </div>
                  <div className="flex-1 overflow-auto bg-white dark:bg-[#1e1e1e]">
                    <table className="w-full text-[10px] border-collapse">
                      <thead className="sticky top-0 bg-gray-50 dark:bg-[#2d2d2d] shadow-sm">
                        <tr>
                          {columns.map(col => (
                            <th key={col} className="px-2 py-1.5 border-b border-r border-gray-300 dark:border-gray-700 text-left truncate max-w-[150px]">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.slice(0, 50).map((row, i) => (
                          <tr key={i} className="hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors">
                            {columns.map(col => (
                              <td key={col} className="px-2 py-1 border-b border-r border-gray-200 dark:border-gray-800 truncate max-w-[150px]">
                                {row[col] === null ? 'NULL' : String(row[col])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {previewData.length > 50 && (
                      <div className="p-2 text-center text-gray-400 italic text-[9px]">Showing first 50 rows only...</div>
                    )}
                  </div>
                </div>
              )}

              <button 
                onClick={handleImport}
                disabled={isProcessing || !previewData.length || !targetTable.trim()}
                className={`w-full py-3 text-xs font-black uppercase tracking-widest shadow-lg transition-all ${isProcessing || !previewData.length || !targetTable.trim() ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]'}`}
              >
                {isProcessing ? `Importing Row ${importProgress.current}...` : "Start Row-by-Row Import"}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-[#f3f3f3] dark:bg-[#2d2d2d] border-t border-gray-300 dark:border-gray-700 flex justify-end">
          <button onClick={onClose} className="px-4 py-1.5 text-[10px] font-black text-gray-500 hover:text-gray-800 uppercase tracking-widest">Close</button>
        </div>
      </div>
    </div>
  );
}
