import Fastify from 'fastify';
import { DiagramRepository, type DiagramRepositoryLike } from '../persistence/diagram-repository';
import { AdrRepository, type AdrRepositoryLike } from '../persistence/adr-repository';
import { registerExportRoutes } from './export-routes';
import { ExportService } from '../services/export-service';
import { DiagramService } from '../services/diagram-service';
import { registerRecoveryRoutes } from './recovery-routes';
import { registerDiagramRoutes } from './diagram-routes';
import { registerAdrRoutes } from './adr-routes';
import { AdrService } from '../services/adr-service';

export function buildApp(repository: DiagramRepositoryLike = new DiagramRepository(), adrRepository: AdrRepositoryLike = new AdrRepository()) {
  const app = Fastify({ logger: false });
  const service = new DiagramService(repository);
  const adrService = new AdrService(adrRepository, repository);

  app.get('/health', async () => ({ ok: true }));
  registerDiagramRoutes(app, repository, service);
  registerAdrRoutes(app, adrService);
  registerRecoveryRoutes(app, repository, service);
  registerExportRoutes(app, new ExportService(repository));
  return app;
}
