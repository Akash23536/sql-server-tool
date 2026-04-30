import express from 'express';
import cors from 'cors';
import sql from 'mssql';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Store connection pool in memory
let pool: sql.ConnectionPool | null = null;

// Connection config interface
interface ConnectionConfig {
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

// API Routes

// 1. Test Connection
app.post('/api/connect', async (req, res) => {
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

    // Close existing connection if any
    if (pool) {
      try {
        await pool.close();
      } catch (e) {
        // Ignore close errors
      }
    }

    // Create new connection pool
    pool = await sql.connect(config);

    // Test the connection
    await pool.query('SELECT 1');

    res.json({ success: true, message: 'Connected successfully' });
  } catch (error: any) {
    console.error('Connection error:', error.message);
    res.status(400).json({ success: false, error: error.message });
  }
});

// 2. Get Database List
app.get('/api/databases', async (req, res) => {
  try {
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
});

// 3. Get Database Objects (Tables, Views, Stored Procedures) - with Pagination
app.get('/api/objects', async (req, res) => {
  try {
    if (!pool) {
      return res.status(400).json({ error: 'Not connected to SQL Server' });
    }

    const { database, type, pageNumber, pageSize, searchTerm } = req.query;
    if (!database) {
      return res.status(400).json({ error: 'Database is required' });
    }

    // Decode the database name from URL encoding
    const dbName = decodeURIComponent(database as string);

    // Switch to the specified database using parameterized query
    await pool.query(`USE [${dbName.replace(/\[/g, '').replace(/\]/g, '')}]`);

    // Pagination parameters
    const page = parseInt(pageNumber as string) || 1;
    const size = parseInt(pageSize as string) || 20;
    const offset = (page - 1) * size;
    const search = searchTerm ? decodeURIComponent(searchTerm as string) : null;

    // Map object type to SQL type codes
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

    // Get object type label
    const getTypeLabel = (objType: string): string => {
      const labelMap: Record<string, string> = {
        'all': 'ALL OBJECTS',
        'tables': 'TABLE',
        'views': 'VIEW',
        'procedures': 'PROCEDURE',
        'scalar_functions': 'SCALAR FUNCTION',
        'table_valued_functions': 'TABLE VALUED FUNCTION',
        'triggers': 'TRIGGER',
        'synonyms': 'SYNONYM'
      };
      return labelMap[objType?.toLowerCase()] || 'ALL OBJECTS';
    };

    const objectType = (type as string) || 'all';
    const typeFilter = getTypeFilter(objectType);
    const typeLabel = getTypeLabel(objectType);

    // Build search condition
    const searchCondition = search
      ? `AND o.name LIKE '%${search.replace(/'/g, "''")}%'`
      : '';

    // Get total count
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

    // Get paged results
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

    // Calculate hasMore
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
});

// 3b. Get Object Type Counts
app.get('/api/object-counts', async (req, res) => {
  try {
    if (!pool) {
      return res.status(400).json({ error: 'Not connected to SQL Server' });
    }

    const { database } = req.query;
    if (!database) {
      return res.status(400).json({ error: 'Database is required' });
    }


    const dbName = decodeURIComponent(database as string);

    // Switch to the specified database
    await pool.query(`USE [${dbName.replace(/\[/g, '').replace(/\]/g, '')}]`);

    // Get counts for all object types
    const countsQuery = `
      SELECT 
        COUNT(CASE WHEN o.type = 'U' THEN 1 END) AS tables,
        COUNT(CASE WHEN o.type = 'V' THEN 1 END) AS views,
        COUNT(CASE WHEN o.type = 'P' THEN 1 END) AS procedures,
        COUNT(CASE WHEN o.type = 'FN' THEN 1 END) AS scalar_functions,
        COUNT(CASE WHEN o.type = 'TF' THEN 1 END) AS table_valued_functions,
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
});

// 4. Get Object Script
app.get('/api/script', async (req, res) => {
  try {
    if (!pool) {
      return res.status(400).json({ error: 'Not connected to SQL Server' });
    }

    const { database, objectName, objectType, action } = req.query;
    if (!database || !objectName) {
      return res.status(400).json({ error: 'Database and object name are required' });
    }

    // Decode the database name from URL encoding
    const dbName = decodeURIComponent(database as string);
    const objName = decodeURIComponent(objectName as string);
    const scriptAction = (action as string) || 'select';

    await pool.query(`USE [${dbName.replace(/\[/g, '').replace(/\]/g, '')}]`);

    let script = '';

    // Get base script based on object type
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
          WHERE TABLE_NAME = '${objName}'
          ORDER BY ORDINAL_POSITION
        `);

        let createScript = `-- Table: ${objName}\nCREATE TABLE [${objName}] (\n`;
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
      } else if (type === 'VIEW') {
        const result = await pool!.query(`EXEC sp_helptext '${objName}'`);
        return result.recordset.map((row: any) => row.Text).join('');
      } else if (type === 'PROCEDURE') {
        const result = await pool!.query(`EXEC sp_helptext '${objName}'`);
        return result.recordset.map((row: any) => row.Text).join('');
      } else if (type.includes('FUNCTION')) {
        const result = await pool!.query(`EXEC sp_helptext '${objName}'`);
        return result.recordset.map((row: any) => row.Text).join('');
      }
      return '-- Script not available';
    };

    const baseScript = await getBaseScript(objectType as string);

    // Generate script based on action
    switch (scriptAction) {
      case 'create':
        script = baseScript;
        break;
      case 'alter':
        if (objectType === 'TABLE' || objectType === 'BASE TABLE') {
          script = `-- Alter Table: ${objName}\n-- Use this template to modify an existing table\nALTER TABLE [${objName}]\nADD [ColumnName] datatype NULL;\n\n-- To drop a column:\n-- ALTER TABLE [${objName}] DROP COLUMN ColumnName;\n\n-- To rename:\n-- EXEC sp_rename '[${objName}]', 'NewTableName';`;
        } else {
          script = `-- Alter ${objectType}: ${objName}\n-- Modify the object as needed\n${baseScript}`;
        }
        break;
      case 'drop':
        script = `-- Drop ${objectType}: ${objName}\nDROP ${objectType === 'TABLE' || objectType === 'BASE TABLE' ? 'TABLE' : objectType} [${objName}];`;
        break;
      case 'rename':
        script = `-- Rename ${objectType}: ${objName}\nEXEC sp_rename '[${objName}]', 'New${objName}';`;
        break;
      default:
        script = baseScript;
    }

    res.json({ script: script || 'Script not available' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// 5. Execute Query
app.post('/api/query', async (req, res) => {
  try {
    if (!pool) {
      return res.status(400).json({ error: 'Not connected to SQL Server' });
    }

    const { database, query } = req.body;

    if (!database || !query) {
      return res.status(400).json({
        error: 'Database and query are required'
      });
    }

    const dbName = decodeURIComponent(database);

    await pool.query(
      `USE [${dbName.replace(/\[/g, '').replace(/\]/g, '')}]`
    );

    const result = await pool.query(query);

    const rows = result.recordset || [];
    const columns =
      rows.length > 0 ? Object.keys(rows[0]) : [];

    res.json({
      columns,
      rows,
      rowCount: rows.length,
      message:
        result.rowsAffected &&
          result.rowsAffected.length > 0
          ? `${result.rowsAffected[0]} row(s) affected`
          : 'Query executed successfully'
    });

  } catch (error: any) {
    res.status(400).json({
      error: error.message
    });
  }
});

// 6. Disconnect
app.post('/api/disconnect', async (req, res) => {
  try {
    if (pool) {
      await pool.close();
      pool = null;
    }
    res.json({ success: true, message: 'Disconnected successfully' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Serve static files from the React app
const frontendPath = path.join(__dirname, '../../frontend/vite-project/dist');
app.use(express.static(frontendPath));

// The "catchall" handler: for any request that doesn't match one above, send back React's index.html file.
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});