import Fastify from 'fastify';
import { DiagramRepository, type DiagramRepositoryLike } from '../persistence/diagram-repository';
import { registerExportRoutes } from './export-routes';
import { ExportService } from '../services/export-service';
import { DiagramService } from '../services/diagram-service';
import { registerRecoveryRoutes } from './recovery-routes';
import { registerDiagramRoutes } from './diagram-routes';

export function buildApp(repository: DiagramRepositoryLike = new DiagramRepository()) {
  const app = Fastify({ logger: false });
  const service = new DiagramService(repository);

  app.get('/health', async () => ({ ok: true }));
  registerDiagramRoutes(app, repository, service);
  registerRecoveryRoutes(app, repository, service);
  registerExportRoutes(app, new ExportService(repository));
  return app;
}
