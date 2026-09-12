import { useEffect, useState, type FormEvent } from 'react';
import { useDiagramStore } from '../state/diagram-store';
import { RecoveryControls } from './RecoveryControls';
import type { InspectorMode } from './DiagramToolbar';
import { AdrList } from './AdrList';
import { AdrEditor } from './AdrEditor';
import { ComponentAdrSummary } from './ComponentAdrSummary';
import { RelationshipAdrSummary } from './RelationshipAdrSummary';
import { ConfirmDialog } from './ConfirmDialog';
import { c4ArtifactTypes, getC4ArtifactTypeDescription, getC4ArtifactTypeLabel, isC4ArtifactType, type C4ArtifactType } from '../../../shared/src/index';

export type CanvasSelection = { kind: 'component' | 'relationship' | 'group'; id: string } | { kind: 'components'; ids: string[] } | null;

export function WorkspaceInspector({ mode, selection, selectedComponentIds = [], onClose, onSelectComponent, onSelectRelationship, onOpenAdr }: { mode: InspectorMode; selection: CanvasSelection; selectedComponentIds?: string[]; onClose: () => void; onSelectComponent?: (componentId: string) => void; onSelectRelationship?: (relationshipId: string) => void; onOpenAdr?: (adrId: string) => void }) {
  const [name, setName] = useState('');
  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');
  const [label, setLabel] = useState('');
  const [direction, setDirection] = useState<'directed' | 'undirected'>('directed');
  const [componentType, setComponentType] = useState<C4ArtifactType>('software-system');
  const [componentError, setComponentError] = useState('');
  const [componentEditName, setComponentEditName] = useState('');
  const [componentEditType, setComponentEditType] = useState<C4ArtifactType>('software-system');
  const [componentEditError, setComponentEditError] = useState('');
  const [relationshipEditLabel, setRelationshipEditLabel] = useState('');
  const [relationshipEditSource, setRelationshipEditSource] = useState('');
  const [relationshipEditTarget, setRelationshipEditTarget] = useState('');
  const [relationshipEditDirection, setRelationshipEditDirection] = useState<'directed' | 'undirected'>('directed');
  const [relationshipEditError, setRelationshipEditError] = useState('');
  const [groupName, setGroupName] = useState('');
  const [confirmUngroup, setConfirmUngroup] = useState(false);
  const [groupNotice, setGroupNotice] = useState('');

  const document = useDiagramStore(state => state.document);
  const create = useDiagramStore(state => state.create);
  const addComponent = useDiagramStore(state => state.addComponent);
  const addRelationship = useDiagramStore(state => state.addRelationship);
  const renameComponent = useDiagramStore(state => state.renameComponent);
  const updateComponentType = useDiagramStore(state => state.updateComponentType);
  const updateRelationship = useDiagramStore(state => state.updateRelationship);
  const reverseRelationship = useDiagramStore(state => state.reverseRelationship);
  const createGroup = useDiagramStore(state => state.createGroup);
  const renameGroup = useDiagramStore(state => state.renameGroup);
  const removeGroupMember = useDiagramStore(state => state.removeGroupMember);
  const ungroup = useDiagramStore(state => state.ungroup);
  const groupError = useDiagramStore(state => state.groupError);

  useEffect(() => {
    if (!document || !selection) return;
    if (selection.kind === 'component') {
      const component = document.components.find(item => item.id === selection.id);
      if (component) {
        setComponentEditName(component.name);
        setComponentEditType(isC4ArtifactType(component.type) ? component.type : 'software-system');
        setComponentEditError('');
      }
    } else if (selection.kind === 'relationship') {
      const relationship = document.relationships.find(item => item.id === selection.id);
      if (relationship) {
        setRelationshipEditLabel(relationship.label ?? '');
        setRelationshipEditSource(relationship.sourceComponentId);
        setRelationshipEditTarget(relationship.targetComponentId);
        setRelationshipEditDirection(relationship.direction);
        setRelationshipEditError('');
      }
    } else if (selection.kind === 'group') {
      const group = document.groups.find(item => item.id === selection.id);
      if (group) {
        setGroupName(group.name);
        setGroupNotice('');
      }
    }
  }, [selection?.kind, selection?.id]);

  const createDiagram = (event: FormEvent) => {
    event.preventDefault();
    void create(name);
    setName('');
  };

  if (!document) return <aside className="workspace-inspector" aria-label="Diagram inspector"><div className="inspector-header"><div><span className="eyebrow">Start here</span><h2>Create a diagram</h2></div></div><form className="inspector-form" onSubmit={createDiagram}><label htmlFor="diagram-name">Diagram name</label><input id="diagram-name" value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Payments platform" autoComplete="off" autoFocus /><button className="primary-pill" type="submit" disabled={!name.trim()}>Create diagram</button></form></aside>;

  const add = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setComponentError('Component name is required.');
      return;
    }
    if (!addComponent(name, componentType)) {
      setComponentError('Choose Person or Software System before adding the component.');
      return;
    }
    setName('');
    setComponentError('');
    onClose();
  };

  const connect = (event: FormEvent) => {
    event.preventDefault();
    addRelationship(source, target, label, direction);
    setLabel('');
    onClose();
  };

  const selectedComponent = selection?.kind === 'component'
    ? document.components.find(component => component.id === selection.id)
    : undefined;
  const selectedRelationship = selection?.kind === 'relationship'
    ? document.relationships.find(relationship => relationship.id === selection.id)
    : undefined;
  const selectedGroup = selection?.kind === 'group'
    ? document.groups.find(group => group.id === selection.id)
    : undefined;
  const selectedGroupMembers = selectedGroup?.memberComponentIds
    .map(componentId => document.components.find(component => component.id === componentId))
    .filter((component): component is NonNullable<typeof component> => Boolean(component)) ?? [];
  const selectedComponents = selectedComponentIds
    .map(componentId => document.components.find(component => component.id === componentId))
    .filter((component): component is NonNullable<typeof component> => Boolean(component));
  const groupSelectionError = selectedComponentIds.length < 2
    ? 'Select at least two Software System components.'
    : selectedComponents.some(component => component.type !== 'software-system')
      ? 'Only Software System components can be grouped.'
      : selectedComponents.some(component => document.groups.some(group => group.memberComponentIds.includes(component.id)))
        ? 'A selected Software System already belongs to a group.'
        : '';

  const saveComponentEdit = (event: FormEvent) => {
    event.preventDefault();
    if (!componentEditName.trim()) {
      setComponentEditError('Component name is required.');
      return;
    }
    if (!selectedComponent || !updateComponentType(selectedComponent.id, componentEditType)) {
      setComponentEditError('A grouped component must remain a Software System. Remove it from its group before changing its type.');
      return;
    }
    if (!renameComponent(selectedComponent.id, componentEditName)) {
      setComponentEditError('Could not update this component.');
      return;
    }
    setComponentEditError('');
  };

  const reverseSelectedRelationship = () => {
    if (!selectedRelationship || !reverseRelationship(selectedRelationship.id)) return;
    setRelationshipEditSource(selectedRelationship.targetComponentId);
    setRelationshipEditTarget(selectedRelationship.sourceComponentId);
  };

  const saveRelationshipEdit = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedRelationship || !updateRelationship(selectedRelationship.id, {
      sourceComponentId: relationshipEditSource,
      targetComponentId: relationshipEditTarget,
      direction: relationshipEditDirection,
      label: relationshipEditLabel,
    })) {
      setRelationshipEditError('Choose two different components.');
      return;
    }
    setRelationshipEditError('');
  };

  const createSelectedGroup = (event: FormEvent) => {
    event.preventDefault();
    if (!createGroup(groupName, selectedComponentIds)) {
      setGroupNotice(groupError ?? 'Choose at least two Software System components and a unique group name.');
      return;
    }
    setGroupName('');
    setGroupNotice('Group created around the selected systems without changing their positions.');
    onClose();
  };

  const saveGroupName = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedGroup || !renameGroup(selectedGroup.id, groupName)) {
      setGroupNotice(groupError ?? 'Group names must be unique and non-blank.');
      return;
    }
    setGroupNotice('Group renamed.');
  };

  const removeMember = (componentId: string) => {
    if (!selectedGroup || !removeGroupMember(selectedGroup.id, componentId)) {
      setGroupNotice(groupError ?? 'The member could not be removed from this group.');
      return;
    }
    setGroupNotice('Member removed from group. Its position and references were preserved.');
  };

  const confirmGroupRemoval = () => {
    if (!selectedGroup || !ungroup(selectedGroup.id)) {
      setGroupNotice(groupError ?? 'The group could not be ungrouped.');
      return;
    }
    setConfirmUngroup(false);
    setGroupNotice('Group removed. Components, relationships, and ADR links were preserved.');
    onClose();
  };

  const heading = mode === 'component' ? 'Add component' : mode === 'relationship' ? 'Connect components' : mode === 'group' ? 'Group selected systems' : mode === 'adr' ? 'Decisions' : 'Details';
  const inspectorClassName = `workspace-inspector${mode === 'adr' ? ' workspace-inspector-adr' : ''}`;
  const c4TypeFieldset = (value: C4ArtifactType, onChange: (type: C4ArtifactType) => void, legend: string) => <fieldset className="c4-type-fieldset"><legend>{legend}</legend>{(Object.keys(c4ArtifactTypes) as C4ArtifactType[]).map(type => <label className="c4-type-option" key={type}><input type="radio" name={legend.toLowerCase().replaceAll(' ', '-')} value={type} checked={value === type} onChange={() => onChange(type)} /><span><strong>{getC4ArtifactTypeLabel(type)}</strong><small>{getC4ArtifactTypeDescription(type)}</small></span></label>)}</fieldset>;
  return <aside className={inspectorClassName} aria-label={mode === 'adr' ? 'ADR workspace' : 'Diagram inspector'}><div className="inspector-header"><div><span className="eyebrow">Inspector</span><h2>{heading}</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close inspector">×</button></div>
    {mode === 'adr' && <div className="adr-workspace-body" aria-live="polite"><AdrList diagramId={document.id} /><AdrEditor components={document.components} relationships={document.relationships} onSelectComponent={onSelectComponent} onSelectRelationship={onSelectRelationship} onOpenAdr={onOpenAdr} /></div>}
    {mode === null && selectedComponent && <section className="artifact-edit-panel" aria-label="Edit component"><span className="eyebrow">Component</span><h3>Edit component</h3><form className="inspector-form artifact-edit-form" onSubmit={saveComponentEdit}><label htmlFor="component-edit-name">Component name</label><input id="component-edit-name" value={componentEditName} onChange={event => { setComponentEditName(event.target.value); setComponentEditError(''); }} autoComplete="off" aria-invalid={Boolean(componentEditError)} />{c4TypeFieldset(componentEditType, type => { setComponentEditType(type); setComponentEditError(''); }, 'C4 artifact type')}{!isC4ArtifactType(selectedComponent.type) && <p className="inspector-meta">Legacy type: Unclassified. Choose a C4 type to classify this component.</p>}{componentEditError && <p className="artifact-edit-error" role="alert">{componentEditError}</p>}<button className="primary-pill" type="submit">Save component</button></form></section>}
    {mode === null && selectedGroup && <section className="artifact-edit-panel system-group-details" aria-label="System group details"><span className="eyebrow">System group</span><h3>Group details</h3><p className="inspector-copy">This boundary contains Software System members. Moving it preserves each member's relative position.</p><form className="inspector-form artifact-edit-form" onSubmit={saveGroupName}><label htmlFor="group-edit-name">Group name</label><input id="group-edit-name" value={groupName} onChange={event => { setGroupName(event.target.value); setGroupNotice(''); }} autoComplete="off" aria-invalid={Boolean(groupError)} />{groupError && <p className="artifact-edit-error" role="alert">{groupError}</p>}<button className="primary-pill" type="submit">Rename group</button></form><h4>Members</h4><ul className="system-group-members" aria-label={`${selectedGroup.name} members`}>{selectedGroupMembers.map(component => <li key={component.id}><span><strong>{component.name}</strong><small>{getC4ArtifactTypeLabel(component.type)}</small></span><button className="secondary-action" type="button" onClick={() => removeMember(component.id)}>Remove from group</button></li>)}</ul><output className="group-feedback" aria-live="polite">{groupNotice}</output><button className="danger-action" type="button" onClick={() => setConfirmUngroup(true)}>Ungroup</button>{confirmUngroup && <ConfirmDialog title="Ungroup this boundary?" message="The group and its membership will be removed. Components, relationships, ADR links, and positions will be preserved." confirmLabel="Ungroup" onConfirm={confirmGroupRemoval} onCancel={() => setConfirmUngroup(false)} />}</section>}
    {mode === null && selectedRelationship && <section className="artifact-edit-panel" aria-label="Edit relationship"><span className="eyebrow">Relationship</span><h3>Edit relationship</h3><form className="inspector-form artifact-edit-form" onSubmit={saveRelationshipEdit}><label htmlFor="relationship-edit-source">Relationship source</label><select id="relationship-edit-source" value={relationshipEditSource} onChange={event => setRelationshipEditSource(event.target.value)}>{document.components.map(component => <option key={component.id} value={component.id}>{component.name}</option>)}</select><label htmlFor="relationship-edit-target">Relationship target</label><select id="relationship-edit-target" value={relationshipEditTarget} onChange={event => setRelationshipEditTarget(event.target.value)}>{document.components.map(component => <option key={component.id} value={component.id}>{component.name}</option>)}</select><label htmlFor="relationship-edit-label">Relationship label</label><input id="relationship-edit-label" value={relationshipEditLabel} onChange={event => setRelationshipEditLabel(event.target.value)} autoComplete="off" /><label htmlFor="relationship-edit-direction">Relationship direction</label><select id="relationship-edit-direction" value={relationshipEditDirection} onChange={event => setRelationshipEditDirection(event.target.value as 'directed' | 'undirected')}><option value="directed">Directed</option><option value="undirected">Undirected</option></select>{relationshipEditError && <p className="artifact-edit-error" role="alert">{relationshipEditError}</p>}<div className="artifact-edit-actions"><button type="button" onClick={reverseSelectedRelationship}>Reverse direction</button><button className="primary-pill" type="submit">Save relationship</button></div></form></section>}
    {mode === null && selection?.kind === 'component' && <ComponentAdrSummary diagramId={document.id} componentId={selection.id} onOpenAdr={onOpenAdr ?? (() => undefined)} />}
    {mode === null && selection?.kind === 'relationship' && selectedRelationship && <RelationshipAdrSummary diagramId={document.id} relationship={selectedRelationship} componentNames={new Map(document.components.map(component => [component.id, component.name]))} onOpenAdr={onOpenAdr ?? (() => undefined)} />}
    {mode === 'component' && <form className="inspector-form" onSubmit={add}><label htmlFor="component-name">Component name</label><input id="component-name" value={name} onChange={event => { setName(event.target.value); setComponentError(''); }} placeholder="e.g. API gateway" autoComplete="off" autoFocus />{c4TypeFieldset(componentType, type => { setComponentType(type); setComponentError(''); }, 'C4 artifact type')}{componentError && <p className="artifact-edit-error" role="alert">{componentError}</p>}<div className="artifact-edit-actions"><button className="primary-pill" type="submit" disabled={!name.trim()}>Add component</button><button type="button" onClick={onClose}>Cancel</button></div></form>}
    {mode === 'group' && <form className="inspector-form group-create-form" onSubmit={createSelectedGroup}><p className="inspector-copy">Create a labeled boundary around the selected Software Systems. Existing positions will be preserved.</p><label htmlFor="group-name">Group name</label><input id="group-name" value={groupName} onChange={event => { setGroupName(event.target.value); setGroupNotice(''); }} placeholder="e.g. Payments platform" autoComplete="off" autoFocus aria-invalid={Boolean(groupError || groupSelectionError)} /><h4>Selected systems</h4><ul className="system-group-members" aria-label="Selected systems">{selectedComponents.map(component => <li key={component.id}><span><strong>{component.name}</strong><small>{getC4ArtifactTypeLabel(component.type)}</small></span></li>)}</ul>{(groupSelectionError || groupError || groupNotice) && <p className={groupError ? 'artifact-edit-error' : 'group-feedback'} role={groupError ? 'alert' : 'status'} aria-live="polite">{groupError || groupSelectionError || groupNotice}</p>}<div className="artifact-edit-actions"><button className="primary-pill" type="submit" disabled={!groupName.trim() || Boolean(groupSelectionError)}>Group selected systems</button><button type="button" onClick={onClose}>Cancel</button></div></form>}
    {mode === 'relationship' && <form className="inspector-form" onSubmit={connect}><label htmlFor="relationship-source">From</label><select id="relationship-source" value={source} onChange={event => setSource(event.target.value)}><option value="">Choose a component…</option>{document.components.map(component => <option key={component.id} value={component.id}>{component.name}</option>)}</select><label htmlFor="relationship-target">To</label><select id="relationship-target" value={target} onChange={event => setTarget(event.target.value)}><option value="">Choose a component…</option>{document.components.map(component => <option key={component.id} value={component.id}>{component.name}</option>)}</select><label htmlFor="relationship-label">Label <span>optional</span></label><input id="relationship-label" value={label} onChange={event => setLabel(event.target.value)} placeholder="e.g. sends events" autoComplete="off" /><label htmlFor="relationship-direction">Direction</label><select id="relationship-direction" value={direction} onChange={event => setDirection(event.target.value as 'directed' | 'undirected')}><option value="directed">Directed</option><option value="undirected">Undirected</option></select><button className="primary-pill" type="submit" disabled={!source || !target || source === target}>Connect components</button></form>}
    {mode === null && !selectedGroup && <RecoveryControls selection={selection?.kind === 'component' || selection?.kind === 'relationship' ? selection : null} />}
  </aside>;
}
