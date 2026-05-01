import sql from 'mssql';

export interface ConnectionConfig {
  server: string;
  port: number;
  user: string;
  password: string;
  database?: string;
  options: {
    encrypt: boolean;
    trustServerCertificate: boolean;
  };
}

export interface DbObject {
  objectName: string;
  objectType: string;
  schemaName: string;
  create_date: Date;
  modify_date: Date;
  objectId: number;
}

export interface PagedResponse<T> {
  objects: T[];
  total: number;
  hasMore: boolean;
  page: number;
  pageSize: number;
  objectType: string;
}

export interface QueryResultSet {
  columns: string[];
  rows: any[];
  rowCount: number;
}

export interface MultiQueryResult {
  results: QueryResultSet[];
  message: string;
}
