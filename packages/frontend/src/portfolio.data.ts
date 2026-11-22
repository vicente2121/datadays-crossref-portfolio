const source = 'https://github.com/vicente2121/datadays-crossref-portfolio';
const path = 'case-source';

export const caseStudy = {
  number: '03', motif: 'crossref', monogram: 'CR',
  kicker: 'CASO 03 · OBSERVATORIO CROSSREF',
  title: 'La ciencia, vista como un flujo de datos.',
  intro: 'Cinco revistas, una ingesta incremental de metadatos Crossref y un observatorio para entender actividad, editoriales y calidad descriptiva.',
  disclosure: 'Portafolio documental del caso de clase. Las cifras publicadas en el informe original corresponden a su ejecución.',
  sourceUrl: `${source}/tree/main/${path}`,
  reportUrl: 'https://app.fabric.microsoft.com/groups/0245bb51-e0d1-40f1-b071-fcbbf1d7b155/reports/039172b3-f877-437c-928e-37dd706d0968',
  flow: 'CROSSREF → BRONZE → SILVER → GOLD → POWER BI',
  metrics: [
    { value: '5', label: 'revistas incluidas en el alcance' },
    { value: '5', label: 'tablas Gold del observatorio' },
    { value: '1', label: 'control de watermark incremental' },
  ],
  domain: 'PUBLICACIONES · METADATOS · CALIDAD',
  challengeTitle: 'Seguir el ritmo de la publicación.',
  challenge: 'Crossref cambia continuamente. Reprocesar todo en cada ejecución no demuestra una ingesta incremental ni permite explicar qué aportó una corrida. Este caso guarda páginas originales, normaliza DOI, mantiene un watermark y prepara lecturas semanales de cinco revistas científicas.',
  takeaway: 'La segunda ejecución se puede comparar con la primera para comprobar el avance incremental y sus registros nuevos.',
  stages: [
    { name: 'Bronze', short: 'Páginas originales por corrida', title: 'La fuente queda preservada.', description: 'El notebook consulta Crossref por ISSN y guarda el JSON de cada página bajo un run_id; también registra las páginas en una tabla Bronze.', points: ['Cinco ISSN concretos y documentados', 'Files/bronze/crossref/run_id=...', 'Tabla bronze.crossref_raw_pages'], caption: 'crossref_incremental.py' },
    { name: 'Silver', short: 'Una publicación por DOI', title: 'Metadatos comparables.', description: 'La capa Silver normaliza el DOI y estructura fechas, revista, editorial, tipo documental y banderas de completitud.', points: ['Grano: DOI normalizado', 'Atributos de revista y editorial', 'Indicadores de ORCID, resumen y licencia'], caption: 'silver.publications' },
    { name: 'Gold', short: 'Actividad y calidad resumidas', title: 'Cinco vistas para observar tendencias.', description: 'Gold resume actividad semanal, editoriales, tipos documentales y calidad por revista, junto con un calendario semanal.', points: ['gold.journal_weekly_activity', 'gold.publisher_summary y gold.document_type_summary', 'gold.journal_quality_summary y gold.calendar_week'], caption: 'Tablas Gold del Lakehouse' },
    { name: 'Power BI', short: 'Modelo y dos lecturas', title: 'Actividad y composición en un informe.', description: 'Un modelo Direct Lake y un proyecto PBIP muestran la evolución semanal y la composición editorial y documental, con medidas de cobertura de metadatos.', points: ['Seis tablas visibles en el modelo', 'Comparación con las cuatro semanas previas', 'ORCID, resumen y licencia por revista'], caption: 'Observatorio_Crossref.pbip' },
  ],
  resultsIntro: 'Las cinco preguntas de negocio del documento de requisitos se reflejan en las páginas del informe original.',
  outcomes: [
    { question: '¿Cuántos registros nuevos llegan?', answer: 'Actividad semanal por revista y total de la última semana cerrada.' },
    { question: '¿Quién acelera o se frena?', answer: 'Comparación de cada revista con su media de las cuatro semanas anteriores.' },
    { question: '¿Qué editoriales concentran el corpus?', answer: 'Resumen y ranking de publicaciones por editorial.' },
    { question: '¿Qué tipos de documento aparecen?', answer: 'Distribución por tipo dentro de los cinco ISSN seleccionados.' },
    { question: '¿Qué tan completos son los metadatos?', answer: 'Cobertura de ORCID, resumen y licencia, global y por revista.' },
  ],
  limit: 'El observatorio cubre cinco revistas concretas; sus proporciones no describen todo Crossref. El informe publicado ya está vinculado al Lakehouse de este workspace y requiere acceso a sus elementos para verlo.',
  artifacts: [
    { title: 'Informe en Fabric', description: 'Actividad y calidad del observatorio publicado', href: 'https://app.fabric.microsoft.com/groups/0245bb51-e0d1-40f1-b071-fcbbf1d7b155/reports/039172b3-f877-437c-928e-37dd706d0968', kind: 'repo' },
    { title: 'Guía de replicación', description: 'Alcance, pasos y comprobaciones', href: `${source}/blob/main/${path}/infraestructura/GUIA_REPLICACION_MANUAL.md`, kind: 'guide' },
    { title: 'Notebook PySpark', description: 'Ingesta incremental y capas Medallion', href: `${source}/blob/main/${path}/notebooks/crossref_incremental.py`, kind: 'code' },
    { title: 'Pipeline', description: 'Definición de referencia para orquestar', href: `${source}/tree/main/${path}/pipelines`, kind: 'code' },
    { title: 'Proyecto Power BI', description: 'Informe PBIR y modelo Direct Lake', href: `${source}/tree/main/${path}/informe`, kind: 'repo' },
  ],
  replicaTitle: 'Una carga inicial y otra incremental.',
  replicaSteps: ['Crea un Lakehouse vacío con esquemas y vincúlalo al notebook.', 'Ejecuta una primera carga y comprueba el watermark y las tablas Gold.', 'Repite la ejecución para verificar la actualización incremental.', 'Crea el pipeline y conecta el modelo y el informe al Lakehouse nuevo.'],
  footer: 'CASO 03 / CROSSREF',
};
