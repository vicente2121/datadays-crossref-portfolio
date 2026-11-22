import { ArrowUpRight, RefreshCw } from 'lucide-react';
import { KpiCard, VegaVisual, useCssTheme } from '@microsoft/fabric-visuals';
import { useSemanticModelQuery } from './hooks/use-semantic-model-query';
import { toDataTable } from './lib/to-data-table';
import { caseStudy } from './portfolio.data';
import { report } from './report.config';

function metricValue(
  table: { columns: readonly { name: string }[]; rows: readonly (readonly unknown[])[] },
  field: string,
): number | string | null {
  const index = table.columns.findIndex((column) => column.name === field);
  const value = index >= 0 ? table.rows[0]?.[index] : null;
  return typeof value === 'number' || typeof value === 'string' ? value : null;
}

export default function LiveReport() {
  const theme = useCssTheme();
  const overview = useSemanticModelQuery({ connection: report.connection, query: report.overviewQuery });
  const primary = useSemanticModelQuery({ connection: report.connection, query: report.primaryQuery });
  const secondary = useSemanticModelQuery({ connection: report.connection, query: report.secondaryQuery });

  const error = overview.error ?? primary.error ?? (report.secondaryQuery ? secondary.error : undefined);
  const loading = overview.isLoading || primary.isLoading || (Boolean(report.secondaryQuery) && secondary.isLoading);
  const ready = overview.data?.status === 'success' && primary.data?.status === 'success'
    && (!report.secondaryQuery || secondary.data?.status === 'success');
  const overviewTable = overview.data?.status === 'success' ? overview.data.table : null;
  const primaryTable = primary.data?.status === 'success' ? primary.data.table : null;
  const secondaryData = report.secondaryQuery ? secondary.data : primary.data;

  return <section className="portfolio__section live-report" id="informe" aria-labelledby="live-report-title">
    <div className="portfolio__section-heading">
      <div><p className="portfolio__section-index">03 / INFORME INTERACTIVO</p><h2 id="live-report-title">{report.title}</h2></div>
      <p>{report.intro}</p>
    </div>
    <div className="live-report__toolbar">
      <span className="live-report__model"><span aria-hidden="true" /> Modelo semántico · Direct Lake</span>
      <div>
        <button type="button" onClick={() => { void overview.refetch(); void primary.refetch(); if (report.secondaryQuery) void secondary.refetch(); }} aria-label="Actualizar informe"><RefreshCw aria-hidden="true" /> Actualizar</button>
        <a href={caseStudy.reportUrl} target="_blank" rel="noreferrer">Informe completo en Fabric <ArrowUpRight aria-hidden="true" /></a>
      </div>
    </div>
    {error ? <div className="live-report__state" role="alert"><strong>No se pudo consultar el modelo.</strong><p>{error.message}</p><button type="button" onClick={() => { void overview.refetch(); void primary.refetch(); if (report.secondaryQuery) void secondary.refetch(); }}>Reintentar</button></div>
      : loading || !ready ? <div className="live-report__state" role="status">Cargando datos del modelo publicado…</div>
      : <>
        <div className="live-report__kpis">
          {report.metrics.map((metric) => <KpiCard
            key={metric.field}
            theme={theme}
            className="live-report__kpi"
            header={{ title: metric.label, subtitle: metric.subtitle }}
            callout={{ metric: { value: metricValue(overviewTable!, metric.field), format: metric.format, displayUnits: metric.compact ? 'compact' : 'none' } }}
          />)}
        </div>
        <div className="live-report__charts">
          <VegaVisual
            spec={report.primarySpec}
            data={toDataTable(primaryTable!, report.primaryMetadata)}
            theme={theme}
            header={{ title: report.primaryTitle, subtitle: report.primarySubtitle }}
            style={{ height: 380 }}
          />
          {secondaryData?.status === 'success' && <VegaVisual
            spec={report.secondarySpec}
            data={toDataTable(secondaryData.table, report.secondaryMetadata)}
            theme={theme}
            header={{ title: report.secondaryTitle, subtitle: report.secondarySubtitle }}
            style={{ height: 380 }}
          />}
        </div>
      </>}
    <p className="live-report__disclosure">{report.disclosure}</p>
  </section>;
}
