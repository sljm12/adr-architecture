import { useEffect, useState, type FormEvent } from 'react';
import { describeGroupMemberAddError, describeGroupSelection, useDiagramStore } from '../state/diagram-store';
import { RecoveryControls } from './RecoveryControls';
import type { InspectorMode } from './DiagramToolbar';
import { AdrList } from './AdrList';
import { AdrEditor } from './AdrEditor';
import { ComponentAdrSummary } from './ComponentAdrSummary';
import { RelationshipAdrSummary } from './RelationshipAdrSummary';
import { ConfirmDialog } from './ConfirmDialog';
import { assertCanAddGroupMember, c4ArtifactTypes, getC4ArtifactTypeDescription, getC4ArtifactTypeLabel, isC4ArtifactType, type C4ArtifactType } from '../../../shared/src/index';
import type { ContainerAvailability } from '../../../shared/src/index';
import { diagramClient } from '../api/diagram-client';
import { ContainerComponentForm } from './ContainerComponentForm';
import { ExternalParticipantPicker } from './ExternalParticipantPicker';

export type CanvasSelection = { kind: 'component' | 'relationship' | 'group'; id: string } | { kind: 'components'; ids: string[] } | { kind: 'group-member-candidate'; groupId: string; componentId: string } | null;

export function WorkspaceInspector({ mode, selection, selectedComponentIds = [], onClose, onSelectComponent, onSelectRelationship, onOpenAdr, onSelectGroup, onOpenContainerDiagram, interactionDraft }: { mode: InspectorMode; selection: CanvasSelection; selectedComponentIds?: string[]; onClose: () => void; onSelectComponent?: (componentId: string) => void; onSelectRelationship?: (relationshipId: string) => void; onOpenAdr?: (adrId: string) => void; onSelectGroup?: (groupId: string) => void; onOpenContainerDiagram?: (componentId: string) => void; interactionDraft?:{source:string;target:string}|null }) {
  const [name, setName] = useState('');
  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');
  const [label, setLabel] = useState('');
  const [protocol, setProtocol] = useState('');
  const [relationshipError, setRelationshipError] = useState('');
  const [relationshipEditProtocol, setRelationshipEditProtocol] = useState('');
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
  const [lastAddedGroupId, setLastAddedGroupId] = useState<string | null>(null);

  const document = useDiagramStore(state => state.document);
  const create = useDiagramStore(state => state.create);
  const addComponent = useDiagramStore(state => state.addComponent);
  const addRelationship = useDiagramStore(state => state.addRelationship);
  const renameComponent = useDiagramStore(state => state.renameComponent);
  const updateComponentType = useDiagramStore(state => state.updateComponentType);
  const updateRelationship = useDiagramStore(state => state.updateRelationship);
  const reverseRelationship = useDiagramStore(state => state.reverseRelationship);
  const createGroup = useDiagramStore(state => state.createGroup);
  const addGroupMember = useDiagramStore(state => state.addGroupMember);
  const clearGroupError = useDiagramStore(state => state.clearGroupError);
  const renameGroup = useDiagramStore(state => state.renameGroup);
  const removeGroupMember = useDiagramStore(state => state.removeGroupMember);
  const ungroup = useDiagramStore(state => state.ungroup);
  const groupError = useDiagramStore(state => state.groupError);
  const diagramStatus = useDiagramStore(state => state.status);
  const containerOpenStatus = useDiagramStore(state => state.containerOpenStatus);
  const containerOpenError = useDiagramStore(state => state.containerOpenError);
  const [containerAvailability, setContainerAvailability] = useState<ContainerAvailability | null>(null);
  const [containerAvailabilityStatus, setContainerAvailabilityStatus] = useState<'idle' | 'loading' | 'loaded' | 'failed'>('idle');
  const [containerAvailabilityError, setContainerAvailabilityError] = useState<string | null>(null);
  const [availabilityRetry, setAvailabilityRetry] = useState(0);
  const selectedContainerTarget = document && selection?.kind === 'component' ? document.components.find(component => component.id === selection.id) : undefined;
  const eligibleContainerTarget = Boolean(selectedContainerTarget && selectedContainerTarget.type === 'software-system' && (document?.kind === 'container' ? selectedContainerTarget.role === 'external' : (selectedContainerTarget.role ?? 'element') === 'element'));
  useEffect(()=>{setName('');setComponentType('software-system');setComponentError('');setComponentEditError('');setSource('');setTarget('');setLabel('');setProtocol('');setDirection('directed');setRelationshipError('');},[document?.id,document?.kind,selectedContainerTarget?.role,mode]);
  useEffect(()=>{if(mode==='relationship'&&interactionDraft){setSource(interactionDraft.source);setTarget(interactionDraft.target);}},[interactionDraft,mode]);

  useEffect(() => {
    if (!document || !selectedContainerTarget || !eligibleContainerTarget || diagramStatus !== 'saved') {
      setContainerAvailability(null); setContainerAvailabilityStatus('idle'); setContainerAvailabilityError(null);
      return;
    }
    let current = true;
    setContainerAvailability(null); setContainerAvailabilityStatus('loading'); setContainerAvailabilityError(null);
    diagramClient.containerAvailability(document.id, selectedContainerTarget.id).then(value => {
      if (current) { setContainerAvailability(value); setContainerAvailabilityStatus('loaded'); }
    }).catch(error => {
      if (current) { setContainerAvailability(null); setContainerAvailabilityStatus('failed'); setContainerAvailabilityError(error instanceof Error ? error.message : 'Availability could not be checked.'); }
    });
    return () => { current = false; };
  }, [document?.id, document?.kind, selectedContainerTarget?.id, selectedContainerTarget?.type, selectedContainerTarget?.role, diagramStatus, eligibleContainerTarget, availabilityRetry]);

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
        setRelationshipEditProtocol(relationship.protocol ?? '');
        setRelationshipEditError('');
      }
    } else if (selection.kind === 'group' || selection.kind === 'group-member-candidate') {
      const groupId = selection.kind === 'group' ? selection.id : selection.groupId;
      const group = document.groups.find(item => item.id === groupId);
      if (group) {
        setGroupName(group.name);
        if (selection.kind === 'group' && lastAddedGroupId === group.id) return;
        setGroupNotice('');
      }
    }
  }, [document?.id,document?.kind,selectedContainerTarget?.role,selection?.kind, selection && ('id' in selection ? selection.id : selection.kind === 'group-member-candidate' ? `${selection.groupId}:${selection.componentId}` : selection.ids.join(',')), lastAddedGroupId]);

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
    if (!addRelationship(source, target, label, direction, document.kind === 'container' ? protocol : null)) { setRelationshipError(useDiagramStore.getState().error ?? 'Choose two different components.'); return; }
    setLabel('');
    onClose();
  };

  const selectedComponent = selection?.kind === 'component'
    ? document.components.find(component => component.id === selection.id)
    : undefined;
  const canOpenContainerDiagram = Boolean(selectedComponent && selectedComponent.type === 'software-system' && (
    document.kind === 'container'
      ? selectedComponent.role === 'external'
      : (selectedComponent.role ?? 'element') === 'element'
  ));
  const requestContainerOpen = (componentId: string) => {
    if (onOpenContainerDiagram) onOpenContainerDiagram(componentId);
    else window.dispatchEvent(new CustomEvent('adr:open-container-diagram', { detail: { componentId } }));
  };
  const selectedRelationship = selection?.kind === 'relationship'
    ? document.relationships.find(relationship => relationship.id === selection.id)
    : undefined;
  const selectedGroup = selection?.kind === 'group'
    ? document.groups.find(group => group.id === selection.id)
    : selection?.kind === 'group-member-candidate'
      ? document.groups.find(group => group.id === selection.groupId)
    : undefined;
  const candidateComponent = selection?.kind === 'group-member-candidate'
    ? document.components.find(component => component.id === selection.componentId)
    : undefined;
  const candidateReason = selection?.kind === 'group-member-candidate' && selectedGroup
    ? assertCanAddGroupMember(document, selectedGroup.id, selection.componentId)
    : null;
  const candidateError = candidateReason ? describeGroupMemberAddError(document, candidateReason) : null;
  const selectedGroupMembers = selectedGroup?.memberComponentIds
    .map(componentId => document.components.find(component => component.id === componentId))
    .filter((component): component is NonNullable<typeof component> => Boolean(component)) ?? [];
  const selectedComponents = selectedComponentIds
    .map(componentId => document.components.find(component => component.id === componentId))
    .filter((component): component is NonNullable<typeof component> => Boolean(component));
  const groupSelectionError = describeGroupSelection(document, selectedComponentIds) ?? '';

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
      protocol: document.kind === 'container' ? relationshipEditProtocol : selectedRelationship.protocol,
    })) {
      setRelationshipEditError(useDiagramStore.getState().error ?? 'Choose two different components.');
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

  const addSelectedGroupMember = () => {
    if (candidateError) {
      setGroupNotice(candidateError);
      return;
    }
    if (!selectedGroup || !candidateComponent || !addGroupMember(selectedGroup.id, candidateComponent.id)) {
      setGroupNotice(useDiagramStore.getState().groupError ?? 'The selected component could not be added to this group.');
      return;
    }
    setLastAddedGroupId(selectedGroup.id);
    setGroupNotice(`${candidateComponent.name} was added to ${selectedGroup.name}. The boundary was fitted without changing the component.`);
    onSelectGroup?.(selectedGroup.id);
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

  const heading = mode === 'external' ? 'Include external participant' : mode === 'component' ? 'Add component' : mode === 'relationship' ? 'Connect components' : mode === 'group' ? 'Group selected systems' : mode === 'adr' ? 'Decisions' : 'Details';
  const inspectorClassName = `workspace-inspector${mode === 'adr' ? ' workspace-inspector-adr' : ''}`;
  const c4TypeFieldset = (value: C4ArtifactType, onChange: (type: C4ArtifactType) => void, legend: string) => <fieldset className="c4-type-fieldset"><legend>{legend}</legend>{(Object.keys(c4ArtifactTypes) as C4ArtifactType[]).map(type => <label className="c4-type-option" key={type}><input type="radio" name={legend.toLowerCase().replaceAll(' ', '-')} value={type} checked={value === type} onChange={() => onChange(type)} /><span><strong>{getC4ArtifactTypeLabel(type)}</strong><small>{getC4ArtifactTypeDescription(type)}</small></span></label>)}</fieldset>;
  return <aside className={inspectorClassName} aria-label={mode === 'adr' ? 'ADR workspace' : 'Diagram inspector'}><div className="inspector-header"><div><span className="eyebrow">Inspector</span><h2>{heading}</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close inspector">×</button></div>
    {mode === 'adr' && <div className="adr-workspace-body" aria-live="polite"><AdrList diagramId={document.id} /><AdrEditor components={document.components} relationships={document.relationships} onSelectComponent={onSelectComponent} onSelectRelationship={onSelectRelationship} onOpenAdr={onOpenAdr} /></div>}
    {mode === null && selectedComponent && document.kind !== 'container' && <section className="artifact-edit-panel" aria-label="Edit component"><span className="eyebrow">Component</span><h3>Edit component</h3><form className="inspector-form artifact-edit-form" onSubmit={saveComponentEdit}><label htmlFor="component-edit-name">Component name</label><input id="component-edit-name" value={componentEditName} onChange={event => { setComponentEditName(event.target.value); setComponentEditError(''); }} autoComplete="off" aria-invalid={Boolean(componentEditError)} />{c4TypeFieldset(componentEditType, type => { setComponentEditType(type); setComponentEditError(''); }, 'C4 artifact type')}{!isC4ArtifactType(selectedComponent.type) && <p className="inspector-meta">Legacy type: Unclassified. Choose a C4 type to classify this component.</p>}{componentEditError && <p className="artifact-edit-error" role="alert">{componentEditError}</p>}<button className="primary-pill" type="submit">Save component</button></form></section>}
    {mode === null && selectedComponent && canOpenContainerDiagram && <section className="artifact-edit-panel container-entry-panel" aria-label="Container diagram action"><span className="eyebrow">Software System</span><h3>{selectedComponent.name}</h3><button className="primary-pill" type="button" aria-label={`Create or open container diagram for ${selectedComponent.name}`} onClick={() => requestContainerOpen(selectedComponent.id)} disabled={containerOpenStatus === 'loading' || containerAvailabilityStatus === 'loading' || containerAvailability?.availability === 'trashed'}>{containerAvailabilityStatus === 'loading' ? 'Checking container diagram…' : containerAvailability?.availability === 'active' ? 'Open container diagram' : containerAvailability?.availability === 'trashed' ? 'Container diagram in Trash' : 'Create container diagram'}</button>{containerAvailability?.availability === 'trashed' && <p className="container-entry-feedback" role="status">This Software System already has a container diagram in Trash. Restore “{containerAvailability.diagram?.name ?? selectedComponent.name}” from Recovery; no replacement will be created.</p>}{containerAvailabilityStatus === 'failed' && <p className="container-entry-feedback" role="status">Container availability could not be checked. <button type="button" className="text-action" onClick={() => setAvailabilityRetry(retry => retry + 1)}>Retry</button>{containerAvailabilityError ? ` ${containerAvailabilityError}` : ''}</p>}{containerOpenStatus === 'loading' && <p className="container-entry-feedback" role="status" aria-live="polite">Opening the canonical container diagram…</p>}{containerOpenStatus === 'failed' && <p className="container-entry-feedback" role="status" aria-live="polite">{containerOpenError ?? 'The container diagram could not be opened.'} <button type="button" className="text-action" onClick={() => requestContainerOpen(selectedComponent.id)}>Retry</button></p>}</section>}
    {mode === null && selection?.kind === 'component' && !selectedComponent && containerOpenStatus === 'failed' && <p className="container-entry-feedback" role="status" aria-live="polite">{containerOpenError}</p>}
    {mode === 'component' && document.kind === 'container' && <ContainerComponentForm key={`${document.id}:add`} onClose={onClose}/>}
    {mode === 'external' && document.kind === 'container' && <ExternalParticipantPicker key={document.id} document={document} onClose={onClose}/>}
    {mode === null && selectedComponent?.role === 'container' && <section className="artifact-edit-panel" aria-label="Edit component"><h3>Edit component</h3><ContainerComponentForm key={`${document.id}:${selectedComponent.id}:${selectedComponent.role}`} component={selectedComponent} onClose={onClose}/></section>}
    {mode === null && selectedComponent?.role === 'external' && <section className="artifact-edit-panel" aria-label="External participant details"><h3>{selectedComponent.name}</h3><p>{getC4ArtifactTypeLabel(selectedComponent.type)}</p><p className="component-responsibility">{selectedComponent.description}</p><p>Source details are read-only. Edit them in {document.scope?.parentDiagramName}.</p><p className="inspector-meta">Source: {selectedComponent.sourceComponentId}</p><button type="button" className="text-action" onClick={()=>window.dispatchEvent(new CustomEvent('adr:open-source-parent',{detail:{diagramId:document.scope?.parentDiagramId,componentId:selectedComponent.sourceComponentId}}))}>Edit source in parent</button></section>}
    {mode === null && selectedGroup && <section className="artifact-edit-panel system-group-details" aria-label="System group details"><span className="eyebrow">System group</span><h3>Group details</h3><p className="inspector-copy">This boundary contains Software System members. Moving it preserves each member's relative position.</p>{selection?.kind === 'group-member-candidate' && <div className="group-member-candidate" aria-label="Add component to group candidate"><strong>Candidate component</strong><span>{candidateComponent?.name ?? 'Selected component is no longer available'}</span><small>{candidateComponent ? `${getC4ArtifactTypeLabel(candidateComponent.type)} · Shift-selected for review` : 'The candidate could not be found in this diagram.'}</small>{candidateError && <p id="group-member-candidate-error" className="artifact-edit-error" role="alert" aria-live="assertive">{candidateError}</p>}<div className="artifact-edit-actions"><button className="primary-pill" type="button" onClick={addSelectedGroupMember} disabled={Boolean(candidateError)} aria-describedby={candidateError ? 'group-member-candidate-error' : undefined} aria-label={`Add ${candidateComponent?.name ?? 'component'} to ${selectedGroup.name}`}>Add component to group</button><button type="button" onClick={() => { clearGroupError(); onSelectGroup?.(selectedGroup.id); }}>Cancel</button></div></div>}<form className="inspector-form artifact-edit-form" onSubmit={saveGroupName}><label htmlFor="group-edit-name">Group name</label><input id="group-edit-name" value={groupName} onChange={event => { setGroupName(event.target.value); setGroupNotice(''); clearGroupError(); }} autoComplete="off" aria-invalid={Boolean(groupError)} />{groupError && !candidateError && <p className="artifact-edit-error" role="alert" aria-live="assertive">{groupError}</p>}<button className="primary-pill" type="submit">Rename group</button></form><h4>Members</h4><ul className="system-group-members" aria-label={`${selectedGroup.name} members`}>{selectedGroupMembers.map(component => <li key={component.id}><span><strong>{component.name}</strong><small>{getC4ArtifactTypeLabel(component.type)}</small></span><button className="secondary-action" type="button" onClick={() => removeMember(component.id)}>Remove from group</button></li>)}</ul><output className="group-feedback" aria-live="polite">{groupNotice}</output><button className="danger-action" type="button" onClick={() => setConfirmUngroup(true)}>Ungroup</button>{confirmUngroup && <ConfirmDialog title="Ungroup this boundary?" message="The group and its membership will be removed. Components, relationships, ADR links, and positions will be preserved." confirmLabel="Ungroup" onConfirm={confirmGroupRemoval} onCancel={() => setConfirmUngroup(false)} />}</section>}
    {mode === null && selectedRelationship && <section className="artifact-edit-panel" aria-label="Edit relationship"><span className="eyebrow">Relationship</span><h3>Edit relationship</h3><form className="inspector-form artifact-edit-form" onSubmit={saveRelationshipEdit}><label htmlFor="relationship-edit-source">Relationship source</label><select id="relationship-edit-source" value={relationshipEditSource} onChange={event => setRelationshipEditSource(event.target.value)}>{document.components.map(component => <option key={component.id} value={component.id}>{component.name}</option>)}</select><label htmlFor="relationship-edit-target">Relationship target</label><select id="relationship-edit-target" value={relationshipEditTarget} onChange={event => setRelationshipEditTarget(event.target.value)}>{document.components.map(component => <option key={component.id} value={component.id}>{component.name}</option>)}</select><label htmlFor="relationship-edit-label">Relationship label</label><input id="relationship-edit-label" value={relationshipEditLabel} onChange={event => setRelationshipEditLabel(event.target.value)} autoComplete="off" />{document.kind === 'container' && <><label htmlFor="relationship-edit-protocol">Protocol</label><input id="relationship-edit-protocol" value={relationshipEditProtocol} onChange={event => setRelationshipEditProtocol(event.target.value)} maxLength={200}/></>}<label htmlFor="relationship-edit-direction">Relationship direction</label><select id="relationship-edit-direction" value={relationshipEditDirection} onChange={event => setRelationshipEditDirection(event.target.value as 'directed' | 'undirected')}><option value="directed">Directed</option>{document.kind !== 'container' && <option value="undirected">Undirected</option>}</select>{relationshipEditError && <p className="artifact-edit-error" role="alert">{relationshipEditError}</p>}<div className="artifact-edit-actions"><button type="button" onClick={reverseSelectedRelationship}>Reverse direction</button><button className="primary-pill" type="submit">Save relationship</button></div></form></section>}
    {mode === null && selection?.kind === 'component' && <ComponentAdrSummary diagramId={document.id} componentId={selection.id} onOpenAdr={onOpenAdr ?? (() => undefined)} />}
    {mode === null && selection?.kind === 'relationship' && selectedRelationship && <RelationshipAdrSummary diagramId={document.id} relationship={selectedRelationship} componentNames={new Map(document.components.map(component => [component.id, component.name]))} onOpenAdr={onOpenAdr ?? (() => undefined)} />}
    {mode === 'component' && document.kind !== 'container' && <form className="inspector-form" onSubmit={add}><label htmlFor="component-name">Component name</label><input id="component-name" value={name} onChange={event => { setName(event.target.value); setComponentError(''); }} placeholder="e.g. API gateway" autoComplete="off" autoFocus />{c4TypeFieldset(componentType, type => { setComponentType(type); setComponentError(''); }, 'C4 artifact type')}{componentError && <p className="artifact-edit-error" role="alert">{componentError}</p>}<div className="artifact-edit-actions"><button className="primary-pill" type="submit" disabled={!name.trim()}>Add component</button><button type="button" onClick={onClose}>Cancel</button></div></form>}
    {mode === 'group' && document.kind !== 'container' && <form className="inspector-form group-create-form" onSubmit={createSelectedGroup}><p className="inspector-copy">Create a labeled boundary around the selected Software Systems. Existing positions will be preserved.</p><label htmlFor="group-name">Group name</label><input id="group-name" value={groupName} onChange={event => { setGroupName(event.target.value); setGroupNotice(''); }} placeholder="e.g. Payments platform" autoComplete="off" autoFocus aria-invalid={Boolean(groupError || groupSelectionError)} /><h4>Selected systems</h4><ul className="system-group-members" aria-label="Selected systems">{selectedComponents.map(component => <li key={component.id}><span><strong>{component.name}</strong><small>{getC4ArtifactTypeLabel(component.type)}</small></span></li>)}</ul>{(groupSelectionError || groupError || groupNotice) && <p className={groupError ? 'artifact-edit-error' : 'group-feedback'} role={groupError ? 'alert' : 'status'} aria-live="polite">{groupError || groupSelectionError || groupNotice}</p>}<div className="artifact-edit-actions"><button className="primary-pill" type="submit" disabled={!groupName.trim() || Boolean(groupSelectionError)}>Group selected systems</button><button type="button" onClick={onClose}>Cancel</button></div></form>}
    {mode === 'relationship' && <form className="inspector-form" onSubmit={connect}><label htmlFor="relationship-source">From</label><select id="relationship-source" value={source} onChange={event => setSource(event.target.value)}><option value="">Choose a component…</option>{document.components.map(component => <option key={component.id} value={component.id}>{component.name}</option>)}</select><label htmlFor="relationship-target">To</label><select id="relationship-target" value={target} onChange={event => setTarget(event.target.value)}><option value="">Choose a component…</option>{document.components.map(component => <option key={component.id} value={component.id}>{component.name}</option>)}</select><label htmlFor="relationship-label">{document.kind === 'container' ? 'Interaction description' : <>Label <span>optional</span></>}</label><input id="relationship-label" value={label} onChange={event => setLabel(event.target.value)} placeholder="e.g. sends events" autoComplete="off" />{document.kind === 'container' && <><label htmlFor="relationship-protocol">Protocol</label><input id="relationship-protocol" value={protocol} onChange={event => setProtocol(event.target.value)} maxLength={200}/></>}<label htmlFor="relationship-direction">Direction</label><select id="relationship-direction" value={direction} onChange={event => setDirection(event.target.value as 'directed' | 'undirected')}><option value="directed">Directed</option>{document.kind !== 'container' && <option value="undirected">Undirected</option>}</select>{relationshipError && <p role="alert" className="artifact-edit-error">{relationshipError}</p>}<button className="primary-pill" type="submit" disabled={!source || !target || source === target}>Connect components</button></form>}
    {mode === null && !selectedGroup && <RecoveryControls selection={selection?.kind === 'component' || selection?.kind === 'relationship' ? selection : null} onSelectionClear={onClose} />}
  </aside>;
}
