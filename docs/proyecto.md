# Ficha del proyecto · Data Days Crossref

| Dato | Valor |
| --- | --- |
| Repositorio | `vicente2121/datadays-crossref-portfolio` (público) |
| Fuente | `vicente2121/DATADAYS_DP600/charla03/caso_03_observatorio_crossref` |
| Azure DevOps | No aplica: entrega directa solicitada para este portafolio, sin Épica ni historias |
| Modo de entrega | Directo a `main` |
| Workspace DEV | `DataDays-FabricApps-Portfolio-DEV` · `0245bb51-e0d1-40f1-b071-fcbbf1d7b155` |
| Carpeta Fabric | `03-Crossref` · `4b9173ac-c07c-498b-8178-6584467bc4d1` |
| App Rayfin | `datadays-crossref-portfolio` · identificador único en `rayfin/rayfin.yml` |
| Elementos de este caso | `DD03_LH_Crossref`, `DD03_NB_Crossref_Incremental`, `DD03_PL_Crossref`, `DD03_SM_ObservatorioCrossref`, `DD03_Informe_Crossref` |
| Acceso | Fabric SSO; portafolio documental sin datos propios ni roles de app |
| Cuenta del desarrollador | `juanvicente@ajmvicente21hotmail.onmicrosoft.com` |
| Sincronización Git del workspace | Desactivada; las publicaciones se hacen con CLI/API y los repositorios se mantienen separados |

## Alcance de propiedad

Solo se crean o modifican los elementos enumerados arriba y la app de esta ficha. `case-source/` copia el material general y no se sincroniza con el workspace.

## Riesgos para producción

- Crossref puede imponer límites de consulta; el caso cubre solo cinco ISSN.
- El informe copiado requiere conexión al modelo del Lakehouse de este workspace.
- La visibilidad de los datos del Lakehouse depende de los permisos del workspace; revisar antes de uso productivo.
