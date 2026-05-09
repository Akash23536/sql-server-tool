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

    const portNum = parseInt(port as string) || 1433;
    console.log(`[SQL] Attempting connection to: ${server}:${portNum} for user: ${username}`);
    const config: ConnectionConfig = {
      server,
      port: portNum,
      user: username,
      password,
      options: {
        encrypt: false, // Reverted to false for maximum compatibility
        trustServerCertificate: true,
      },
    };

    await closePool();

    const pool = await sql.connect(config);
    setPool(pool);

    await pool.query('SELECT 1');
    console.log('[SQL] Connected successfully');

    res.json({ success: true, message: 'Connected successfully' });
  } catch (error: any) {
    console.error('[SQL] Connection error:', error.message);
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
      ORDER BY 
        CASE 
          WHEN name IN ('master', 'tempdb', 'model', 'msdb') THEN 0 
          ELSE 1 
        END,
        name
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
        'all': "'U', 'V', 'P', 'TF', 'FN', 'IF', 'TR', 'SN', 'SO', 'S', 'IT', 'SQ'",
        'tables': "'U'",
        'system_tables': "'S', 'IT'",
        'views': "'V'",
        'procedures': "'P'",
        'scalar_functions': "'FN'",
        'table_valued_functions': "'TF'",
        'inline_table_functions': "'IF'",
        'triggers': "'TR'",
        'synonyms': "'SN'",
        'sequences': "'SO'",
        'service_queues': "'SQ'"
      };
      return typeMap[objType?.toLowerCase()] || typeMap['all'];
    };

    const getTypeLabel = (objType: string): string => {
      const labelMap: Record<string, string> = {
        'all': 'ALL OBJECTS',
        'tables': 'TABLE',
        'system_tables': 'SYSTEM TABLE',
        'views': 'VIEW',
        'procedures': 'PROCEDURE',
        'scalar_functions': 'SCALAR FUNCTION',
        'table_valued_functions': 'TABLE VALUED FUNCTION',
        'inline_table_functions': 'INLINE TABLE FUNCTION',
        'triggers': 'TRIGGER',
        'synonyms': 'SYNONYM',
        'sequences': 'SEQUENCE',
        'service_queues': 'SERVICE QUEUE'
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

    const isSystemDb = ['master', 'tempdb', 'model', 'msdb'].includes(dbName.toLowerCase());
    const msShippedCondition = (objectType.toLowerCase() === 'system_tables' || objectType.toLowerCase() === 'all' || isSystemDb) 
      ? "1=1" 
      : "o.is_ms_shipped = 0";

    const countQuery = `
      SELECT COUNT(*) as totalCount
      FROM sys.objects o
      INNER JOIN sys.schemas s ON o.schema_id = s.schema_id
      WHERE ${msShippedCondition}
        AND o.type IN (${typeFilter})
        ${searchCondition}
    `;
    const countResult = await pool.query(countQuery);
    const totalCount = countResult.recordset[0]?.totalCount || 0;

    const compareWith = req.query.compareWith ? decodeURIComponent(req.query.compareWith as string) : null;
    const safeCompareDb = compareWith ? compareWith.replace(/\[/g, '').replace(/\]/g, '') : null;

    const dataQuery = `
      SELECT 
        o.name AS objectName,
        CASE o.type
          WHEN 'U' THEN 'TABLE'
          WHEN 'S' THEN 'SYSTEM TABLE'
          WHEN 'IT' THEN 'INTERNAL TABLE'
          WHEN 'V' THEN 'VIEW'
          WHEN 'P' THEN 'PROCEDURE'
          WHEN 'TF' THEN 'TABLE VALUED FUNCTION'
          WHEN 'FN' THEN 'SCALAR FUNCTION'
          WHEN 'IF' THEN 'INLINE TABLE FUNCTION'
          WHEN 'TR' THEN 'TRIGGER'
          WHEN 'SN' THEN 'SYNONYM'
          WHEN 'SO' THEN 'SEQUENCE'
          WHEN 'SQ' THEN 'SERVICE QUEUE'
          ELSE o.type
        END AS objectType,
        s.name AS schemaName,
        o.create_date,
        o.modify_date,
        o.object_id AS objectId
        ${safeCompareDb ? `, CASE WHEN EXISTS (
          SELECT 1 FROM [${safeCompareDb}].sys.objects t 
          INNER JOIN [${safeCompareDb}].sys.schemas ts ON t.schema_id = ts.schema_id
          WHERE t.name = o.name AND t.type = o.type AND ts.name = s.name
        ) THEN 1 ELSE 0 END AS existsInCompareDb` : ''}
      FROM sys.objects o
      INNER JOIN sys.schemas s ON o.schema_id = s.schema_id
      WHERE ${msShippedCondition}
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
        const objectId = safeSchemaName 
          ? `OBJECT_ID('[${safeSchemaName}].[${safeObjName}]')` 
          : `OBJECT_ID('[${safeObjName}]')`;

        // 1. Get Columns with Identity and Computed info
        const cols = await pool!.query(`
          SELECT 
            c.name AS COLUMN_NAME,
            t.name AS DATA_TYPE,
            c.is_nullable,
            CASE 
              WHEN t.name IN ('varchar', 'char', 'varbinary', 'binary') THEN c.max_length
              WHEN t.name IN ('nvarchar', 'nchar') THEN c.max_length / 2
              ELSE NULL
            END AS CHARACTER_MAXIMUM_LENGTH,
            c.precision AS NUMERIC_PRECISION,
            c.scale AS NUMERIC_SCALE,
            c.is_identity,
            ic.seed_value,
            ic.increment_value,
            object_definition(c.default_object_id) AS COLUMN_DEFAULT,
            cc.definition AS COMPUTED_DEFINITION
          FROM sys.columns c
          INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
          LEFT JOIN sys.identity_columns ic ON c.object_id = ic.object_id AND c.column_id = ic.column_id
          LEFT JOIN sys.computed_columns cc ON c.object_id = cc.object_id AND c.column_id = cc.column_id
          WHERE c.object_id = ${objectId}
          ORDER BY c.column_id
        `);

        // 2. Get Primary Key info
        const pk = await pool!.query(`
          SELECT 
            i.name AS PK_NAME,
            i.type_desc AS PK_TYPE,
            COL_NAME(ic.object_id, ic.column_id) AS COLUMN_NAME
          FROM sys.indexes i
          INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
          WHERE i.is_primary_key = 1 AND i.object_id = ${objectId}
          ORDER BY ic.key_ordinal
        `);

        // 3. Get Foreign Keys
        const fks = await pool!.query(`
          SELECT 
            f.name AS FK_NAME,
            COL_NAME(fc.parent_object_id, fc.parent_column_id) AS ParentColumn,
            OBJECT_SCHEMA_NAME(f.referenced_object_id) AS RefSchema,
            OBJECT_NAME(f.referenced_object_id) AS RefTable,
            COL_NAME(fc.referenced_object_id, fc.referenced_column_id) AS RefColumn,
            f.delete_referential_action_desc,
            f.update_referential_action_desc
          FROM sys.foreign_keys f
          INNER JOIN sys.foreign_key_columns fc ON f.object_id = fc.constraint_object_id
          WHERE f.parent_object_id = ${objectId}
        `);

        // 4. Get Indexes (excluding PK)
        const indexes = await pool!.query(`
          SELECT 
            i.name AS INDEX_NAME,
            i.is_unique,
            i.type_desc,
            i.filter_definition,
            COL_NAME(ic.object_id, ic.column_id) AS COLUMN_NAME,
            ic.is_descending_key,
            ic.is_included_column
          FROM sys.indexes i
          INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
          WHERE i.is_primary_key = 0 AND i.is_unique_constraint = 0 AND i.object_id = ${objectId}
          ORDER BY i.index_id, ic.key_ordinal
        `);

        // 5. Get Check Constraints
        const checks = await pool!.query(`
          SELECT 
            name AS CHECK_NAME,
            definition AS CHECK_DEFINITION
          FROM sys.check_constraints
          WHERE parent_object_id = ${objectId}
        `);

        let createScript = `-- Table: ${qualifiedName}\nCREATE TABLE ${qualifiedName} (\n`;
        
        // Assemble columns
        const colDefinitions = cols.recordset.map((col: any) => {
          if (col.COMPUTED_DEFINITION) {
            return `  [${col.COLUMN_NAME}] AS ${col.COMPUTED_DEFINITION}`;
          }

          let colDef = `  [${col.COLUMN_NAME}] [${col.DATA_TYPE}]`;
          
          if (col.CHARACTER_MAXIMUM_LENGTH) {
            if (col.CHARACTER_MAXIMUM_LENGTH === -1) {
              colDef += '(MAX)';
            } else {
              colDef += `(${col.CHARACTER_MAXIMUM_LENGTH})`;
            }
          } else if (col.NUMERIC_PRECISION && (col.DATA_TYPE.toLowerCase() === 'decimal' || col.DATA_TYPE.toLowerCase() === 'numeric')) {
            colDef += `(${col.NUMERIC_PRECISION}, ${col.NUMERIC_SCALE})`;
          }

          if (col.is_identity) {
            colDef += ` IDENTITY(${col.seed_value},${col.increment_value})`;
          }

          colDef += col.is_nullable ? ' NULL' : ' NOT NULL';
          
          if (col.COLUMN_DEFAULT) {
            colDef += ` DEFAULT ${col.COLUMN_DEFAULT}`;
          }
          
          return colDef;
        });

        // Add Primary Key constraint
        if (pk.recordset.length > 0) {
          const pkName = pk.recordset[0].PK_NAME;
          const pkCols = pk.recordset.map((p: any) => `[${p.COLUMN_NAME}]`).join(', ');
          colDefinitions.push(`  CONSTRAINT [${pkName}] PRIMARY KEY ${pk.recordset[0].PK_TYPE === 'CLUSTERED' ? 'CLUSTERED' : 'NONCLUSTERED'} (${pkCols})`);
        }

        // Add Check constraints
        if (checks.recordset.length > 0) {
          checks.recordset.forEach((cc: any) => {
            colDefinitions.push(`  CONSTRAINT [${cc.CHECK_NAME}] CHECK ${cc.CHECK_DEFINITION}`);
          });
        }

        createScript += colDefinitions.join(',\n');
        createScript += '\n);\nGO\n\n';

        // Add Foreign Keys
        if (fks.recordset.length > 0) {
          // Group multi-column FKs if any
          const groupedFks: Record<string, any> = {};
          fks.recordset.forEach((fk: any) => {
            if (!groupedFks[fk.FK_NAME]) {
              groupedFks[fk.FK_NAME] = {
                name: fk.FK_NAME,
                parentCols: [],
                refSchema: fk.RefSchema,
                refTable: fk.RefTable,
                refCols: [],
                onDelete: fk.delete_referential_action_desc,
                onUpdate: fk.update_referential_action_desc
              };
            }
            groupedFks[fk.FK_NAME].parentCols.push(`[${fk.ParentColumn}]`);
            groupedFks[fk.FK_NAME].refCols.push(`[${fk.RefColumn}]`);
          });

          Object.values(groupedFks).forEach((fk: any) => {
            createScript += `ALTER TABLE ${qualifiedName} WITH CHECK ADD CONSTRAINT [${fk.name}] FOREIGN KEY (${fk.parentCols.join(', ')})\n`;
            createScript += `REFERENCES [${fk.refSchema}].[${fk.refTable}] (${fk.refCols.join(', ')})\n`;
            if (fk.onDelete !== 'NO_ACTION') createScript += `ON DELETE ${fk.onDelete.replace('_', ' ')}\n`;
            if (fk.onUpdate !== 'NO_ACTION') createScript += `ON UPDATE ${fk.onUpdate.replace('_', ' ')}\n`;
            createScript += `GO\nALTER TABLE ${qualifiedName} CHECK CONSTRAINT [${fk.name}]\nGO\n\n`;
          });
        }

        // Add Indexes
        if (indexes.recordset.length > 0) {
          const groupedIdx: Record<string, any> = {};
          indexes.recordset.forEach((idx: any) => {
            if (!groupedIdx[idx.INDEX_NAME]) {
              groupedIdx[idx.INDEX_NAME] = {
                name: idx.INDEX_NAME,
                isUnique: idx.is_unique,
                type: idx.type_desc,
                filter: idx.filter_definition,
                cols: [],
                included: []
              };
            }
            if (idx.is_included_column) {
              groupedIdx[idx.INDEX_NAME].included.push(`[${idx.COLUMN_NAME}]`);
            } else {
              groupedIdx[idx.INDEX_NAME].cols.push(`[${idx.COLUMN_NAME}]${idx.is_descending_key ? ' DESC' : ''}`);
            }
          });

          Object.values(groupedIdx).forEach((idx: any) => {
            createScript += `CREATE ${idx.isUnique ? 'UNIQUE ' : ''}${idx.type === 'CLUSTERED' ? 'CLUSTERED ' : ''}INDEX [${idx.name}] ON ${qualifiedName} (${idx.cols.join(', ')})`;
            if (idx.included.length > 0) {
              createScript += ` INCLUDE (${idx.included.join(', ')})`;
            }
            if (idx.filter) {
              createScript += ` WHERE ${idx.filter}`;
            }
            createScript += '\nGO\n\n';
          });
        }

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
          // Replace the first 'CREATE' with 'ALTER' (case-insensitive)
          const alteredScript = baseScript.replace(/\bCREATE\b/i, 'ALTER');
          script = alteredScript;
        }
        break;
      case 'create_or_alter':
        if (objectType === 'TABLE' || objectType === 'BASE TABLE') {
          script = baseScript;
        } else {
          script = baseScript.replace(/\bCREATE\b/i, 'CREATE OR ALTER');
        }
        break;
      case 'drop_and_create':
        const dropPart = `-- Drop ${objectType}: ${qualifiedName}\nIF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'${qualifiedName}') AND type in (N'U', N'V', 'P', 'FN', 'TF', 'IF', 'TR'))\nDROP ${objectType === 'TABLE' || objectType === 'BASE TABLE' ? 'TABLE' : objectType} ${qualifiedName};\nGO\n\n`;
        script = dropPart + baseScript;
        break;
      case 'drop':
        script = `-- Drop ${objectType}: ${qualifiedName}\nDROP ${objectType === 'TABLE' || objectType === 'BASE TABLE' ? 'TABLE' : objectType} ${qualifiedName};`;
        break;
      case 'rename':
        script = `-- Rename ${objectType}: ${qualifiedName}\nEXEC sp_rename '${schemaDotName}', 'New${safeObjName}';`;
        break;
      case 'select_top_50':
        const colsQuery = `
          SELECT COLUMN_NAME 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_NAME = '${safeObjName}'
            ${safeSchemaName ? `AND TABLE_SCHEMA = '${safeSchemaName}'` : ''}
          ORDER BY ORDINAL_POSITION
        `;
        const selectCols = await pool!.query(colsQuery);
        if (selectCols.recordset.length > 0) {
          const columns = selectCols.recordset.map((c: any) => `[${c.COLUMN_NAME}]`).join(',\n  ');
          script = `SELECT TOP 50\n  ${columns}\nFROM ${qualifiedName}`;
        } else {
          script = `SELECT TOP 50 * FROM ${qualifiedName}`;
        }
        break;
      case 'insert':
        const insertCols = await pool!.query(`
          SELECT COLUMN_NAME 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_NAME = '${safeObjName}'
            ${safeSchemaName ? `AND TABLE_SCHEMA = '${safeSchemaName}'` : ''}
          ORDER BY ORDINAL_POSITION
        `);
        const colList = insertCols.recordset.map((c: any) => `[${c.COLUMN_NAME}]`).join(', ');
        const valList = insertCols.recordset.map((c: any) => `<${c.COLUMN_NAME}>`).join(', ');
        script = `INSERT INTO ${qualifiedName}\n  (${colList})\nVALUES\n  (${valList})`;
        break;
      case 'update':
        const updateCols = await pool!.query(`
          SELECT COLUMN_NAME 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_NAME = '${safeObjName}'
            ${safeSchemaName ? `AND TABLE_SCHEMA = '${safeSchemaName}'` : ''}
          ORDER BY ORDINAL_POSITION
        `);
        const setList = updateCols.recordset.map((c: any) => `[${c.COLUMN_NAME}] = <${c.COLUMN_NAME}>`).join(',\n  ');
        script = `UPDATE ${qualifiedName}\nSET\n  ${setList}\nWHERE <Search Conditions>`;
        break;
      case 'delete':
        script = `DELETE FROM ${qualifiedName}\nWHERE <Search Conditions>`;
        break;
      case 'execute':
        if (objectType === 'PROCEDURE' || objectType === 'P' || objectType === 'PROC') {
          const params = await pool!.query(`
            SELECT 
              PARAMETER_NAME,
              DATA_TYPE
            FROM INFORMATION_SCHEMA.PARAMETERS
            WHERE SPECIFIC_NAME = '${safeObjName}'
              ${safeSchemaName ? `AND SPECIFIC_SCHEMA = '${safeSchemaName}'` : ''}
          `);
          const paramList = params.recordset.map((p: any) => `  ${p.PARAMETER_NAME} = <${p.PARAMETER_NAME.substring(1)}>`).join(',\n');
          script = paramList ? `EXECUTE ${qualifiedName}\n${paramList}` : `EXECUTE ${qualifiedName}`;
        } else {
          // Functions (FN, TF, IF)
          const fnParams = await pool!.query(`
            SELECT 
              PARAMETER_NAME,
              DATA_TYPE
            FROM INFORMATION_SCHEMA.PARAMETERS
            WHERE SPECIFIC_NAME = '${safeObjName}'
              ${safeSchemaName ? `AND SPECIFIC_SCHEMA = '${safeSchemaName}'` : ''}
              AND PARAMETER_MODE = 'IN'
            ORDER BY ORDINAL_POSITION
          `);
          const fnParamList = fnParams.recordset.map((p: any) => `<${p.PARAMETER_NAME.substring(1)}>`).join(', ');
          
          if (objectType === 'SCALAR FUNCTION' || objectType === 'FN') {
            script = `SELECT ${qualifiedName}(${fnParamList})`;
          } else {
            // Table-valued (TF) and Inline Table (IF) functions
            script = `SELECT * FROM ${qualifiedName}(${fnParamList})`;
          }
        }
        break;
      case 'insert_data':
        const dataResult = await pool!.query(`SELECT TOP 100 * FROM ${qualifiedName}`);
        if (dataResult.recordset.length === 0) {
          script = `-- No data found in ${qualifiedName}`;
        } else {
          const columns = Object.keys(dataResult.recordset[0]);
          const insertHeader = `-- Data INSERT script for ${qualifiedName} (Top 100 rows)\nINSERT INTO ${qualifiedName}\n  (${columns.map(c => `[${c}]`).join(', ')})\nVALUES\n`;
          
          const rows = dataResult.recordset.map((row: any) => {
            const values = columns.map(col => {
              const val = row[col];
              if (val === null || val === undefined) return 'NULL';
              if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
              if (val instanceof Date) return `'${val.toISOString().replace('T', ' ').replace('Z', '')}'`;
              if (Buffer.isBuffer(val)) return `0x${val.toString('hex')}`;
              if (typeof val === 'boolean') return val ? '1' : '0';
              return val;
            }).join(', ');
            return `  (${values})`;
          }).join(',\n');
          
          script = insertHeader + rows + ';';
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

    // Split on GO batch separator (just like SSMS does)
    // GO must be on its own line (optionally with whitespace)
    const batches = query
      .split(/^\s*GO\s*$/gmi)
      .map((b: string) => b.trim())
      .filter((b: string) => b.length > 0);

    const allResults: any[] = [];
    let totalRowsAffected = 0;
    let totalStatements = 0;

    for (const batch of batches) {
      const result = await pool.request().query(batch);
      
      const batchResults = ((result.recordsets as any) || []).map((rs: any) => ({
        columns: rs && rs.length > 0 ? Object.keys(rs[0]) : [],
        rows: rs,
        rowCount: rs ? rs.length : 0
      }));
      allResults.push(...batchResults);

      if (result.rowsAffected && result.rowsAffected.length > 0) {
        totalRowsAffected += result.rowsAffected.reduce((a: number, b: number) => a + b, 0);
        totalStatements += result.rowsAffected.length;
      }
    }

    res.json({
      results: allResults,
      message: totalStatements > 0
        ? `${totalRowsAffected} row(s) affected across ${totalStatements} statement(s) in ${batches.length} batch(es)`
        : `Query executed successfully (${batches.length} batch${batches.length > 1 ? 'es' : ''})`
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
    const pageNum = parseInt(req.query.pageNumber as string) || 1;
    const size = parseInt(req.query.pageSize as string) || 20;
    const offset = (pageNum - 1) * size;

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
        'synonyms': "'SN'",
        'jobs': "'JOB'"
      };
      return typeMap[objType?.toLowerCase()] || typeMap['all'];
    };

    const typeFilter = getTypeFilter(objectTypeFilter);

    // Enhanced search with pagination
    const result = await pool.query(`
      WITH CombinedResults AS (
        SELECT DISTINCT
          o.name COLLATE DATABASE_DEFAULT AS objectName,
          CASE LTRIM(RTRIM(o.type))
            WHEN 'U' THEN 'TABLE'
            WHEN 'V' THEN 'VIEW'
            WHEN 'P' THEN 'PROCEDURE'
            WHEN 'TF' THEN 'TABLE VALUED FUNCTION'
            WHEN 'FN' THEN 'SCALAR FUNCTION'
            WHEN 'IF' THEN 'INLINE TABLE FUNCTION'
            WHEN 'TR' THEN 'TRIGGER'
            WHEN 'SN' THEN 'SYNONYM'
            ELSE LTRIM(RTRIM(o.type))
          END COLLATE DATABASE_DEFAULT AS objectType,
          s.name COLLATE DATABASE_DEFAULT AS schemaName,
          o.create_date AS createDate,
          o.modify_date AS modifyDate,
          CAST(o.object_id AS VARCHAR(100)) COLLATE DATABASE_DEFAULT AS objectId
        FROM sys.sql_modules m
        INNER JOIN sys.objects o ON m.object_id = o.object_id
        INNER JOIN sys.schemas s ON o.schema_id = s.schema_id
        WHERE m.definition LIKE N'%${search.replace(/'/g, "''")}%'
          AND o.type IN (${typeFilter})
          AND o.is_ms_shipped = 0

        UNION ALL

        SELECT DISTINCT
          o.name COLLATE DATABASE_DEFAULT AS objectName,
          CASE LTRIM(RTRIM(o.type))
            WHEN 'U' THEN 'TABLE'
            WHEN 'V' THEN 'VIEW'
            WHEN 'P' THEN 'PROCEDURE'
            WHEN 'TF' THEN 'TABLE VALUED FUNCTION'
            WHEN 'FN' THEN 'SCALAR FUNCTION'
            WHEN 'IF' THEN 'INLINE TABLE FUNCTION'
            WHEN 'TR' THEN 'TRIGGER'
            WHEN 'SN' THEN 'SYNONYM'
            ELSE LTRIM(RTRIM(o.type))
          END COLLATE DATABASE_DEFAULT AS objectType,
          s.name COLLATE DATABASE_DEFAULT AS schemaName,
          o.create_date AS createDate,
          o.modify_date AS modifyDate,
          CAST(o.object_id AS VARCHAR(100)) COLLATE DATABASE_DEFAULT AS objectId
        FROM sys.objects o
        INNER JOIN sys.schemas s ON o.schema_id = s.schema_id
        LEFT JOIN sys.columns c ON o.object_id = c.object_id
        WHERE (
            o.name LIKE N'%${search.replace(/'/g, "''")}%' OR
            c.name LIKE N'%${search.replace(/'/g, "''")}%'
          )
          AND o.type IN (${typeFilter})
          AND o.is_ms_shipped = 0
          AND o.object_id NOT IN (SELECT object_id FROM sys.sql_modules WHERE definition LIKE N'%${search.replace(/'/g, "''")}%')

        UNION ALL

        SELECT DISTINCT
          j.name COLLATE DATABASE_DEFAULT AS objectName,
          'AGENT JOB' COLLATE DATABASE_DEFAULT AS objectType,
          'msdb' COLLATE DATABASE_DEFAULT AS schemaName,
          j.date_created AS createDate,
          j.date_modified AS modifyDate,
          CAST(j.job_id AS VARCHAR(100)) COLLATE DATABASE_DEFAULT AS objectId
        FROM msdb.dbo.sysjobs j
        JOIN msdb.dbo.sysjobsteps s ON j.job_id = s.job_id
        WHERE (
            s.command LIKE N'%${search.replace(/'/g, "''")}%' OR
            j.name LIKE N'%${search.replace(/'/g, "''")}%'
          )
          AND (${objectTypeFilter === 'all' || objectTypeFilter === 'jobs' ? '1=1' : '1=0'})
      ),
      TotalCount AS (SELECT COUNT(*) AS total FROM CombinedResults)
      SELECT *, (SELECT total FROM TotalCount) AS totalRows
      FROM CombinedResults
      ORDER BY objectName
      OFFSET ${offset} ROWS FETCH NEXT ${size} ROWS ONLY
    `);

    const totalCount = result.recordset.length > 0 ? result.recordset[0].totalRows : 0;
    res.json({
      objects: result.recordset,
      total: totalCount,
      hasMore: offset + size < totalCount,
      page: pageNum,
      pageSize: size
    });
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

    const { database, pageNumber, pageSize, searchTerm } = req.query;
    if (!database) {
      return res.status(400).json({ error: 'Database is required' });
    }

    const dbName = decodeURIComponent(database as string);
    await pool.query(`USE [${dbName.replace(/\[/g, '').replace(/\]/g, '')}]`);

    const page = Math.max(parseInt(pageNumber as string) || 1, 1);
    const size = Math.max(parseInt(pageSize as string) || 10, 1);
    const offset = (page - 1) * size;
    const search = searchTerm ? decodeURIComponent(searchTerm as string) : null;

    const searchCondition = search
      ? `AND (
          o.name LIKE '%${search.replace(/'/g, "''")}%' OR
          s.name LIKE '%${search.replace(/'/g, "''")}%'
        )`
      : '';

    const countQuery = `
      SELECT COUNT(*) AS totalCount
      FROM sys.objects o
      INNER JOIN sys.schemas s ON o.schema_id = s.schema_id
      WHERE o.is_ms_shipped = 0
        AND o.type IN ('U', 'V', 'P', 'TF', 'FN', 'IF', 'TR', 'SN')
        ${searchCondition}
    `;
    const countResult = await pool.query(countQuery);
    const totalCount = countResult.recordset[0]?.totalCount || 0;

    const query = `
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
        o.object_id AS objectId,
        o.create_date AS createDate,
        o.modify_date AS modifyDate
      FROM sys.objects o
      INNER JOIN sys.schemas s ON o.schema_id = s.schema_id
      WHERE o.is_ms_shipped = 0
        AND o.type IN ('U', 'V', 'P', 'TF', 'FN', 'IF', 'TR', 'SN')
        ${searchCondition}
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


