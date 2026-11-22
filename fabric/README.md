# Definiciones publicadas · Crossref

Estas copias apuntan al workspace `DataDays-FabricApps-Portfolio-DEV`. `case-source/` conserva el material original. El workspace no tiene integración Git.

- `pipeline-content.json`: ejecuta el notebook incremental del caso.
- `SemanticModel/`: modelo TMDL Direct Lake dirigido a `DD03_LH_Crossref`.
- `Report/`: PBIR enlazado al nuevo modelo mediante `byConnection`, la forma de la API de Fabric.

La primera ejecución de la canalización terminó correctamente y materializó Bronze, Silver y Gold. Tras refrescar el modelo, la consulta DAX devolvió cinco revistas y tres editoriales.
