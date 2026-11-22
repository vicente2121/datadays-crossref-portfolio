# Data Days · Observatorio Crossref

Fabric App tipo portafolio del caso 03 de DP-600: ingesta incremental de metadatos de cinco revistas científicas desde Crossref, transformación Medallion y análisis de actividad y calidad en Power BI. La app explica la solución; **no consulta Crossref en directo**.

**Publicado:** [Fabric App](https://rural-unity-56e33da5da-spaincentral.webapp.fabricapps.net) · [Informe Power BI](https://app.fabric.microsoft.com/groups/0245bb51-e0d1-40f1-b071-fcbbf1d7b155/reports/039172b3-f877-437c-928e-37dd706d0968) · workspace `DataDays-FabricApps-Portfolio-DEV` / carpeta `03-Crossref`.

## Explora la solución

| Parte | Contenido |
| --- | --- |
| `packages/frontend/` | Fabric App Rayfin con el recorrido del caso |
| [`case-source/notebooks/`](case-source/notebooks/) | Notebook PySpark de carga incremental |
| [`case-source/pipelines/`](case-source/pipelines/) | Definición de referencia del pipeline |
| [`case-source/informe/`](case-source/informe/) | PBIP con informe y modelo Direct Lake |
| [`fabric/`](fabric/) | Copias de despliegue vinculadas al modelo y Lakehouse nuevos |
| [`case-source/infraestructura/`](case-source/infraestructura/) | Guía de replicación y PDF |
| [`case-source/requisitos/`](case-source/requisitos/) | Preguntas de negocio y medidas del caso |
| [`docs/proyecto.md`](docs/proyecto.md) | Workspace, carpeta e inventario de recursos de esta app |

Los artefactos proceden del [repositorio general de Data Days](https://github.com/vicente2121/DATADAYS_DP600/tree/main/charla03/caso_03_observatorio_crossref). El workspace de Fabric **no está sincronizado con Git**.

## Lo que demuestra

- Bronze conserva páginas originales por ejecución.
- Silver normaliza DOI y calidad de metadatos.
- El watermark permite comparar una carga inicial con otra incremental.
- Gold ofrece actividad semanal, editoriales, tipos y calidad para el informe.

## Reproducción y desarrollo

La guía de réplica está en [`case-source/infraestructura/GUIA_REPLICACION_MANUAL.md`](case-source/infraestructura/GUIA_REPLICACION_MANUAL.md). La app requiere Node.js 22.13 o posterior:

```powershell
npm install
npm run typecheck
npm run build
npm run dev
```

Consulta [`docs/rayfin-template.md`](docs/rayfin-template.md) para los comandos de la plantilla oficial.
