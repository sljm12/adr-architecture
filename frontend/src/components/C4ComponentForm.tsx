import { useState, type FormEvent, type ChangeEvent } from 'react';
import type { Component } from '../../../shared/src/index';
import { useDiagramStore, type C4ComponentEdit } from '../state/diagram-store';

export function C4ComponentForm({ component, onClose }: { component?: Component; onClose: () => void }) {
  const [details, setDetails] = useState<C4ComponentEdit>({ name: component?.name ?? '', description: component?.description ?? '', technology: component?.technology ?? '' });
  const [errors, setErrors] = useState<Partial<Record<keyof C4ComponentEdit | 'form', string>>>({});
  const [previousComponent, setPreviousComponent] = useState(component);
  if (component !== previousComponent) { setPreviousComponent(component); setDetails({ name: component?.name ?? '', description: component?.description ?? '', technology: component?.technology ?? '' }); setErrors({}); }
  const prefix = component ? 'component-edit' : 'component';
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const invalid: typeof errors = {};
    for (const field of ['name', 'description', 'technology'] as const) {
      const label = field === 'description' ? 'Responsibilities' : field === 'name' ? 'Component name' : 'Technology';
      if (!details[field].trim()) invalid[field] = `${label} is required.`;
      else if (field !== 'description' && details[field].trim().length > 200) invalid[field] = `${label} must contain at most 200 characters.`;
    }
    if (Object.keys(invalid).length) { setErrors(invalid); return; }
    const store = useDiagramStore.getState();
    if (!(component ? store.editC4Component(component.id, details) : store.addC4Component(details))) { setErrors({ form: useDiagramStore.getState().error ?? 'Could not update this Component.' }); return; }
    setErrors({}); if (!component) onClose();
  };
  return <form className="inspector-form artifact-edit-form" noValidate onSubmit={submit}>
    <p className="inspector-meta">Component type: <strong>Component</strong></p>
    {(['name', 'description', 'technology'] as const).map(field => {
      const id = `${prefix}-${field === 'description' ? 'responsibilities' : field}`;
      const props = { id, value: details[field], required: true, 'aria-invalid': Boolean(errors[field]), 'aria-describedby': errors[field] ? `${id}-error` : undefined, onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setDetails(value => ({ ...value, [field]: event.target.value })); setErrors(value => ({ ...value, [field]: undefined })); } };
      return <div className="component-detail-field" key={field}><label htmlFor={id}>{field === 'name' ? 'Component name' : field === 'description' ? 'Responsibilities' : 'Technology'}</label>{field === 'description' ? <textarea {...props} /> : <input {...props} maxLength={200} autoComplete="off" />}{errors[field] && <p id={`${id}-error`} className="artifact-edit-error" role="alert">{errors[field]}</p>}</div>;
    })}
    {errors.form && <p className="artifact-edit-error" role="alert">{errors.form}</p>}
    <div className="artifact-edit-actions"><button className="primary-pill" type="submit">{component ? 'Save component' : 'Add component'}</button><button type="button" onClick={onClose}>Cancel</button></div>
  </form>;
}
