# Guía de clase 03: reproducir el observatorio Crossref a mano en Microsoft Fabric

**Fecha de referencia:** 21/11/2026. **Objetivo:** construir en la interfaz de Fabric la carga incremental de cinco revistas, las capas Bronze, Silver y Gold, un pipeline diario y un informe Power BI que responda cinco preguntas de negocio.

Esta guía describe los clics y las comprobaciones para reproducir el proyecto en otro workspace, usando el workspace ya creado como referencia. No exige ejecutar archivos JSON ni comandos de despliegue. El código PySpark completo está en [crossref_incremental.py](../notebooks/crossref_incremental.py). El [PDF de requisitos y medidas](../requisitos/REQUISITOS_Y_MEDIDAS_CLASE03.pdf) fija el alcance. Las carpetas TMDL y PBIP de [informe/](../informe/) son una referencia del modelo y del diseño terminados; para este ejercicio se construyen desde la interfaz.

## 0. Ruta rápida: copiar del workspace existente al nuevo

Abre en una pestaña el [workspace de referencia DataDays-Clase03-Crossref-20261121](https://app.fabric.microsoft.com/groups/12550784-533f-4c83-9e36-7dd592db8de9/list?experience=fabric). En otra pestaña abre el workspace nuevo que crearás en la sección 3. Sigue **este orden**; las secciones 1 y 2 explican el origen y la carga, y las secciones 3 a 11 detallan cada clic.

| Elemento en el workspace de referencia | Qué haces en el workspace nuevo | Motivo |
| --- | --- | --- |
| `01_Requisitos/REQ_Clase03_Crossref` | Conserva el PDF de requisitos; si quieres tener el alcance dentro de Fabric, resúmelo en un notebook de requisitos. | Es material de clase, no una dependencia de ejecución. |
| `05_Datos_Medallion/LH_Crossref_Publicaciones` | Crea un Lakehouse **nuevo, vacío y con esquemas**. | Así la primera ejecución demuestra la carga inicial y crea su propio control de watermark. |
| `02_Notebooks/NB_Crossref_Incremental` | Abre el notebook de origen y usa **Save a copy** para guardarlo en el workspace nuevo. Después cambia su Lakehouse predeterminado al nuevo. | Puedes reutilizar todas las celdas de código sin conservar el destino de datos antiguo. |
| `03_Pipelines/PL_Crossref_Incremental_Diario` | Crea un pipeline nuevo y reproduce su única actividad Notebook y sus opciones. Selecciona el notebook **del workspace nuevo**. | La actividad debe ejecutar la copia nueva y el horario pertenece al pipeline nuevo. |
| `04_Informe/SM_Crossref_Observatorio` | Crea un modelo Direct Lake nuevo desde las tablas Gold **del Lakehouse nuevo**; copia las medidas DAX de la sección 8. | El modelo debe leer los datos de la réplica. |
| `04_Informe/Observatorio Crossref - Clase 03` | Construye el informe desde el modelo nuevo con la sección 9 y usa el original como referencia visual. | **Save a copy** del informe mantiene la conexión al modelo original. |

**Secuencia de trabajo completa:** 1) workspace y carpetas; 2) Lakehouse vacío; 3) copia del notebook y cambio del Lakehouse predeterminado; 4) primera ejecución y comprobación; 5) segunda ejecución incremental; 6) pipeline y prueba manual; 7) programación diaria; 8) modelo semántico y medidas; 9) informe y respuestas a las cinco preguntas. No copies las tablas de control ni los datos del Lakehouse original: la réplica debe generar sus propias ejecuciones.

