import { useState } from 'react';
import './ConnectionForm.css';

interface ConnectionFormProps {
  onConnect: (server: string, port: number, username: string, password: string) => Promise<void>;
  onCancel: () => void;
  isConnecting: boolean;
  error: string | null;
}

export function ConnectionForm({ onConnect, onCancel, isConnecting, error }: ConnectionFormProps) {
  const [server, setServer] = useState('5.175.139.84');
  const [port, setPort] = useState('2006');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onConnect(server, parseInt(port), username, password);
  };

  return (
    <div className="connection-form">
      <h2>Connect to SQL Server</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="server">Server IP / Hostname</label>
          <input
            type="text"
            id="server"
            value={server}
            onChange={(e) => setServer(e.target.value)}
            placeholder="e.g., 192.168.1.100 or localhost"
            disabled={isConnecting}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="port">Port</label>
          <input
            type="number"
            id="port"
            value={port}
            onChange={(e) => setPort(e.target.value)}
            placeholder="1433"
            disabled={isConnecting}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="username">Username</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="sa"
            disabled={isConnecting}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            disabled={isConnecting}
            required
          />
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="button-group">
          {isConnecting ? (
            <button type="button" className="cancel-button" onClick={onCancel}>
              Cancel
            </button>
          ) : (
            <button type="submit" disabled={isConnecting}>
              Connect
            </button>
          )}
        </div>
      </form>
    </div>
  );
}