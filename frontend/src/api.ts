const API_BASE = (import.meta.env.VITE_API_URL?.replace(/\/$/, '') || (import.meta.env.DEV ? 'http://localhost:5000' : '')) + '/api';

const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('app_authToken');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

export interface ConnectionConfig {
  server: string;
  port: number;
  username: string;
  password: string;
}

export interface QueryResultSet {
  columns: string[];
  rows: any[];
  rowCount: number;
}

export interface QueryResult {
  results: QueryResultSet[];
  message: string;
}

export interface DbObject {
  objectName: string;
  objectType: string;
  schemaName?: string;
  objectId?: number;
  createDate?: string;
  modifyDate?: string;
  existsInCompareDb?: number;
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
  | 'system_tables'
  | 'views' 
  | 'procedures' 
  | 'scalar_functions' 
  | 'table_valued_functions' 
  | 'inline_table_functions' 
  | 'triggers' 
  | 'synonyms'
  | 'sequences'
  | 'service_queues'
  | 'jobs';

// Object type options for dropdown
export const OBJECT_TYPE_OPTIONS: { value: ObjectTypeFilter; label: string }[] = [
  { value: 'all', label: 'All Objects' },
  { value: 'tables', label: 'Tables' },
  { value: 'system_tables', label: 'System Tables' },
  { value: 'views', label: 'Views' },
  { value: 'procedures', label: 'Stored Procedures' },
  { value: 'scalar_functions', label: 'Scalar Functions' },
  { value: 'table_valued_functions', label: 'Table Valued Functions' },
  { value: 'inline_table_functions', label: 'Inline Table Functions' },
  { value: 'triggers', label: 'Triggers' },
  { value: 'synonyms', label: 'Synonyms' },
  { value: 'sequences', label: 'Sequences' },
  { value: 'service_queues', label: 'Service Queues' },
  { value: 'jobs', label: 'Agent Jobs' },
];

// Connect to SQL Server
export const connectToServer = async (config: ConnectionConfig, signal?: AbortSignal): Promise<{ success: boolean; error?: string }> => {
  try {
    const response = await fetch(`${API_BASE}/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
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
  const response = await fetch(`${API_BASE}/databases`, { headers: getAuthHeaders() });
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
  const response = await fetch(`${API_BASE}/object-counts?${params}`, { headers: getAuthHeaders() });
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
  searchTerm?: string,
  compareWith?: string
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

  if (compareWith) {
    params.append('compareWith', compareWith);
  }
  
  const response = await fetch(`${API_BASE}/objects?${params}`, { headers: getAuthHeaders() });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get objects');
  }
  return response.json();
};

// Get object script
export const getObjectScript = async (database: string, objectName: string, objectType: string, action: string = 'select', objectSchema?: string): Promise<string> => {
  const params = new URLSearchParams({ database, objectName, objectType, action });
  if (objectSchema) {
    params.append('objectSchema', objectSchema);
  }
  const response = await fetch(`${API_BASE}/script?${params}`, { headers: getAuthHeaders() });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get script');
  }
  const data = await response.json();
  return data.script;
};

// Search in scripts with pagination
export const searchScripts = async (
  database: string, 
  searchTerm: string, 
  objectType: string = 'all',
  pageNumber: number = 1,
  pageSize: number = 20
): Promise<PagedResponse<DbObject>> => {
  const params = new URLSearchParams({ 
    database, 
    searchTerm, 
    type: objectType,
    pageNumber: pageNumber.toString(),
    pageSize: pageSize.toString()
  });
  const response = await fetch(`${API_BASE}/search-scripts?${params}`, { headers: getAuthHeaders() });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to search scripts');
  }
  return response.json();
};

// Execute query
export const executeQuery = async (database: string, query: string, signal?: AbortSignal): Promise<QueryResult> => {
  const response = await fetch(`${API_BASE}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ database, query }),
    signal,
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Query execution failed');
  }
  
  return response.json();
};

// Disconnect
export const disconnect = async (): Promise<void> => {
  await fetch(`${API_BASE}/disconnect`, { 
    method: 'POST',
    headers: getAuthHeaders()
  });
};

// Get modified objects
export const getModifiedObjects = async (
  database: string,
  pageNumber: number = 1,
  pageSize: number = 10,
  searchTerm?: string
): Promise<{ objects: DbObject[]; page: number; pageSize: number; totalCount: number; hasMore: boolean }> => {
  const params = new URLSearchParams({
    database,
    pageNumber: pageNumber.toString(),
    pageSize: pageSize.toString(),
  });
  
  if (searchTerm) {
    params.append('searchTerm', searchTerm);
  }
  
  const response = await fetch(`${API_BASE}/modified-objects?${params}`, { headers: getAuthHeaders() });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get modified objects');
  }
  return response.json();
};

// Ask AI
export const askAI = async (query: string, prompt: string, error?: string, model?: string): Promise<{ message: string }> => {
  // Use the AI specific endpoint
  const response = await fetch(`${API_BASE}/ai/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ query, prompt, error, model }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'AI request failed');
  }
  
  return response.json();
};

// Get available AI Models
export const getAIModels = async (): Promise<{ id: string; name: string }[]> => {
  const response = await fetch(`${API_BASE}/ai/models`, { headers: getAuthHeaders() });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch AI models');
  }
  return response.json();
};