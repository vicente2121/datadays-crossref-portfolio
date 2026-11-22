# Clase 03 · Observatorio Crossref en Microsoft Fabric

Carga incremental de metadatos de cinco revistas científicas con Crossref, capas Bronze, Silver y Gold, y un informe Power BI.

## Material de la clase

- [Guía de replicación paso a paso](infraestructura/GUIA_REPLICACION_MANUAL.md) y [versión PDF](infraestructura/GUIA_REPLICACION_MANUAL.pdf).
- [PDF de requisitos y medidas](requisitos/REQUISITOS_Y_MEDIDAS_CLASE03.pdf).
- [Código PySpark del notebook](notebooks/crossref_incremental.py).
- [Definición de referencia del pipeline](pipelines/pipeline-content.json).
- [Proyecto Power BI](informe/Observatorio_Crossref/Observatorio_Crossref.pbip), con la definición del informe y del modelo semántico.

Sigue la guía para crear los elementos en tu workspace y conectarlos al Lakehouse nuevo. El JSON del pipeline contiene marcadores para los identificadores del notebook y el workspace. El proyecto Power BI conserva referencias al workspace usado en la clase; para una réplica independiente, crea o conecta el modelo y el informe a tu propio workspace como indica la guía.
