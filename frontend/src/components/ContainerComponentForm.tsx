import { useEffect, useState, type FormEvent } from 'react';
import { containerTypes, type Component, type ContainerType } from '../../../shared/src/index';
import { useDiagramStore } from '../state/diagram-store';

export function ContainerComponentForm({ component, onClose }: { component?: Component; onClose: () => void }) {
  const [name,setName]=useState(component?.name??'');
  const [description,setDescription]=useState(component?.description??'');
  const [technology,setTechnology]=useState(component?.technology??'');
  const [containerType,setContainerType]=useState<ContainerType>(component?.containerType??'application');
  const [error,setError]=useState('');
  useEffect(()=>{setName(component?.name??'');setDescription(component?.description??'');setTechnology(component?.technology??'');setContainerType(component?.containerType??'application');setError('');},[component]);
  const prefix=component?'component-edit':'component';
  const submit=(event:FormEvent)=>{
    event.preventDefault();const store=useDiagramStore.getState();const details={name,description,technology,containerType};
    const success=component?store.editContainer(component.id,details):store.addContainer(details);
    if(!success){setError(useDiagramStore.getState().error??'Provide a name, responsibilities and technology.');return;}
    setError('');if(!component)onClose();
  };
  return <form className="inspector-form artifact-edit-form" onSubmit={submit}>
    <label htmlFor={`${prefix}-name`}>Component name</label><input id={`${prefix}-name`} value={name} onChange={e=>setName(e.target.value)} maxLength={200} required autoComplete="off"/>
    <fieldset className="c4-type-fieldset"><legend>Container type</legend>{(Object.keys(containerTypes) as ContainerType[]).map(type=><label className="c4-type-option" key={type}><input type="radio" name={`${prefix}-container-type`} value={type} checked={containerType===type} onChange={()=>setContainerType(type)}/><span><strong>{containerTypes[type].label}</strong></span></label>)}</fieldset>
    <label htmlFor={`${prefix}-responsibilities`}>Responsibilities</label><textarea id={`${prefix}-responsibilities`} value={description} onChange={e=>setDescription(e.target.value)} required/>
    <label htmlFor={`${prefix}-technology`}>Technology</label><input id={`${prefix}-technology`} value={technology} onChange={e=>setTechnology(e.target.value)} maxLength={200} required autoComplete="off"/>
    {error&&<p className="artifact-edit-error" role="alert">{error}</p>}
    <div className="artifact-edit-actions"><button className="primary-pill" type="submit">{component?'Save component':'Add component'}</button><button type="button" onClick={onClose}>Cancel</button></div>
  </form>;
}
