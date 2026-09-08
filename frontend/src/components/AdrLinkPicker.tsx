import { useMemo, useState } from 'react';
import type { Component } from '../../../shared/src/index';

type Props = {
  components: Component[];
  selectedIds: string[];
  onChange: (componentIds: string[]) => void;
  onSelectComponent?: (componentId: string) => void;
};

export function AdrLinkPicker({ components, selectedIds, onChange, onSelectComponent }: Props) {
  const [query, setQuery] = useState('');
  const selected = useMemo(() => components.filter(component => selectedIds.includes(component.id)), [components, selectedIds]);
  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return components.filter(component => !normalized || component.name.toLowerCase().includes(normalized));
  }, [components, query]);
  const toggle = (id: string) => onChange(selectedIds.includes(id) ? selectedIds.filter(selectedId => selectedId !== id) : [...selectedIds, id]);

  return <section className="adr-link-picker" aria-labelledby="adr-link-picker-heading">
    <div className="adr-link-picker-heading"><div><h4 id="adr-link-picker-heading">Linked components</h4><p>Optional scope for this decision.</p></div><span className="adr-link-count">{selected.length}</span></div>
    {selected.length === 0 ? <p className="adr-unlinked-state">Unlinked — this ADR applies across the diagram.</p> : <ul className="adr-link-chips" aria-label="Selected components">{selected.map(component => <li key={component.id} className="adr-link-chip"><span>{component.name}</span><button type="button" className="adr-link-chip-remove" onClick={() => toggle(component.id)} aria-label={`Remove ${component.name}`}>Remove</button>{onSelectComponent && <button type="button" className="adr-link-chip-navigate" onClick={() => onSelectComponent(component.id)}>View</button>}</li>)}</ul>}
    <label className="adr-link-search" htmlFor="adr-component-search">Search components<input id="adr-component-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Filter by component name" /></label>
    <div className="adr-link-options" role="group" aria-label="Available components">{matches.length === 0 ? <p className="adr-feedback">No matching components.</p> : matches.map(component => <label key={component.id} className="adr-link-option"><input type="checkbox" aria-label={component.name} checked={selectedIds.includes(component.id)} onChange={() => toggle(component.id)} /><span>{component.name}</span><small>{component.type ?? 'Component'}</small></label>)}</div>
  </section>;
}
