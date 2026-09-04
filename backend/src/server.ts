import { pathToFileURL } from 'node:url';
import { config } from './config';
import { createDatabase } from './persistence/database';
import { buildApp } from './api/app';
import { PostgresDiagramRepository } from './persistence/diagram-repository';

export function createServer(env: NodeJS.ProcessEnv = process.env) {
  const settings = config(env);
  const database = createDatabase(settings.databaseUrl);
  const app = buildApp(new PostgresDiagramRepository(database.db));
  return { app, database, settings };
}

export async function startServer(env: NodeJS.ProcessEnv = process.env) {
  const { app, database, settings } = createServer(env);
  try {
    await app.listen({ port: settings.port, host: '0.0.0.0' });
    return { app, database, settings };
  } catch (error: unknown) {
    app.log.error(error);
    await database.pool.end();
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer().catch(() => process.exit(1));
}
