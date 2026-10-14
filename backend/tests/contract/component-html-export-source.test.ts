import type * as Domain from '../../../shared/src/index';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/api/app';
import { DiagramRepository } from '../../src/persistence/diagram-repository';
import { AdrRepository } from '../../src/persistence/adr-repository';
import { componentPackageInput } from '../../../shared/tests/component-package-input';
import { HtmlExportSourceService } from '../../src/services/html-export-source';
import { scopedRepository } from '../html-export-source-fixtures';
const apps: ReturnType<typeof buildApp>[] = [];
afterEach(async () => { await Promise.all(apps.splice(0).map(a => a.close())); });
export function componentSourceFixture() {
  const fixture = componentPackageInput(), diagrams = new DiagramRepository(), adrs = new AdrRepository();
  for (const member of fixture.source.diagrams) { diagrams.create(member.diagram); for (const adr of member.adrs) adrs.registerAdr(adr); }
  return { ...fixture, diagrams, adrs };
}
describe('Component HTML source REST contract', () => {
  it('serializes exact entry subtrees, contexts and both owner availability variants', async () => {
    const { root, parent, child, diagrams, adrs } = componentSourceFixture();
    const app = buildApp(diagrams, adrs); apps.push(app);
    for (const [entry, count] of [[root, 4], [parent, 3], [child, 1]] as const) {
      const response = await app.inject({ method: 'GET', url: `/diagrams/${entry.id}/export/html-source` });
      expect(response.statusCode).toBe(200);
      const body = response.json(); expect(body.diagrams).toHaveLength(count); expect(body.diagrams[0].diagram.id).toBe(entry.id);
      expect(body.containerContext).toBeUndefined(); expect(body.sourceContexts[child.id].scope.containerId).toBe((child.scope as Domain.ComponentScope).containerId);
      if (entry.kind === 'general') expect(body.availability.some((a: Domain.ComponentAvailability) => a.containerId)).toBe(true);
      expect(body.diagrams.find((d: Domain.HtmlExportSource['diagrams'][number]) => d.diagram.id === child.id).adrs).toHaveLength(2);
    }
  });
  it('excludes deliberate trash but fails unavailable required children and ancestors with actionable identities', async () => {
    const { root, parent, child, sibling, diagrams, adrs } = componentSourceFixture();
    diagrams.trash(sibling.id); const service = new HtmlExportSourceService(diagrams, adrs);
    expect((await service.gather(root.id)).diagrams.map(m => m.diagram.id)).not.toContain(sibling.id);
    for (const missing of [child.id, parent.id]) {
      const broken = scopedRepository(diagrams, repo => ({ get: id => id === missing ? undefined : repo.get(id) }));
      await expect(new HtmlExportSourceService(broken, adrs).gather(root.id)).rejects.toMatchObject({ diagramId: missing, code: 'HTML_EXPORT_INCOMPLETE', remedy: expect.any(String) });
    }
    const brokenAncestor = scopedRepository(diagrams, repo => ({ get: id => id === parent.id ? undefined : repo.get(id) }));
    await expect(new HtmlExportSourceService(brokenAncestor, adrs).gather(child.id)).rejects.toThrow();
  });
});
