import { buildApp } from './api/app';
import { config } from './config';
import { createDatabase } from './persistence/database';
import { DiagramRepository, PostgresDiagramRepository } from './persistence/diagram-repository';

const settings = config();
const database = settings.databaseUrl ? createDatabase(settings.databaseUrl) : undefined;
const app = buildApp(database ? new PostgresDiagramRepository(database.db) : new DiagramRepository());

app.listen({ port: settings.port, host: '0.0.0.0' })
  .catch(async (error: unknown) => {
    app.log.error(error);
    await database?.pool.end();
    process.exit(1);
  });
