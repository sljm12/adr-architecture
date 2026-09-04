import { drizzle } from 'drizzle-orm/node-postgres'; import { Pool } from 'pg'; import { config } from '../config'; import * as schema from './schema';
export function createDatabase(url=config().databaseUrl){ const pool=new Pool({connectionString:url}); return {db:drizzle(pool,{schema}),pool}; }
