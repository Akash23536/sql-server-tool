import { Request, Response } from 'express';
import sql from 'mssql';
import { getPool, setPool, closePool } from '../config/db';
import { ConnectionConfig } from '../types';

export const connect = async (req: Request, res: Response) => {
  try {
    const { server, port, username, password } = req.body;

    if (!server || !username || !password) {
      return res.status(400).json({ success: false, error: 'Server, username and password are required' });
    }

    const config: ConnectionConfig = {
      server,
      port: port || 1433,
      user: username,
      password,
      options: {
        encrypt: false,
        trustServerCertificate: true,
      },
    };

    await closePool();

    const pool = await sql.connect(config);
    setPool(pool);

    await pool.query('SELECT 1');

    res.json({ success: true, message: 'Connected successfully' });
  } catch (error: any) {
    console.error('Connection error:', error.message);
    res.status(400).json({ success: false, error: error.message });
  }
};

export const getDatabases = async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    if (!pool) {
      return res.status(400).json({ error: 'Not connected to SQL Server' });
    }

    const result = await pool.query(`
      SELECT 
        name,
        state_desc as status
      FROM sys.databases 
      WHERE name NOT IN ('master', 'tempdb', 'model', 'msdb')
      ORDER BY name
    `);

    const databases = result.recordset.map((row: any) => ({
      name: row.name,
      status: row.status
    }));
    res.json(databases);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const getObjects = async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    if (!pool) {
      return res.status(400).json({ error: 'Not connected to SQL Server' });
    }

    const { database, type, pageNumber, pageSize, searchTerm } = req.query;
    if (!database) {
      return res.status(400).json({ error: 'Database is required' });
    }

    const dbName = decodeURIComponent(database as string);
    await pool.query(`USE [${dbName.replace(/\[/g, '').replace(/\]/g, '')}]`);

    const page = parseInt(pageNumber as string) || 1;
    const size = parseInt(pageSize as string) || 20;
    const offset = (page - 1) * size;
    const search = searchTerm ? decodeURIComponent(searchTerm as string) : null;

    const getTypeFilter = (objType: string): string => {
      const typeMap: Record<string, string> = {
        'all': "'U', 'V', 'P', 'TF', 'FN', 'IF', 'TR', 'SN'",
        'tables': "'U'",
        'views': "'V'",
        'procedures': "'P'",
        'scalar_functions': "'FN'",
        'table_valued_functions': "'TF'",
        'inline_table_functions': "'IF'",
        'triggers': "'TR'",
        'synonyms': "'SN'"
      };
      return typeMap[objType?.toLowerCase()] || typeMap['all'];
    };

    const getTypeLabel = (objType: string): string => {
      const labelMap: Record<string, string> = {
        'all': 'ALL OBJECTS',
        'tables': 'TABLE',
        'views': 'VIEW',
        'procedures': 'PROCEDURE',
        'scalar_functions': 'SCALAR FUNCTION',
        'table_valued_functions': 'TABLE VALUED FUNCTION',
        'inline_table_functions': 'INLINE TABLE FUNCTION',
        'triggers': 'TRIGGER',
        'synonyms': 'SYNONYM'
      };
      return labelMap[objType?.toLowerCase()] || 'ALL OBJECTS';
    };

    const objectType = (type as string) || 'all';
    const typeFilter = getTypeFilter(objectType);
    const typeLabel = getTypeLabel(objectType);

    const searchCondition = search
      ? `AND (
          o.name LIKE '%${search.replace(/'/g, "''")}%' OR
          REPLACE(o.name, ' ', '') LIKE '%${search.replace(/\s+/g, ' ').trim().replace(/ /g, '').replace(/'/g, "''")}%' OR
          s.name LIKE '%${search.replace(/'/g, "''")}%' OR
          REPLACE(s.name, ' ', '') LIKE '%${search.replace(/\s+/g, ' ').trim().replace(/ /g, '').replace(/'/g, "''")}%' 
        )`
      : '';

    const countQuery = `
      SELECT COUNT(*) as totalCount
      FROM sys.objects o
      INNER JOIN sys.schemas s ON o.schema_id = s.schema_id
      WHERE o.is_ms_shipped = 0
        AND o.type IN (${typeFilter})
        ${searchCondition}
    `;
    const countResult = await pool.query(countQuery);
    const totalCount = countResult.recordset[0]?.totalCount || 0;

    const dataQuery = `
      SELECT 
        o.name AS objectName,
        CASE o.type
          WHEN 'U' THEN 'TABLE'
          WHEN 'V' THEN 'VIEW'
          WHEN 'P' THEN 'PROCEDURE'
          WHEN 'TF' THEN 'TABLE VALUED FUNCTION'
          WHEN 'FN' THEN 'SCALAR FUNCTION'
          WHEN 'IF' THEN 'INLINE TABLE FUNCTION'
          WHEN 'TR' THEN 'TRIGGER'
          WHEN 'SN' THEN 'SYNONYM'
        END AS objectType,
        s.name AS schemaName,
        o.create_date,
        o.modify_date,
        o.object_id AS objectId
      FROM sys.objects o
      INNER JOIN sys.schemas s ON o.schema_id = s.schema_id
      WHERE o.is_ms_shipped = 0
        AND o.type IN (${typeFilter})
        ${searchCondition}
      ORDER BY o.name
      OFFSET ${offset} ROWS
      FETCH NEXT ${size} ROWS ONLY
    `;

    const dataResult = await pool.query(dataQuery);
    const hasMore = offset + dataResult.recordset.length < totalCount;

    res.json({
      objects: dataResult.recordset,
      total: totalCount,
      hasMore: hasMore,
      page: page,
      pageSize: size,
      objectType: typeLabel
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const getObjectCounts = async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    if (!pool) {
      return res.status(400).json({ error: 'Not connected to SQL Server' });
    }

    const { database } = req.query;
    if (!database) {
      return res.status(400).json({ error: 'Database is required' });
    }

    const dbName = decodeURIComponent(database as string);
    await pool.query(`USE [${dbName.replace(/\[/g, '').replace(/\]/g, '')}]`);

    const countsQuery = `
      SELECT 
        COUNT(CASE WHEN o.type = 'U' THEN 1 END) AS tables,
        COUNT(CASE WHEN o.type = 'V' THEN 1 END) AS views,
        COUNT(CASE WHEN o.type = 'P' THEN 1 END) AS procedures,
        COUNT(CASE WHEN o.type = 'FN' THEN 1 END) AS scalar_functions,
        COUNT(CASE WHEN o.type = 'TF' THEN 1 END) AS table_valued_functions,
        COUNT(CASE WHEN o.type = 'IF' THEN 1 END) AS inline_table_functions,
        COUNT(CASE WHEN o.type = 'TR' THEN 1 END) AS triggers,
        COUNT(CASE WHEN o.type = 'SN' THEN 1 END) AS synonyms,
        COUNT(*) AS all_objects
      FROM sys.objects o
      WHERE o.is_ms_shipped = 0
        AND o.type IN ('U', 'V', 'P', 'TF', 'FN', 'IF', 'TR', 'SN')
    `;

    const result = await pool.query(countsQuery);
    const counts = result.recordset[0];

    res.json({
      all: counts.all_objects || 0,
      tables: counts.tables || 0,
      views: counts.views || 0,
      procedures: counts.procedures || 0,
      scalar_functions: counts.scalar_functions || 0,
      table_valued_functions: counts.table_valued_functions || 0,
      triggers: counts.triggers || 0,
      synonyms: counts.synonyms || 0
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const getScript = async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    if (!pool) {
      return res.status(400).json({ error: 'Not connected to SQL Server' });
    }

    const { database, objectName, objectSchema, objectType, action } = req.query;
    if (!database || !objectName) {
      return res.status(400).json({ error: 'Database and object name are required' });
    }

    const dbName = decodeURIComponent(database as string);
    const objName = decodeURIComponent(objectName as string);
    const schemaName = objectSchema ? decodeURIComponent(objectSchema as string) : '';
    const safeDbName = dbName.replace(/\[/g, '').replace(/\]/g, '');
    const safeObjName = objName.replace(/\[/g, '').replace(/\]/g, '');
    const safeSchemaName = schemaName.replace(/\[/g, '').replace(/\]/g, '');
    const qualifiedName = safeSchemaName ? `[${safeSchemaName}].[${safeObjName}]` : `[${safeObjName}]`;
    const schemaDotName = safeSchemaName ? `${safeSchemaName}.${safeObjName}` : `${safeObjName}`;
    const scriptAction = (action as string) || 'select';

    await pool.query(`USE [${safeDbName}]`);

    let script = '';

    const getBaseScript = async (type: string): Promise<string> => {
      if (type === 'TABLE' || type === 'BASE TABLE') {
        const cols = await pool!.query(`
          SELECT 
            COLUMN_NAME,
            DATA_TYPE,
            IS_NULLABLE,
            CHARACTER_MAXIMUM_LENGTH,
            COLUMN_DEFAULT,
            NUMERIC_PRECISION,
            NUMERIC_SCALE
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_NAME = '${safeObjName}'
            ${safeSchemaName ? `AND TABLE_SCHEMA = '${safeSchemaName}'` : ''}
          ORDER BY ORDINAL_POSITION
        `);

        let createScript = `-- Table: ${qualifiedName}\nCREATE TABLE ${qualifiedName} (\n`;
        createScript += cols.recordset.map((col: any) => {
          let colDef = `  [${col.COLUMN_NAME}] ${col.DATA_TYPE}`;
          if (col.CHARACTER_MAXIMUM_LENGTH) {
            if (col.CHARACTER_MAXIMUM_LENGTH === -1) {
              colDef += '(MAX)';
            } else if (col.CHARACTER_MAXIMUM_LENGTH > 0) {
              colDef += `(${col.CHARACTER_MAXIMUM_LENGTH})`;
            }
          } else if (col.NUMERIC_PRECISION && (col.DATA_TYPE.toLowerCase() === 'decimal' || col.DATA_TYPE.toLowerCase() === 'numeric')) {
            colDef += `(${col.NUMERIC_PRECISION}${col.NUMERIC_SCALE !== null && col.NUMERIC_SCALE !== undefined ? ',' + col.NUMERIC_SCALE : ''})`;
          }
          colDef += col.IS_NULLABLE === 'YES' ? ' NULL' : ' NOT NULL';
          if (col.COLUMN_DEFAULT) {
            colDef += ` DEFAULT ${col.COLUMN_DEFAULT}`;
          }
          return colDef;
        }).join(',\n');
        createScript += '\n);';
        return createScript;
      } else {
        const result = await pool!.query(`EXEC sp_helptext '${schemaDotName}'`);
        return result.recordset.map((row: any) => row.Text).join('');
      }
    };

    const baseScript = await getBaseScript(objectType as string);

    switch (scriptAction) {
      case 'create':
        script = baseScript;
        break;
      case 'alter':
        if (objectType === 'TABLE' || objectType === 'BASE TABLE') {
          script = `-- Alter Table: ${qualifiedName}\n-- Use this template to modify an existing table\nALTER TABLE ${qualifiedName}\nADD [ColumnName] datatype NULL;\n\n-- To drop a column:\n-- ALTER TABLE ${qualifiedName} DROP COLUMN ColumnName;\n\n-- To rename:\n-- EXEC sp_rename '${schemaDotName}', 'New${safeObjName}';`;
        } else {
          script = `-- Alter ${objectType}: ${qualifiedName}\n-- Modify the object as needed\n${baseScript}`;
        }
        break;
      case 'drop':
        script = `-- Drop ${objectType}: ${qualifiedName}\nDROP ${objectType === 'TABLE' || objectType === 'BASE TABLE' ? 'TABLE' : objectType} ${qualifiedName};`;
        break;
      case 'rename':
        script = `-- Rename ${objectType}: ${qualifiedName}\nEXEC sp_rename '${schemaDotName}', 'New${safeObjName}';`;
        break;
      case 'select_top_50':
        const columnsResult = await pool!.query(`
          SELECT COLUMN_NAME 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_NAME = '${safeObjName}'
            ${safeSchemaName ? `AND TABLE_SCHEMA = '${safeSchemaName}'` : ''}
          ORDER BY ORDINAL_POSITION
        `);
        if (columnsResult.recordset.length > 0) {
          const columns = columnsResult.recordset.map((c: any) => `[${c.COLUMN_NAME}]`).join(',\n  ');
          script = `SELECT TOP 50\n  ${columns}\nFROM ${qualifiedName}`;
        } else {
          script = `SELECT TOP 50 * FROM ${qualifiedName}`;
        }
        break;
      default:
        script = baseScript;
    }

    res.json({ script: script || 'Script not available' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const executeQuery = async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    if (!pool) {
      return res.status(400).json({ error: 'Not connected to SQL Server' });
    }

    const { database, query } = req.body;
    if (!database || !query) {
      return res.status(400).json({ error: 'Database and query are required' });
    }

    const dbName = decodeURIComponent(database);
    await pool.query(`USE [${dbName.replace(/\[/g, '').replace(/\]/g, '')}]`);

    // Using request().query() to ensure all recordsets are returned
    const result = await pool.request().query(query);
    
    const results = ((result.recordsets as any) || []).map((rs: any) => ({
      columns: rs && rs.length > 0 ? Object.keys(rs[0]) : [],
      rows: rs,
      rowCount: rs ? rs.length : 0
    }));

    res.json({
      results,
      message: result.rowsAffected && result.rowsAffected.length > 0
        ? `${result.rowsAffected.reduce((a, b) => a + b, 0)} row(s) affected across ${result.rowsAffected.length} statement(s)`
        : 'Query executed successfully'
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const searchScripts = async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    if (!pool) {
      return res.status(400).json({ error: 'Not connected to SQL Server' });
    }

    const { database, searchTerm, type } = req.query;
    if (!database || !searchTerm) {
      return res.status(400).json({ error: 'Database and search term are required' });
    }

    const dbName = decodeURIComponent(database as string);
    const search = decodeURIComponent(searchTerm as string);
    const objectTypeFilter = (type as string) || 'all';

    await pool.query(`USE [${dbName.replace(/\[/g, '').replace(/\]/g, '')}]`);

    const getTypeFilter = (objType: string): string => {
      const typeMap: Record<string, string> = {
        'all': "'U', 'V', 'P', 'TF', 'FN', 'IF', 'TR', 'SN'",
        'tables': "'U'",
        'views': "'V'",
        'procedures': "'P'",
        'scalar_functions': "'FN'",
        'table_valued_functions': "'TF'",
        'triggers': "'TR'",
        'synonyms': "'SN'"
      };
      return typeMap[objType?.toLowerCase()] || typeMap['all'];
    };

    const typeFilter = getTypeFilter(objectTypeFilter);

    // Search in sys.sql_modules (Procs, Views, etc.) AND sys.columns (Tables structure)
    const result = await pool.query(`
      SELECT DISTINCT
        o.name AS objectName,
        o.type AS objectType,
        s.name AS schemaName,
        o.create_date,
        o.modify_date,
        o.object_id AS objectId
      FROM sys.objects o
      INNER JOIN sys.schemas s ON o.schema_id = s.schema_id
      LEFT JOIN sys.sql_modules m ON o.object_id = m.object_id
      LEFT JOIN sys.columns c ON o.object_id = c.object_id
      WHERE (
          m.definition LIKE '%${search.replace(/'/g, "''")}%' OR
          c.name LIKE '%${search.replace(/'/g, "''")}%' OR
          o.name LIKE '%${search.replace(/'/g, "''")}%'
        )
        AND o.type IN (${typeFilter})
        AND o.is_ms_shipped = 0
      ORDER BY o.name
    `);

    res.json(result.recordset);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const getModifiedObjects = async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    if (!pool) {
      return res.status(400).json({ error: 'Not connected to SQL Server' });
    }

    const { database, pageNumber, pageSize } = req.query;
    if (!database) {
      return res.status(400).json({ error: 'Database is required' });
    }

    const dbName = decodeURIComponent(database as string);
    await pool.query(`USE [${dbName.replace(/\[/g, '').replace(/\]/g, '')}]`);

    const page = Math.max(parseInt(pageNumber as string) || 1, 1);
    const size = Math.max(parseInt(pageSize as string) || 10, 1);
    const offset = (page - 1) * size;

    const countQuery = `
      SELECT COUNT(*) AS totalCount
      FROM sys.objects o
      WHERE o.is_ms_shipped = 0
        AND o.type IN ('U', 'V', 'P', 'TF', 'FN', 'IF', 'TR', 'SN')
    `;
    const countResult = await pool.query(countQuery);
    const totalCount = countResult.recordset[0]?.totalCount || 0;

    const query = `
      SELECT 
        o.name AS objectName,
        o.type AS objectType,
        s.name AS schemaName,
        o.object_id AS objectId,
        o.create_date AS createDate,
        o.modify_date AS modifyDate
      FROM sys.objects o
      INNER JOIN sys.schemas s ON o.schema_id = s.schema_id
      WHERE o.is_ms_shipped = 0
        AND o.type IN ('U', 'V', 'P', 'TF', 'FN', 'IF', 'TR', 'SN')
      ORDER BY o.modify_date DESC, o.name ASC
      OFFSET ${offset} ROWS
      FETCH NEXT ${size} ROWS ONLY
    `;

    const result = await pool.query(query);
    const objects = result.recordset;
    const hasMore = offset + objects.length < totalCount;

    res.json({
      objects,
      page,
      pageSize: size,
      totalCount,
      hasMore,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const disconnect = async (req: Request, res: Response) => {
  try {
    await closePool();
    res.json({ success: true, message: 'Disconnected successfully' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};


