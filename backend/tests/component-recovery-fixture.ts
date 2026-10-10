import { DiagramRepository } from '../src/persistence/diagram-repository';
import { componentContextFixture, componentParentFixture, populatedComponentFixture, emptyComponentFixture } from '../../shared/tests/component-fixtures';
import type { DiagramDocument } from '../../shared/src/index';
export function componentRecoveryFixture() {
  const repository = new DiagramRepository();
  for (const document of [componentContextFixture(), componentParentFixture(), populatedComponentFixture(), emptyComponentFixture('datastore')]) repository.create(document as DiagramDocument);
  return repository;
}
