import { pgTable, uuid, varchar, text, doublePrecision, timestamp, pgEnum, primaryKey, index } from 'drizzle-orm/pg-core';
export const diagramStatus=pgEnum('diagram_status',['active','trashed']); export const relationshipDirection=pgEnum('relationship_direction',['directed','undirected']);
export const diagrams=pgTable('diagrams',{id:uuid('id').primaryKey(),name:varchar('name',{length:200}).notNull(),status:diagramStatus('status').notNull().default('active'),createdAt:timestamp('created_at',{withTimezone:true}).notNull(),updatedAt:timestamp('updated_at',{withTimezone:true}).notNull(),trashedAt:timestamp('trashed_at',{withTimezone:true})});
export const components=pgTable('components',{id:uuid('id').primaryKey(),diagramId:uuid('diagram_id').notNull().references(()=>diagrams.id),name:varchar('name',{length:200}).notNull(),description:text('description'),type:varchar('type',{length:100}),x:doublePrecision('x').notNull(),y:doublePrecision('y').notNull(),createdAt:timestamp('created_at',{withTimezone:true}).notNull(),updatedAt:timestamp('updated_at',{withTimezone:true}).notNull()});
export const relationships=pgTable('relationships',{id:uuid('id').primaryKey(),diagramId:uuid('diagram_id').notNull().references(()=>diagrams.id),sourceComponentId:uuid('source_component_id').notNull().references(()=>components.id),targetComponentId:uuid('target_component_id').notNull().references(()=>components.id),direction:relationshipDirection('direction').notNull(),label:text('label'),createdAt:timestamp('created_at',{withTimezone:true}).notNull(),updatedAt:timestamp('updated_at',{withTimezone:true}).notNull()});
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
