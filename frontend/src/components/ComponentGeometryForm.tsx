import { useState, type FormEvent } from 'react';
import type { Component } from '../../../shared/src/index';
import { useDiagramStore } from '../state/diagram-store';

export function ComponentGeometryForm({ component }: { component: Component }) {
  const [width, setWidth] = useState(String(component.size.width)), [height, setHeight] = useState(String(component.size.height)), [error, setError] = useState('');
  const sizeKey = `${component.id}:${component.size.width}:${component.size.height}`;
  const [previousSizeKey, setPreviousSizeKey] = useState(sizeKey);
  if (sizeKey !== previousSizeKey) { setPreviousSizeKey(sizeKey); setWidth(String(component.size.width)); setHeight(String(component.size.height)); setError(''); }
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!width.trim() || !height.trim() || !useDiagramStore.getState().resizeComponent(component.id, { width: Number(width), height: Number(height) })) { setError(useDiagramStore.getState().error ?? 'Provide positive finite width and height. Supporting participants must stay outside the boundary.'); return; }
    setError('');
  };
  return <form className="inspector-form component-geometry-form" onSubmit={submit} noValidate aria-label="Component size">
    <p className="inspector-copy">Use arrow keys on the selected canvas node to move it.</p>
    <label htmlFor="component-width">Width</label><input id="component-width" type="number" min="1" step="any" value={width} onChange={event => setWidth(event.target.value)} aria-invalid={Boolean(error)} />
    <label htmlFor="component-height">Height</label><input id="component-height" type="number" min="1" step="any" value={height} onChange={event => setHeight(event.target.value)} aria-invalid={Boolean(error)} />
    {error && <p className="artifact-edit-error" role="alert">{error}</p>}<button type="submit" className="secondary-action">Apply size</button>
  </form>;
}