Si no aparece **Save a copy** del notebook, crea uno nuevo en `02_Notebooks`: desde el notebook original copia **sus dos celdas Python, en el mismo orden**, o pega el archivo local [crossref_incremental.py](../notebooks/crossref_incremental.py) completo en una sola celda Python. Las celdas Markdown del original son explicativas y puedes copiarlas también. [Microsoft Learn: copiar notebooks entre workspaces](https://learn.microsoft.com/fabric/data-engineering/how-to-use-notebook#save-a-notebook). [Microsoft Learn: por qué una copia de informe conserva el modelo original](https://learn.microsoft.com/power-bi/connect-data/service-datasets-copy-reports).

## 1. Entender el origen y el problema

**Pregunta central:** ¿qué revistas registran más obras nuevas en Crossref cada semana y cómo cambia esa actividad? Seguimos Nature, Science, PLOS One, Scientific Reports y Nature Communications por ISSN.

| Revista | ISSN |
| --- | --- |
| Nature | 0028-0836 |
| Science | 0036-8075 |
| PLOS One | 1932-6203 |
| Scientific Reports | 2045-2322 |
| Nature Communications | 2041-1723 |

Crossref ofrece **metadatos**, como DOI, título, autores, editorial, tipo de obra, fechas, ORCID, resumen y licencia. No entrega aquí el PDF ni el texto completo. La API pública no necesita cuenta, contraseña ni clave. Para comprobarla en el navegador, abre:

`https://api.crossref.org/journals/2045-2322/works?filter=from-update-date:2026-11-20,until-update-date:2026-11-20&rows=2`

En el JSON observa `message.items`, `message.next-cursor` y el campo `DOI`. La fecha del ejemplo es solo una prueba; el notebook calcula su propia ventana.

**Límites del origen:** la modalidad pública admite una consulta de lista con filtros por segundo y una consulta simultánea. El código espera 1,15 s entre peticiones, usa 500 filas por página y reintenta HTTP 429 y errores 5xx. Lee `Retry-After` si llega. El límite de seguridad del notebook es 200 páginas por revista por ejecución; si se supera, la ejecución falla y no avanza el watermark. Crossref anuncia los límites vigentes en las cabeceras `x-rate-limit-limit`, `x-rate-limit-interval` y `x-concurrency-limit`. [Referencia de Crossref](https://www.crossref.org/documentation/retrieve-metadata/rest-api/access-and-authentication/).

## 2. Entender el tipo de carga de hoy

Se usa una **carga inicial acotada seguida de carga incremental por watermark**:

1. Sin tabla de control, el notebook consulta los **70 días anteriores** a la hora de ejecución. Es el arranque del observatorio, no una descarga de toda la historia de Crossref.
2. Al terminar, guarda en `dbo.crossref_control` la hora UTC hasta la que consultó: ese valor es el **watermark**.
3. En la siguiente ejecución consulta desde **watermark menos 24 horas** hasta la hora actual mediante `from-update-date` y `until-update-date`. El solapamiento recupera actualizaciones tardías y hace posible repetir una ventana.
4. Recorre todas las páginas con `cursor`; guarda la respuesta íntegra en Bronze; normaliza y hace `MERGE` por DOI en Silver. Por eso una fila repetida de la ventana solapada no duplica la obra.
5. Recalcula los resúmenes Gold y **solo después** actualiza el watermark. Si falla, el siguiente intento repite la ventana pendiente. `dbo.crossref_runs` registra el resultado.

El filtro incremental usa la **fecha de actualización de los metadatos**. La pregunta semanal agrupa por `created_at`, la fecha de alta del DOI en Crossref. Son fechas distintas: una obra antigua actualizada hoy entra en la carga incremental, pero cuenta en su semana original de alta. Las cifras del informe representan el **conjunto observado en nuestra ventana de ingesta**, no todos los DOI históricos de esas revistas.

| Capa | Qué debes encontrar al terminar |
| --- | --- |
| Bronze | JSON por página en `Files/bronze/crossref/run_id=...` y tabla `bronze.crossref_raw_pages`. |
| Silver | `silver.publications`: una fila por DOI normalizado, con fechas, revista, editorial, tipo y banderas de completitud. |
| Gold | `gold.journal_weekly_activity`, `gold.publisher_summary`, `gold.document_type_summary`, `gold.journal_quality_summary`, `gold.calendar_week`. |
| Control | `dbo.crossref_control` y `dbo.crossref_runs`. |

## 3. Crear el workspace y ordenar los elementos

1. Entra en [Microsoft Fabric](https://app.fabric.microsoft.com/) con tu cuenta y comprueba que tienes una capacidad Fabric o Trial donde ejecutar Spark y Power BI.
2. En **Workspaces > New workspace**, escribe `DataDays-Clase03-Crossref-AAAAmmdd` (usa otra fecha o sufijo si el nombre ya existe), asigna la capacidad y crea el workspace.
3. Dentro del workspace crea estas carpetas desde **New folder**: `01_Requisitos`, `02_Notebooks`, `03_Pipelines`, `04_Informe`, `05_Datos_Medallion`.
4. Conserva [el PDF de requisitos y medidas](../requisitos/REQUISITOS_Y_MEDIDAS_CLASE03.pdf) como hoja de trabajo. Si quieres tener el alcance dentro de Fabric, crea un notebook de una celda Markdown llamado `REQ_Clase03_Crossref`, resume allí los requisitos y colócalo en `01_Requisitos`.

**Comprobación:** el workspace está vacío salvo las carpetas que acabas de crear. Apunta su nombre; todos los elementos siguientes van ahí.

## 4. Crear el Lakehouse

1. En `05_Datos_Medallion`, usa **New item > Lakehouse** y nómbralo `LH_Crossref_Publicaciones`.
2. Activa **Lakehouse schemas** si el asistente ofrece esa opción; el notebook creará los esquemas `bronze`, `silver` y `gold`. `dbo` se usa para control.
3. Abre el Lakehouse y localiza el explorador **Files** y **Tables**. Después podrás cambiar al **SQL analytics endpoint** desde el selector superior.

**Comprobación:** el Lakehouse aparece en `05_Datos_Medallion`. Aún no debe haber tablas del caso.

## 5. Crear y ejecutar el notebook

1. En `02_Notebooks` del workspace de referencia, abre `NB_Crossref_Incremental`. Usa **Save a copy** y elige el workspace nuevo; coloca la copia en `02_Notebooks` y llámala `NB_Crossref_Incremental`. Si prefieres copiar y pegar, crea ese notebook en el destino y copia sus **dos celdas Python en orden**, o pega [crossref_incremental.py](../notebooks/crossref_incremental.py) completo en una sola celda Python.
2. En el notebook del **workspace nuevo**, abre el explorador de Lakehouses. Si figura el Lakehouse original, quítalo de la lista del notebook con **X**; esto no borra el Lakehouse. Pulsa **Add lakehouse**, elige `LH_Crossref_Publicaciones` del workspace nuevo y márcalo como **predeterminado** con la chincheta. Reinicia la sesión Spark después de cambiarlo. Antes de ejecutar, confirma visualmente que el Lakehouse predeterminado pertenece al workspace nuevo. [Microsoft Learn: Lakehouse predeterminado y reinicio de sesión](https://learn.microsoft.com/fabric/data-engineering/how-to-use-notebook#connect-lakehouses-and-notebooks).
3. Revisa las constantes al principio del código: cinco ISSN, 500 filas por página, 70 días iniciales y 24 horas de solapamiento. No escribas credenciales: la API es pública. Guarda y pulsa **Run all**. La primera carga puede durar varios minutos porque recorre cinco revistas y respeta el ritmo de Crossref. Observa las líneas `ISSN: pagina ...`, `inicial=True` y el JSON final con `status: Succeeded`.
4. Vuelve al **Lakehouse nuevo** y actualiza el explorador. Comprueba que aparecen las tablas de la sección 2 y los archivos JSON en `Files/bronze/crossref/`.

**Comprobación de la primera carga:** abre el SQL analytics endpoint del Lakehouse y ejecuta estas consultas de **solo lectura**:

```sql
SELECT COUNT(*) AS filas, COUNT(DISTINCT doi_key) AS doi_unicos
FROM silver.publications;

SELECT process_name, watermark_utc, last_run_id
FROM dbo.crossref_control;

SELECT TOP (10) started_at, status, pages, rows_read, rows_valid
FROM dbo.crossref_runs
ORDER BY started_at DESC;
```

Las dos cifras de la primera consulta deben ser iguales. Debe existir una fila de control y la última ejecución debe decir `Succeeded`. El número exacto de DOI cambia con el día y con Crossref.

## 6. Demostrar que la segunda ejecución es incremental

1. Apunta las filas y el watermark de las consultas anteriores.
2. Ejecuta **Run all** de nuevo. La línea inicial debe mostrar `inicial=False` y una ventana que empieza aproximadamente 24 horas antes del watermark anterior.
3. Repite las tres consultas SQL. Verás una nueva fila en `dbo.crossref_runs`; `rows_read` será normalmente muy inferior a la primera carga, aunque no tiene por qué ser cero por el solapamiento.
4. Comprueba otra vez `COUNT(*) = COUNT(DISTINCT doi_key)`. El watermark debe avanzar solo tras `Succeeded`.

**Qué explicas en clase:** el ahorro viene de pedir cambios a la API en vez de releer el histórico; la seguridad viene del solapamiento, el `MERGE`, el registro de ejecuciones y confirmar la marca al final. No fuerces un error en el workspace compartido para enseñar el caso.

## 7. Crear el pipeline y su horario

1. En `03_Pipelines`, crea un **Data pipeline** llamado `PL_Crossref_Incremental_Diario`.
2. Abre el pipeline original en otra pestaña para ver su configuración. Añade una actividad **Notebook** al pipeline nuevo, selecciónala y elige `NB_Crossref_Incremental` **del workspace nuevo**. Comprueba el workspace mostrado en el selector, porque los dos notebooks tienen el mismo nombre. No hacen falta parámetros: el notebook lee su propia tabla de control.
3. En la política de actividad configura **timeout 3 horas**, **1 reintento** y **180 segundos entre reintentos**. Guarda el pipeline.
4. Pulsa **Run** una vez. En el historial o Monitor comprueba que la actividad y el pipeline terminan correctamente; revisa que `dbo.crossref_runs` recibe otra ejecución.
5. Abre **Schedule > Add schedule**. Elige **Daily**, hora **08:00**, zona **Madrid / Romance Standard Time**, una fecha inicial futura y una fecha final suficientemente lejana; activa el horario y guarda.
6. Vuelve a **Schedule** y verifica que esté habilitado y que la próxima ejecución sea a las 08:00 de Madrid. El horario es del **pipeline**, no del notebook.

El horario del caso original se activó el 21/11/2026 para empezar el 22/11/2026. En tu réplica usa tu propia fecha. Consulta [la guía oficial de programación de pipelines](https://learn.microsoft.com/fabric/data-factory/pipeline-runs#scheduled-pipeline-runs).

## 8. Crear el modelo semántico Direct Lake

1. Abre el **Lakehouse nuevo** o su SQL analytics endpoint y selecciona **New Power BI semantic model**. Nómbralo `SM_Crossref_Observatorio`. Usa el modelo original para consultar nombres, relaciones y medidas, pero crea este modelo desde los datos del workspace nuevo.
2. Selecciona estas seis tablas: las cinco `gold.*` de la sección 2 y `dbo.crossref_runs`. Elige **Direct Lake**. Mueve el modelo a `04_Informe`.
3. En **Open data model**, renombra las tablas como sigue. Si los nombres de columnas difieren, usa `sourceColumn` de los [archivos TMDL](../informe/Observatorio_Crossref/SM_Crossref_Observatorio.SemanticModel/definition/) para identificar la columna física.

| Tabla del Lakehouse | Nombre en el modelo | Columnas visibles esenciales |
| --- | --- | --- |
| `gold.journal_weekly_activity` | `Actividad semanal` | `Semana` (`week_start`), `Revista` (`journal_name`), `Recuento semanal` (`new_publications`), `ISSN` |
| `gold.journal_quality_summary` | `Revistas` | `Revista`, `ISSN`, `Publicaciones`, `Con ORCID`, `Con resumen`, `Con licencia` |
| `gold.publisher_summary` | `Editoriales` | `Editorial` (`publisher_name`), `Publicaciones` |
| `gold.document_type_summary` | `Tipos de documento` | `Tipo de documento`, `Publicaciones`, `ISSN` |
| `gold.calendar_week` | `Semanas` | `Semana` (`week_start`), `Año`, `Número de semana` |
| `dbo.crossref_runs` | `Ejecuciones` | `Fin` (`finished_at`), `Estado` (`status`) |

4. Crea relaciones **uno a varios, activas y de filtro único**: `Revistas[ISSN]` → `Actividad semanal[ISSN]`; `Revistas[ISSN]` → `Tipos de documento[ISSN]`; `Semanas[Semana]` → `Actividad semanal[Semana]`. `Editoriales` y `Ejecuciones` quedan independientes.
5. Crea las medidas desde **New measure** en la tabla indicada. Estas son las fórmulas usadas en el caso; los archivos TMDL permiten contrastar los nombres y formatos:

```dax
Publicaciones nuevas = SUM('Actividad semanal'[Recuento semanal])

Publicaciones última semana =
VAR _lunesActual = TODAY() - WEEKDAY(TODAY(), 2) + 1
VAR _semanaCerrada =
    MAXX(FILTER(ALL('Semanas'[Semana]), 'Semanas'[Semana] < _lunesActual),
         'Semanas'[Semana])
RETURN CALCULATE([Publicaciones nuevas], 'Semanas'[Semana] = _semanaCerrada)

Media cuatro semanas previas =
VAR _lunesActual = TODAY() - WEEKDAY(TODAY(), 2) + 1
VAR _semanaCerrada =
    MAXX(FILTER(ALL('Semanas'[Semana]), 'Semanas'[Semana] < _lunesActual),
         'Semanas'[Semana])
VAR _totalPrevio =
    CALCULATE([Publicaciones nuevas],
        FILTER(ALL('Semanas'[Semana]),
            'Semanas'[Semana] >= _semanaCerrada - 28
            && 'Semanas'[Semana] < _semanaCerrada))
RETURN DIVIDE(_totalPrevio, 4)

Variación frente a cuatro semanas =
DIVIDE([Publicaciones última semana] - [Media cuatro semanas previas],
       [Media cuatro semanas previas])
```

En **Actividad semanal** añade también:

```dax
Publicaciones últimas cinco semanas =
VAR _ultima = MAXX(ALL('Semanas'[Semana]), 'Semanas'[Semana])
VAR _semana = MAX('Semanas'[Semana])
RETURN IF(_semana >= _ultima - 28 && _semana <= _ultima,
          [Publicaciones nuevas])
```

En **Revistas** crea:

```dax
Publicaciones observadas = SUM('Revistas'[Publicaciones])

Porcentaje con ORCID =
DIVIDE(SUM('Revistas'[Con ORCID]), [Publicaciones observadas])

Porcentaje con resumen =
DIVIDE(SUM('Revistas'[Con resumen]), [Publicaciones observadas])

Porcentaje con licencia =
DIVIDE(SUM('Revistas'[Con licencia]), [Publicaciones observadas])
```

En **Editoriales**, **Tipos de documento** y **Ejecuciones**, respectivamente:

```dax
Publicaciones por editorial = SUM('Editoriales'[Publicaciones])

Porcentaje de editorial =
DIVIDE([Publicaciones por editorial],
       CALCULATE([Publicaciones por editorial],
                 REMOVEFILTERS('Editoriales'[Editorial])))

Publicaciones por tipo = SUM('Tipos de documento'[Publicaciones])

Estado última carga =
VAR _estado =
    MAXX(TOPN(1, 'Ejecuciones', 'Ejecuciones'[Fin], DESC),
         'Ejecuciones'[Estado])
RETURN SWITCH(_estado, "Succeeded", "Correcta",
              "Failed", "Fallida", _estado)
```

6. Formatea los recuentos como enteros y los porcentajes con un decimal.
7. En **Settings > Refresh** del modelo, deja activado **Keep your Direct Lake data up to date**. Fabric actualiza automáticamente el encuadre de las tablas Delta cuando detecta cambios; puede existir un pequeño retraso. Si acabas de cargar Gold y no ves datos nuevos, ejecuta una actualización manual del modelo y vuelve a abrir el informe. [Funcionamiento de Direct Lake](https://learn.microsoft.com/fabric/fundamentals/direct-lake-how-it-works#automatic-updates).

**Comprobación:** una tarjeta con `[Publicaciones observadas]` muestra un valor y `[Estado última carga]` indica «Correcta».

## 9. Construir el informe Power BI al final

Desde el **modelo nuevo**, pulsa **Create report** y guarda `Observatorio Crossref - Clase 03` en `04_Informe`. Puedes usar el informe original abierto en otra pestaña y el [proyecto Power BI](../informe/Observatorio_Crossref/Observatorio_Crossref.pbip) como referencia. Verifica en los detalles del informe que su modelo semántico es `SM_Crossref_Observatorio` **del workspace nuevo**. La opción **Save a copy** del informe original no basta para una réplica independiente: conserva la conexión al modelo semántico original, según [Microsoft Learn](https://learn.microsoft.com/power-bi/connect-data/service-datasets-copy-reports).

**Página 1 · Pulso semanal**

1. Añade un segmentador de `Revistas[Revista]`.
2. Arriba coloca cuatro tarjetas: `[Publicaciones observadas]`, `[Publicaciones última semana]`, `[Variación frente a cuatro semanas]` y `[Estado última carga]`.
3. Crea un gráfico de líneas: eje `Semanas[Semana]`, leyenda `Revistas[Revista]`, valor `[Publicaciones últimas cinco semanas]`. La semana en curso es provisional.
4. Crea barras de ranking: eje `Revistas[Revista]`, valor `[Publicaciones última semana]`.
5. Crea una matriz: filas `Revistas[Revista]`, valores `[Publicaciones última semana]`, `[Media cuatro semanas previas]` y `[Variación frente a cuatro semanas]`.

**Página 2 · Composición y metadatos**

1. Crea barras por `Editoriales[Editorial]` con `[Publicaciones por editorial]`; usa `[Porcentaje de editorial]` si quieres mostrar la cuota.
2. Coloca una tarjeta de `[Publicaciones por tipo]` y una nota «100 % journal-article» mientras la selección siga teniendo un solo tipo.
3. Crea una matriz por `Revistas[Revista]` con `[Publicaciones observadas]` y los tres porcentajes de cobertura.
4. Añade tres tarjetas para ORCID, resumen y licencia. Esta página presenta el conjunto observado completo; el filtro de revista se reserva para la primera.
5. Guarda, vuelve a abrir el informe y prueba los visuales y la navegación.

## 10. Las cinco preguntas de negocio y dónde se responden

Las cifras siguientes son la **foto del 21/11/2026** tras una ventana inicial de 70 días. Cambiarán con cada carga. La última semana cerrada empezó el **09/11/2026**.

| Pregunta del documento de requisitos | Respuesta observada | Dónde verla |
| --- | --- | --- |
| 1. ¿Cuántos registros nuevos incorpora cada revista por semana? | Última semana cerrada: **1.723**; Scientific Reports **1.168**, PLOS One **271**, Nature Communications **146**, Nature **90**, Science **48**. | Página 1: línea semanal, barras y tarjeta «Publicaciones última semana». |
| 2. ¿Qué revistas aumentan o reducen su actividad frente a las cuatro semanas anteriores? | Total **+9,9 %** frente a una media de **1.568,25**. Scientific Reports **+26,7 %**; PLOS One **−10,0 %**; Nature Communications **−30,0 %**; Nature **−5,5 %**; Science **+15,7 %**. | Página 1: tarjeta de variación y matriz comparativa. |
| 3. ¿Qué editoriales concentran más publicaciones? | Springer Science and Business Media LLC **20.361 (86,5 %)**; PLoS **2.768 (11,8 %)**; AAAS **404 (1,7 %)**, sobre 23.533 DOI. | Página 2: barras de editoriales. |
| 4. ¿Cómo se distribuyen por tipo de documento? | **23.533 journal-article: 100 %**. Al consultar cinco ISSN de revistas, el tipo no varía en esta muestra. | Página 2: tarjeta y nota de tipo. |
| 5. ¿Qué porcentaje tiene ORCID, resumen y licencia? | Del conjunto: **53,7 %** ORCID (12.629), **40,6 %** resumen (9.554) y **98,3 %** licencia (23.140). | Página 2: tres tarjetas y matriz por revista. |

Estos recuentos miden actividad de metadatos en Crossref; no son una medida de calidad científica ni de impacto. La selección por ISSN y la ventana incremental limitan la población analizada.

## 11. Comprobación final antes de dar la clase por terminada

- Las carpetas contienen el Lakehouse, notebook, pipeline, modelo e informe en su sitio.
- La primera y la segunda ejecución del notebook terminaron con `Succeeded`.
- `silver.publications` cumple `COUNT(*) = COUNT(DISTINCT doi_key)`.
- Existe un watermark y la segunda ejecución lee una ventana incremental con solapamiento.
- Las cinco tablas Gold tienen filas; el pipeline manual terminó bien y su horario diario está **habilitado**.
- El modelo Direct Lake muestra la última carga como «Correcta» y el informe tiene dos páginas que responden la tabla anterior.

Si algo no cuadra, revisa en este orden: salida del notebook, `dbo.crossref_runs`, `dbo.crossref_control`, tablas Gold, historial del pipeline y estado de actualización del modelo.
