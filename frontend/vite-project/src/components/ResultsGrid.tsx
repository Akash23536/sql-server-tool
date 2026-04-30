import './ResultsGrid.css';

interface QueryResult {
  columns: string[];
  rows: any[];
  rowCount: number;
  message: string;
}

interface ResultsGridProps {
  result: QueryResult | null;
  error: string | null;
}

export function ResultsGrid({ result, error }: ResultsGridProps) {
  if (error) {
    return (
      <div className="results-grid">
        <div className="error-state">
          <h4>Error</h4>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="results-grid">
        <div className="empty-state">
          <p>Execute a query to see results</p>
        </div>
      </div>
    );
  }

  if (result.message && result.rows.length === 0) {
    return (
      <div className="results-grid">
        <div className="message-state">
          <p>{result.message}</p>
        </div>
      </div>
    );
  }

  if (result.rows.length === 0) {
    return (
      <div className="results-grid">
        <div className="empty-state">
          <p>No results found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="results-grid">
      <div className="results-header">
        <span>{result.rowCount} row(s) returned</span>
      </div>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              {result.columns.map((col) => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row, idx) => (
              <tr key={idx}>
                {result.columns.map((col) => (
                  <td key={col}>
                    {row[col] === null ? <span className="null-value">NULL</span> : String(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}