import { pathToFileURL } from 'node:url';
import { config } from './config';
import { createDatabase } from './persistence/database';
import { buildApp } from './api/app';
import { PostgresDiagramRepository } from './persistence/diagram-repository';
import { PostgresAdrRepository } from './persistence/adr-repository';

export function createServer(env: NodeJS.ProcessEnv = process.env) {
  const settings = config(env);
  const database = createDatabase(settings.databaseUrl);
  const app = buildApp(new PostgresDiagramRepository(database.db), new PostgresAdrRepository(database.db));
  app.addHook('onClose', async () => { await database.pool.end(); });
  return { app, database, settings };
}

export async function startServer(env: NodeJS.ProcessEnv = process.env) {
  const { app, database, settings } = createServer(env);
  try {
    await app.listen({ port: settings.port, host: '0.0.0.0' });
    return { app, database, settings };
  } catch (error: unknown) {
    app.log.error(error);
    await app.close();
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer().then(({ app }) => {
    const shutdown = () => {
      app.close().catch((error: unknown) => {
        console.error('API shutdown failed:', error);
        process.exitCode = 1;
      }).finally(() => {
        process.removeListener('SIGTERM', shutdown);
        process.removeListener('SIGINT', shutdown);
      });
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  }).catch((error: unknown) => {
    console.error('API startup failed:', error);
    process.exitCode = 1;
  });
}
