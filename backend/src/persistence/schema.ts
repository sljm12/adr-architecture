import { pgTable, uuid, varchar, text, doublePrecision, timestamp, pgEnum, primaryKey, index, uniqueIndex, unique, check, foreignKey, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
export const diagramStatus=pgEnum('diagram_status',['active','trashed']); export const relationshipDirection=pgEnum('relationship_direction',['directed','undirected']);
export const diagrams=pgTable('diagrams',{
  id:uuid('id').primaryKey(),name:varchar('name',{length:200}).notNull(),status:diagramStatus('status').notNull().default('active'),
  createdAt:timestamp('created_at',{withTimezone:true}).notNull(),updatedAt:timestamp('updated_at',{withTimezone:true}).notNull(),trashedAt:timestamp('trashed_at',{withTimezone:true}),
  kind:text('kind').notNull().default('general'),parentDiagramId:uuid('parent_diagram_id'),
  ownerComponentId:uuid('owner_component_id').references(():AnyPgColumn=>components.id,{onDelete:'restrict'}),
  scopeX:doublePrecision('scope_x'),scopeY:doublePrecision('scope_y'),scopeWidth:doublePrecision('scope_width'),scopeHeight:doublePrecision('scope_height'),
  trashBatchId:uuid('trash_batch_id'),trashRootDiagramId:uuid('trash_root_diagram_id'),
}, table => ({
  ownerUnique:uniqueIndex('diagrams_owner_component_unique').on(table.ownerComponentId).where(sql`${table.ownerComponentId} IS NOT NULL`),
  parentIdx:index('diagrams_parent_diagram_idx').on(table.parentDiagramId),
  trashIdx:index('diagrams_trash_root_batch_idx').on(table.trashRootDiagramId,table.trashBatchId),
  kindCheck:check('diagrams_kind_check',sql`${table.kind} IN ('general','container')`),
  scopeCheck:check('diagrams_container_scope_check',sql`(${table.kind} = 'general' AND ${table.parentDiagramId} IS NULL AND ${table.ownerComponentId} IS NULL AND ${table.scopeX} IS NULL AND ${table.scopeY} IS NULL AND ${table.scopeWidth} IS NULL AND ${table.scopeHeight} IS NULL) OR (${table.kind} = 'container' AND ${table.parentDiagramId} IS NOT NULL AND ${table.ownerComponentId} IS NOT NULL AND ${table.scopeX} > '-Infinity'::double precision AND ${table.scopeX} < 'Infinity'::double precision AND ${table.scopeY} > '-Infinity'::double precision AND ${table.scopeY} < 'Infinity'::double precision AND ${table.scopeWidth} > 0 AND ${table.scopeWidth} < 'Infinity'::double precision AND ${table.scopeHeight} > 0 AND ${table.scopeHeight} < 'Infinity'::double precision)`),
}));
export const components=pgTable('components',{
  id:uuid('id').primaryKey(),diagramId:uuid('diagram_id').notNull().references(()=>diagrams.id,{onDelete:'restrict'}),name:varchar('name',{length:200}).notNull(),description:text('description'),type:varchar('type',{length:100}),
  role:text('role').notNull().default('element'),technology:varchar('technology',{length:200}),sourceComponentId:uuid('source_component_id').references(():AnyPgColumn=>components.id,{onDelete:'restrict'}),
  x:doublePrecision('x').notNull(),y:doublePrecision('y').notNull(),width:doublePrecision('width').notNull().default(180),height:doublePrecision('height').notNull().default(72),createdAt:timestamp('created_at',{withTimezone:true}).notNull(),updatedAt:timestamp('updated_at',{withTimezone:true}).notNull()
}, table => ({
  diagramIdx:index('components_diagram_idx').on(table.diagramId),
  diagramSourceUnique:uniqueIndex('components_diagram_source_unique').on(table.diagramId,table.sourceComponentId),
  sourceIdx:index('components_source_component_idx').on(table.sourceComponentId),
  identityUnique:unique('components_id_diagram_unique').on(table.id,table.diagramId),
  roleCheck:check('components_c4_role_check',sql`(${table.role} = 'element' AND ${table.technology} IS NULL AND ${table.sourceComponentId} IS NULL) OR (${table.role} = 'container' AND ${table.type} = 'container' AND ${table.description} IS NOT NULL AND length(btrim(${table.description})) > 0 AND ${table.technology} IS NOT NULL AND length(btrim(${table.technology})) > 0 AND ${table.sourceComponentId} IS NULL) OR (${table.role} = 'external' AND ${table.type} IN ('person','software-system') AND ${table.technology} IS NULL AND ${table.sourceComponentId} IS NOT NULL)`),
  finiteLayout:check('components_finite_layout_check',sql`${table.x} > '-Infinity'::double precision AND ${table.x} < 'Infinity'::double precision AND ${table.y} > '-Infinity'::double precision AND ${table.y} < 'Infinity'::double precision AND ${table.width} > 0 AND ${table.width} < 'Infinity'::double precision AND ${table.height} > 0 AND ${table.height} < 'Infinity'::double precision`),
}));
export const relationships=pgTable('relationships',{id:uuid('id').primaryKey(),diagramId:uuid('diagram_id').notNull().references(()=>diagrams.id),sourceComponentId:uuid('source_component_id').notNull().references(()=>components.id),targetComponentId:uuid('target_component_id').notNull().references(()=>components.id),direction:relationshipDirection('direction').notNull(),label:text('label'),protocol:varchar('protocol',{length:200}),createdAt:timestamp('created_at',{withTimezone:true}).notNull(),updatedAt:timestamp('updated_at',{withTimezone:true}).notNull()});
export const adrStatus=pgEnum('adr_status',['draft','accepted','superseded','rejected']);
export const adrs=pgTable('adrs',{
  id:uuid('id').primaryKey(), diagramId:uuid('diagram_id').notNull().references(()=>diagrams.id),
  title:varchar('title',{length:300}).notNull(), context:text('context').notNull(), decision:text('decision').notNull(),
  consequences:text('consequences').notNull(), alternativesOrConstraints:text('alternatives_or_constraints'),
  status:adrStatus('status').notNull().default('draft'), replacementAdrId:uuid('replacement_adr_id'),
  createdAt:timestamp('created_at',{withTimezone:true}).notNull(), updatedAt:timestamp('updated_at',{withTimezone:true}).notNull(),
}, table => ({ diagramIdx:index('adrs_diagram_idx').on(table.diagramId), replacementIdx:index('adrs_replacement_idx').on(table.replacementAdrId) }));
export const adrComponentLinks=pgTable('adr_component_links',{
  adrId:uuid('adr_id').notNull().references(()=>adrs.id), componentId:uuid('component_id').notNull().references(()=>components.id),
  createdAt:timestamp('created_at',{withTimezone:true}).notNull(),
}, table => ({ pk:primaryKey({ columns:[table.adrId, table.componentId] }), componentIdx:index('adr_component_links_component_idx').on(table.componentId) }));
export const adrRelationshipLinks=pgTable('adr_relationship_links',{
  adrId:uuid('adr_id').notNull().references(()=>adrs.id), relationshipId:uuid('relationship_id').notNull().references(()=>relationships.id),
  createdAt:timestamp('created_at',{withTimezone:true}).notNull(),
}, table => ({ pk:primaryKey({ columns:[table.adrId, table.relationshipId] }), relationshipIdx:index('adr_relationship_links_relationship_idx').on(table.relationshipId) }));
export const systemGroups=pgTable('system_groups',{
  id:uuid('id').primaryKey(), diagramId:uuid('diagram_id').notNull().references(()=>diagrams.id),
  name:varchar('name',{length:200}).notNull(), x:doublePrecision('x').notNull(), y:doublePrecision('y').notNull(),
  width:doublePrecision('width').notNull(), height:doublePrecision('height').notNull(),
  createdAt:timestamp('created_at',{withTimezone:true}).notNull(), updatedAt:timestamp('updated_at',{withTimezone:true}).notNull(),
}, table => ({ diagramIdx:index('system_groups_diagram_idx').on(table.diagramId) }));
export const systemGroupMembers=pgTable('system_group_members',{
  groupId:uuid('group_id').notNull().references(()=>systemGroups.id), componentId:uuid('component_id').notNull().references(()=>components.id),
  createdAt:timestamp('created_at',{withTimezone:true}).notNull(),
}, table => ({ pk:primaryKey({ columns:[table.groupId, table.componentId] }), groupIdx:index('system_group_members_group_idx').on(table.groupId), componentIdx:index('system_group_members_component_idx').on(table.componentId) }));
