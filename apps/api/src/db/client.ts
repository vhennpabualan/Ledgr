import { Pool } from 'pg';
import { env } from '../config/env.js';

// Single shared pool — reused across all queries in the process.
// Pool size defaults (10 max) are fine for a personal-scale app on Neon.
export const pool = new Pool({ connectionString: env.DATABASE_URL });
