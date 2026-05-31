import { Pool } from 'pg';
import { env } from '../config/env.js';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ...(env.NODE_ENV === 'production' ? { ssl: { rejectUnauthorized: false } } : {}),
});
