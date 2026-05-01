import sql from 'mssql';

let pool: sql.ConnectionPool | null = null;

export const getPool = () => pool;

export const setPool = (newPool: sql.ConnectionPool | null) => {
  pool = newPool;
};

export const closePool = async () => {
  if (pool) {
    try {
      await pool.close();
      pool = null;
    } catch (e) {
      console.error('Error closing pool:', e);
    }
  }
};
