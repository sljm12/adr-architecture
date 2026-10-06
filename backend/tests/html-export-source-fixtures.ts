import { DiagramRepository, type DiagramRepositoryLike } from '../src/persistence/diagram-repository';
import { AdrRepository } from '../src/persistence/adr-repository';
import { htmlPackageFixture } from '../../shared/tests/html-export-fixtures';

export function sourceFixture() {
  const fixture = htmlPackageFixture();
  const diagrams = new DiagramRepository();
  const adrs = new AdrRepository();
  for (const document of [fixture.parent, ...fixture.children, fixture.trashedChild, fixture.unrelatedParent, fixture.unrelatedChild]) diagrams.create(document);
  diagrams.trash(fixture.trashedChild.id);
  for (const records of Object.values(fixture.adrsByDiagram)) for (const adr of records) adrs.registerAdr(adr);
  return { fixture, diagrams, adrs };
}

/** Preserve method receivers while instrumenting both outer and transaction-scoped reads. */
export function scopedRepository(repository: DiagramRepositoryLike, overrides: (scoped: DiagramRepositoryLike) => Partial<DiagramRepositoryLike>): DiagramRepositoryLike {
  const wrap = (scoped: DiagramRepositoryLike): DiagramRepositoryLike => new Proxy(scoped, {
    get(target, key) {
      if (key === 'withGraphTransaction') return (parent: string, children: string[], action: Parameters<DiagramRepositoryLike['withGraphTransaction']>[2]) =>
        target.withGraphTransaction(parent, children, (transaction, executor) => action(wrap(transaction), executor));
      const value = Reflect.get(overrides(target), key) ?? Reflect.get(target, key);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  return wrap(repository);
}
