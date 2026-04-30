const API_BASE = (import.meta.env.VITE_API_URL || '') + '/api';

export interface ConnectionConfig {
  server: string;
  port: number;
  username: string;
  password: string;
}

export interface QueryResult {
  columns: string[];
  rows: any[];
  rowCount: number;
  message: string;
}

export interface DbObject {
  objectName: string;
  objectType: string;
  schemaName?: string;
  objectId?: number;
  createDate?: string;
  modifyDate?: string;
}

export interface Database {
  name: string;
  status: string;
}

// Paged response interface
export interface PagedResponse<T> {
  objects: T[];
  total: number;
  hasMore: boolean;
  page: number;
  pageSize: number;
  objectType: string;
}

// Object type enum for type-safe filtering
export type ObjectTypeFilter = 
  | 'all' 
  | 'tables' 
  | 'views' 
  | 'procedures' 
  | 'scalar_functions' 
  | 'table_valued_functions' 
  | 'triggers' 
  | 'synonyms';

// Object type options for dropdown
export const OBJECT_TYPE_OPTIONS: { value: ObjectTypeFilter; label: string }[] = [
  { value: 'all', label: 'All Objects' },
  { value: 'tables', label: 'Tables' },
  { value: 'views', label: 'Views' },
  { value: 'procedures', label: 'Stored Procedures' },
  { value: 'scalar_functions', label: 'Scalar Functions' },
  { value: 'table_valued_functions', label: 'Table Valued Functions' },
  { value: 'triggers', label: 'Triggers' },
  { value: 'synonyms', label: 'Synonyms' },
];

// Connect to SQL Server
export const connectToServer = async (config: ConnectionConfig, signal?: AbortSignal): Promise<{ success: boolean; error?: string }> => {
  try {
    const response = await fetch(`${API_BASE}/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
      signal,
    });
    
    const data = await response.json();
    return data;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw error;
    }
    return { success: false, error: error.message };
  }
};

// Get list of databases
export const getDatabases = async (): Promise<Database[]> => {
  const response = await fetch(`${API_BASE}/databases`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get databases');
  }
  return response.json();
};

export interface ObjectCounts {
  tables: number;
  views: number;
  procedures: number;
  scalar_functions: number;
  table_valued_functions: number;
  triggers: number;
  synonyms: number;
  all: number;
}

// Get object counts for a database
export const getObjectCounts = async (database: string): Promise<ObjectCounts> => {
  const params = new URLSearchParams({ database });
  const response = await fetch(`${API_BASE}/object-counts?${params}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get object counts');
  }
  return response.json();
};

// Get objects (tables, views, procedures, functions) with pagination
export const getObjects = async (
  database: string, 
  objectType: ObjectTypeFilter = 'all',
  pageNumber: number = 1,
  pageSize: number = 20,
  searchTerm?: string
): Promise<PagedResponse<DbObject>> => {
  const params = new URLSearchParams({ 
    database, 
    type: objectType,
    pageNumber: pageNumber.toString(),
    pageSize: pageSize.toString()
  });
  
  if (searchTerm) {
    params.append('searchTerm', searchTerm);
  }
  
  const response = await fetch(`${API_BASE}/objects?${params}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get objects');
  }
  return response.json();
};

// Get object script
export const getObjectScript = async (database: string, objectName: string, objectType: string, action: string = 'select'): Promise<string> => {
  const params = new URLSearchParams({ database, objectName, objectType, action });
  const response = await fetch(`${API_BASE}/script?${params}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get script');
  }
  const data = await response.json();
  return data.script;
};

// Execute query
export const executeQuery = async (database: string, query: string): Promise<QueryResult> => {
  const response = await fetch(`${API_BASE}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ database, query }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Query execution failed');
  }
  
  return response.json();
};

// Disconnect
export const disconnect = async (): Promise<void> => {
  await fetch(`${API_BASE}/disconnect`, { method: 'POST' });
};