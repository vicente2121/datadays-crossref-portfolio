# Ficha del proyecto · Data Days Crossref

| Dato | Valor |
| --- | --- |
| Repositorio | `vicente2121/datadays-crossref-portfolio` (público) |
| Fuente | `vicente2121/DATADAYS_DP600/charla03/caso_03_observatorio_crossref` |
| Azure DevOps | No aplica: entrega directa solicitada para este portafolio, sin Épica ni historias |
| Modo de entrega | Directo a `main` |
| Workspace DEV | `DataDays-FabricApps-Portfolio-DEV` · `0245bb51-e0d1-40f1-b071-fcbbf1d7b155` |
| Carpeta Fabric | `03-Crossref` · `4b9173ac-c07c-498b-8178-6584467bc4d1` |
| App Rayfin | `datadays-crossref-portfolio` · `93da42f6-7bc3-4dcd-bf89-963b3615ab27` |
| Elementos de este caso | `DD03_LH_Crossref`, `DD03_NB_Crossref_Incremental`, `DD03_PL_Crossref_Incremental`, `DD03_SM_Crossref`, `DD03_Informe_Crossref`, `datadays_crossref_portfolio_connector` |
| Acceso | Fabric SSO; informe integrado por conector delegado al modelo Direct Lake, sin datos propios ni roles de app |
| Cuenta del desarrollador | `juanvicente@ajmvicente21hotmail.onmicrosoft.com` |
| Sincronización Git del workspace | Desactivada; las publicaciones se hacen con CLI/API y los repositorios se mantienen separados |

## Alcance de propiedad

Solo se crean o modifican los elementos enumerados arriba y la app de esta ficha. `case-source/` copia el material general y no se sincroniza con el workspace.

## Publicación

- [Fabric App](https://rural-unity-56e33da5da-spaincentral.webapp.fabricapps.net)
- [Informe en Fabric](https://app.fabric.microsoft.com/groups/0245bb51-e0d1-40f1-b071-fcbbf1d7b155/reports/039172b3-f877-437c-928e-37dd706d0968)
- `fabric/` contiene la canalización, el modelo TMDL y el PBIR adaptados a este workspace; `case-source/` conserva la fuente original.
- La primera ejecución de la canalización terminó correctamente y materializó Bronze, Silver y Gold. El modelo Direct Lake se refrescó y devolvió cinco revistas y tres editoriales.

| Elemento | ID |
| --- | --- |
| Lakehouse | `f596030a-f843-44b8-8578-83bcfc0effac` |
| Notebook incremental | `bb329a93-7a3d-4e81-b770-4fb933b5e2dd` |
| Pipeline | `a40ae531-0976-4d16-9a57-d6cd207d99d5` |
| Modelo Direct Lake | `2c0d666b-0d4d-451a-82f5-d244e9f5c760` |
| Informe | `039172b3-f877-437c-928e-37dd706d0968` |
| Conector Rayfin (UserDataFunction) | `18a39c01-7e15-4ffa-9396-df2478c7840c` |

## Informe en la app

La sección Informe lee el modelo semántico de esta ficha mediante consultas DAX en packages/frontend/src/queries/report/. El acceso se delega al usuario autenticado. El recorrido técnico y las relaciones están en [arquitectura.md](arquitectura.md).

## Riesgos para producción

- Crossref puede imponer límites de consulta; el caso cubre solo cinco ISSN.
- El informe publicado está vinculado al modelo Direct Lake de este workspace; una réplica en otro workspace debe volver a vincularlo.
- La visibilidad de los datos del Lakehouse depende de los permisos del workspace; revisar antes de uso productivo.
