import type { VisualizationSpec } from '@microsoft/fabric-visuals';
import primarySpecJson from './queries/report/primarySpec.visual.json';
import secondarySpecJson from './queries/report/secondarySpec.visual.json';
const primarySpec = primarySpecJson as unknown as VisualizationSpec;
const secondarySpec = secondarySpecJson as unknown as VisualizationSpec;
import type { ColumnMetadataMap } from './lib/to-data-table';
import overviewQuery from './queries/report/overview.dax?raw';
import primaryQuery from './queries/report/by-journal.dax?raw';
import secondaryQuery from './queries/report/weekly.dax?raw';

const primaryMetadata: ColumnMetadataMap = {
  'Revistas[Revista]': { name: 'Revista', displayName: 'Revista' },
  '[Publicaciones]': { name: 'Publicaciones', displayName: 'DOI observados', format: '#,##0' },
  '[CoberturaORCID]': { name: 'CoberturaORCID', displayName: 'Con ORCID', format: '0.0%' },
};
const secondaryMetadata: ColumnMetadataMap = {
  'Semanas[Semana]': { name: 'Semana', displayName: 'Semana' },
  '[Publicaciones]': { name: 'Publicaciones', displayName: 'Publicaciones nuevas', format: '#,##0' },
};

export const report = {
  connection: 'crossrefmodel',
  title: 'La ciencia, vista por sus metadatos.',
  intro: 'Actividad y cobertura de calidad para cinco revistas seleccionadas, sobre el modelo Direct Lake del observatorio.',
  overviewQuery,
  primaryQuery,
  secondaryQuery,
  secondarySource: 'secondary' as const,
  metrics: [
    { label: 'Publicaciones', subtitle: 'DOI observados', field: '[Publicaciones]', format: '#,##0', compact: false },
    { label: 'Con ORCID', subtitle: 'Cobertura de metadatos', field: '[CoberturaORCID]', format: '0.0%', compact: false },
    { label: 'Con resumen', subtitle: 'Cobertura de metadatos', field: '[CoberturaResumen]', format: '0.0%', compact: false },
    { label: 'Última carga', subtitle: 'Estado del pipeline', field: '[EstadoCarga]', format: undefined, compact: false },
  ],
  primaryTitle: 'Publicaciones por revista',
  primarySubtitle: 'Universo de cinco ISSN',
  primarySpec,
  primaryMetadata,
  secondaryTitle: 'Actividad por semana',
  secondarySubtitle: 'Las 12 semanas más recientes de la carga',
  secondarySpec,
  secondaryMetadata,
  disclosure: 'El observatorio cubre únicamente cinco revistas. La cobertura ORCID y de resumen mide metadatos disponibles, no calidad científica.',
};
