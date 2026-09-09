import { useMemo, useState } from 'react';
import type { Component, Relationship } from '../../../shared/src/index';

type Props = {
  components: Component[];
  relationships?: Relationship[];
  selectedIds: string[];
  relationshipIds?: string[];
  onChange: (componentIds: string[]) => void;
  onRelationshipChange?: (relationshipIds: string[]) => void;
  onSelectComponent?: (componentId: string) => void;
  onSelectRelationship?: (relationshipId: string) => void;
};

export function AdrLinkPicker({ components, relationships = [], selectedIds, relationshipIds = [], onChange, onRelationshipChange, onSelectComponent, onSelectRelationship }: Props) {
  const [query, setQuery] = useState('');
  const selectedComponents = useMemo(() => components.filter(component => selectedIds.includes(component.id)), [components, selectedIds]);
  const selectedRelationships = useMemo(() => relationships.filter(relationship => relationshipIds.includes(relationship.id)), [relationships, relationshipIds]);
  const relationshipName = (relationship: Relationship) => {
    const source = components.find(component => component.id === relationship.sourceComponentId)?.name ?? 'Unknown component';
    const target = components.find(component => component.id === relationship.targetComponentId)?.name ?? 'Unknown component';
    return `${source} → ${target}${relationship.label ? ` · ${relationship.label}` : ''}`;
  };
  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return {
      components: components.filter(component => !normalized || component.name.toLowerCase().includes(normalized)),
      relationships: relationships.filter(relationship => !normalized || relationshipName(relationship).toLowerCase().includes(normalized)),
    };
  }, [components, relationships, query]);
  const toggleComponent = (id: string) => onChange(selectedIds.includes(id) ? selectedIds.filter(selectedId => selectedId !== id) : [...selectedIds, id]);
  const toggleRelationship = (id: string) => onRelationshipChange?.(relationshipIds.includes(id) ? relationshipIds.filter(selectedId => selectedId !== id) : [...relationshipIds, id]);
  const selectedCount = selectedComponents.length + selectedRelationships.length;

  return <section className="adr-link-picker" aria-labelledby="adr-link-picker-heading">
    <div className="adr-link-picker-heading"><div><h4 id="adr-link-picker-heading">Linked artifacts</h4><p>Optional scope for this decision.</p></div><span className="adr-link-count" aria-label={`${selectedCount} linked artifacts`}>{selectedCount}</span></div>
    {selectedCount === 0 ? <p className="adr-unlinked-state">Unlinked — this ADR applies across the diagram.</p> : <ul className="adr-link-chips" aria-label="Selected components and relationships">
      {selectedComponents.map(component => <li key={`component-${component.id}`} className="adr-link-chip"><span>{component.name}</span><button type="button" className="adr-link-chip-remove" onClick={() => toggleComponent(component.id)} aria-label={`Remove ${component.name}`}>Remove</button>{onSelectComponent && <button type="button" className="adr-link-chip-navigate" onClick={() => onSelectComponent(component.id)}>View</button>}</li>)}
      {selectedRelationships.map(relationship => <li key={`relationship-${relationship.id}`} className="adr-link-chip"><span>{relationshipName(relationship)}</span><button type="button" className="adr-link-chip-remove" onClick={() => toggleRelationship(relationship.id)} aria-label={`Remove relationship ${relationshipName(relationship)}`}>Remove</button>{onSelectRelationship && <button type="button" className="adr-link-chip-navigate" onClick={() => onSelectRelationship(relationship.id)}>View</button>}</li>)}
    </ul>}
    <label className="adr-link-search" htmlFor="adr-component-search">Search components and relationships<input id="adr-component-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Filter by component or relationship" /></label>
    <div className="adr-link-options" role="group" aria-label="Available components and relationships">
      {matches.components.map(component => <label key={`component-option-${component.id}`} className="adr-link-option"><input type="checkbox" aria-label={component.name} checked={selectedIds.includes(component.id)} onChange={() => toggleComponent(component.id)} /><span>{component.name}</span><small>{component.type ?? 'Component'}</small></label>)}
      {matches.relationships.map(relationship => <label key={`relationship-option-${relationship.id}`} className="adr-link-option"><input type="checkbox" aria-label={`Relationship ${relationshipName(relationship)}`} checked={relationshipIds.includes(relationship.id)} onChange={() => toggleRelationship(relationship.id)} /><span>{relationshipName(relationship)}</span><small>Relationship</small></label>)}
      {matches.components.length === 0 && matches.relationships.length === 0 && <p className="adr-feedback">No matching components or relationships.</p>}
    </div>
  </section>;
}
