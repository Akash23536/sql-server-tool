import './ResultsGrid.css';

interface QueryResultSet {
  rows: any[];
  rowCount: number;
  columns: string[];
}

interface QueryResult {
  results: QueryResultSet[];
  message: string;
}

interface ResultsGridProps {
  result: QueryResult | null;
  error: string | null;
}

export function ResultsGrid({ result, error }: ResultsGridProps) {
  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-red-500 bg-red-50 dark:bg-red-900/10 border-t border-red-200 dark:border-red-900/50">
        <span className="text-4xl mb-4">⚠️</span>
        <h3 className="text-sm font-bold uppercase mb-2">Query Execution Failed</h3>
        <p className="text-xs text-center max-w-lg font-mono">{error}</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-gray-400 dark:text-gray-600 bg-gray-50 dark:bg-[#1e1e1e]">
        <span className="text-5xl mb-4 opacity-20">📊</span>
        <p className="text-xs font-bold uppercase tracking-widest">Execute a query to see results</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-[#1e1e1e] overflow-hidden border-t border-gray-300 dark:border-gray-800">
      <div className="flex-1 overflow-auto bg-gray-100 dark:bg-[#121212]">
        {result.results.map((resultSet, rsIndex) => (
          <div key={rsIndex} className="m-4 bg-white dark:bg-[#1e1e1e] border border-gray-300 dark:border-gray-800 shadow-sm rounded-sm overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#dee1e6] dark:bg-[#2d2d2d] border-b border-gray-300 dark:border-gray-700">
              <span className="text-[10px] font-extrabold text-gray-700 dark:text-gray-200 uppercase">Result Set {rsIndex + 1}</span>
              <span className="text-[10px] font-bold text-[#0078d4] dark:text-[#3a96dd]">{resultSet.rows?.length || 0} rows</span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-gray-50 dark:bg-[#252526] z-10 shadow-sm">
                  <tr>
                    {resultSet.columns?.map((col) => (
                      <th key={col} className="px-3 py-2 border-b border-r border-gray-300 dark:border-gray-700 font-bold text-gray-800 dark:text-white whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {resultSet.rows && resultSet.rows.length > 0 ? (
                    resultSet.rows.map((row, i) => (
                      <tr key={i} className="hover:bg-[#eef6ff] dark:hover:bg-blue-900/30 transition-colors">
                        {resultSet.columns?.map((col) => {
                          const val = row[col];
                          return (
                            <td key={col} className="px-3 py-1.5 border-r border-gray-200 dark:border-gray-800 whitespace-nowrap max-w-[300px] truncate text-gray-800 dark:text-gray-200">
                              {val === null ? <span className="text-gray-400 dark:text-gray-600 italic">NULL</span> : String(val)}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={resultSet.columns?.length || 1} className="px-4 py-8 text-center text-gray-400 italic">
                        No rows returned
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {result.message && (
          <div className="mx-4 mb-4 p-4 bg-[#f5f5f5] dark:bg-[#1e1e1e] border-l-4 border-[#0078d4] text-gray-700 dark:text-gray-300 font-mono text-[11px] whitespace-pre-wrap shadow-sm">
            {result.message}
          </div>
        )}
      </div>
      
      {/* Status Bar - SSMS Style */}
      <div className="px-3 py-1 bg-[#0078d4] text-white flex items-center justify-between text-[10px] font-bold">
        <div className="flex items-center gap-4">
          <span>Query executed successfully.</span>
          <span>Time: 00:00:00</span>
        </div>
        <div>Rows: {result.results.reduce((acc, rs) => acc + (rs.rows?.length || 0), 0)}</div>
      </div>
    </div>
  );
}