"""Notebook de Fabric: Crossref -> Bronze -> Silver -> Gold con watermark.

Este archivo es el contenido de una celda de NB_Crossref_Incremental.
Requiere LH_Crossref_Publicaciones como Lakehouse predeterminado.
"""

import json
import time
import uuid
from datetime import date, datetime, timedelta, timezone

import notebookutils
import requests
from delta.tables import DeltaTable
from pyspark.sql import Window, functions as F
from pyspark.sql.types import (
    BooleanType,
    DateType,
    IntegerType,
    StringType,
    StructField,
    StructType,
    TimestampType,
)


JOURNALS = {
    "0028-0836": "Nature",
    "0036-8075": "Science",
    "1932-6203": "PLOS One",
    "2045-2322": "Scientific Reports",
    "2041-1723": "Nature Communications",
}
PROCESS = "crossref_five_journals"
ROWS_PER_PAGE = 500
MAX_PAGES_PER_JOURNAL = 200
OVERLAP = timedelta(hours=24)
INITIAL_HISTORY = timedelta(days=70)
REQUEST_INTERVAL_SECONDS = 1.15  # Pool publico: maximo una consulta de lista por segundo.


def utc_now():
    return datetime.now(timezone.utc)


def crossref_time(value):
    timestamp_ms = (value or {}).get("timestamp")
    return datetime.fromtimestamp(timestamp_ms / 1000, timezone.utc) if timestamp_ms else None


def first_text(value):
    return str(value[0]) if isinstance(value, list) and value else None


def publication_date(value):
    parts = (value or {}).get("date-parts") or []
    first = parts[0] if parts else []
    year = int(first[0]) if first else None
    if len(first) >= 3:
        try:
            return year, date(year, int(first[1]), int(first[2]))
        except (TypeError, ValueError):
            pass
    return year, None


def normalize(item, issn, run_id, ingested_at):
    doi = (item.get("DOI") or "").strip()
    if not doi:
        return None
    authors = item.get("author") or []
    if not isinstance(authors, list):
        authors = []
    pub_year, pub_date = publication_date(item.get("published"))
    return (
        doi.lower(), doi, issn, JOURNALS[issn], first_text(item.get("title")),
        item.get("publisher"), item.get("type"), pub_year, pub_date,
        crossref_time(item.get("created")), crossref_time(item.get("deposited")),
        item.get("URL"), len(authors), any(bool(a.get("ORCID")) for a in authors),
        bool(item.get("abstract")), bool(item.get("license")), run_id, ingested_at,
    )


SILVER_SCHEMA = StructType([
    StructField("doi_key", StringType(), False),
    StructField("doi", StringType(), False),
    StructField("issn", StringType(), False),
    StructField("journal_name", StringType(), False),
    StructField("title", StringType(), True),
    StructField("publisher", StringType(), True),
    StructField("work_type", StringType(), True),
    StructField("publication_year", IntegerType(), True),
    StructField("publication_date", DateType(), True),
    StructField("created_at", TimestampType(), True),
    StructField("deposited_at", TimestampType(), True),
    StructField("url", StringType(), True),
    StructField("author_count", IntegerType(), False),
    StructField("has_orcid", BooleanType(), False),
    StructField("has_abstract", BooleanType(), False),
    StructField("has_license", BooleanType(), False),
    StructField("last_run_id", StringType(), False),
    StructField("ingested_at", TimestampType(), False),
])

BRONZE_SCHEMA = StructType([
    StructField("run_id", StringType(), False),
    StructField("issn", StringType(), False),
    StructField("page_number", IntegerType(), False),
    StructField("row_count", IntegerType(), False),
    StructField("ingested_at", TimestampType(), False),
    StructField("raw_json", StringType(), False),
])

RUN_SCHEMA = StructType([
    StructField("run_id", StringType(), False),
    StructField("started_at", TimestampType(), False),
    StructField("finished_at", TimestampType(), False),
    StructField("window_start_utc", StringType(), False),
    StructField("window_end_utc", StringType(), False),
    StructField("pages", IntegerType(), False),
    StructField("rows_read", IntegerType(), False),
    StructField("rows_valid", IntegerType(), False),
    StructField("status", StringType(), False),
    StructField("error", StringType(), True),
])


def append_run(run_id, started_at, start, end, pages, rows_read, rows_valid, status, error=None):
    row = (run_id, started_at, utc_now(), start, end, pages, rows_read,
           rows_valid, status, str(error)[:1000] if error else None)
    (spark.createDataFrame([row], RUN_SCHEMA).write.format("delta")
     .mode("append").saveAsTable("dbo.crossref_runs"))


last_request_at = 0.0
session = requests.Session()
session.headers.update({"User-Agent": "DataDays03-Crossref-Class/1.0 (educational)"})


def fetch_page(issn, start, end, cursor):
    global last_request_at
    url = f"https://api.crossref.org/journals/{issn}/works"
    params = {
        "filter": f"from-update-date:{start},until-update-date:{end}",
        "rows": ROWS_PER_PAGE,
        "cursor": cursor,
        "select": "DOI,title,author,container-title,publisher,type,published,created,deposited,URL,license,abstract,ISSN",
    }
    for attempt in range(5):
        wait = REQUEST_INTERVAL_SECONDS - (time.monotonic() - last_request_at)
        if wait > 0:
            time.sleep(wait)
        last_request_at = time.monotonic()
        response = session.get(url, params=params, timeout=90)
        if response.status_code in (429, 500, 502, 503, 504):
            retry_after = response.headers.get("Retry-After", "")
            delay = float(retry_after) if retry_after.isdigit() else min(2 ** attempt, 30)
            time.sleep(delay)
            continue
        response.raise_for_status()
        return response.json()
    raise RuntimeError(f"Crossref no respondio tras cinco intentos: ISSN {issn}")


for schema_name in ("bronze", "silver", "gold"):
    spark.sql(f"CREATE SCHEMA IF NOT EXISTS {schema_name}")

run_id = str(uuid.uuid4())
started_at = utc_now()
window_end = started_at
if spark.catalog.tableExists("dbo.crossref_control"):
    state = (spark.table("dbo.crossref_control")
             .where(F.col("process_name") == PROCESS).limit(1).collect())
else:
    state = []
previous_watermark = (datetime.fromisoformat(state[0]["watermark_utc"].replace("Z", "+00:00"))
                      if state else None)
window_start = ((previous_watermark - OVERLAP) if previous_watermark
                else (window_end - INITIAL_HISTORY))
start_text = window_start.strftime("%Y-%m-%dT%H:%M:%S")
end_text = window_end.strftime("%Y-%m-%dT%H:%M:%S")
print(f"run_id={run_id}; ventana UTC={start_text} -> {end_text}; inicial={not bool(state)}")

raw_pages = []
normalized = []
page_count = 0
rows_read = 0
try:
    for issn in JOURNALS:
        cursor = "*"
        for page_number in range(1, MAX_PAGES_PER_JOURNAL + 1):
            payload = fetch_page(issn, start_text, end_text, cursor)
            message = payload.get("message") or {}
            items = message.get("items") or []
            raw_json = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
            path = (f"Files/bronze/crossref/run_id={run_id}/issn={issn}/"
                    f"page_{page_number:04d}.json")
            if not notebookutils.fs.put(path, raw_json, False):
                raise RuntimeError(f"No se pudo guardar {path}")
            raw_pages.append((run_id, issn, page_number, len(items), utc_now(), raw_json))
            page_count += 1
            rows_read += len(items)
            for item in items:
                row = normalize(item, issn, run_id, utc_now())
                if row:
                    normalized.append(row)
            print(f"{issn}: pagina {page_number}, {len(items)} registros")
            if len(items) < ROWS_PER_PAGE:
                break
            cursor = message.get("next-cursor")
            if not cursor:
                raise RuntimeError(f"Falta next-cursor para ISSN {issn}, pagina {page_number}")
        else:
            raise RuntimeError(f"Se alcanzo el limite de paginas para ISSN {issn}")

    (spark.createDataFrame(raw_pages, BRONZE_SCHEMA).write.format("delta")
     .mode("append").saveAsTable("bronze.crossref_raw_pages"))
    if spark.table("bronze.crossref_raw_pages").where(F.col("run_id") == run_id).agg(
            F.sum("row_count")).first()[0] != rows_read:
        raise RuntimeError("La validacion de recuento Bronze fallo")

    valid_df = spark.createDataFrame(normalized, SILVER_SCHEMA)
    order = Window.partitionBy("doi_key").orderBy(
        F.col("deposited_at").desc_nulls_last(), F.col("ingested_at").desc())
    latest_df = (valid_df.withColumn("rn", F.row_number().over(order))
                 .where("rn = 1").drop("rn"))
    rows_valid = latest_df.count()
    if rows_valid == 0 and not spark.catalog.tableExists("silver.publications"):
        raise RuntimeError("La carga inicial no produjo DOI validos")
    if rows_valid:
        if not spark.catalog.tableExists("silver.publications"):
            latest_df.write.format("delta").mode("overwrite").saveAsTable("silver.publications")
        else:
            (DeltaTable.forName(spark, "silver.publications").alias("t")
             .merge(latest_df.alias("s"), "t.doi_key = s.doi_key")
             .whenMatchedUpdateAll(condition="s.deposited_at >= t.deposited_at OR t.deposited_at IS NULL")
             .whenNotMatchedInsertAll().execute())

    weekly = (spark.table("silver.publications")
              .where(F.col("created_at").isNotNull())
              .withColumn("week_start", F.to_date(F.date_trunc("week", F.col("created_at"))))
              .groupBy("issn", "journal_name", "week_start")
              .agg(F.count("*").alias("new_publications"),
                   F.sum(F.col("has_orcid").cast("int")).alias("with_orcid"),
                   F.sum(F.col("has_abstract").cast("int")).alias("with_abstract"),
                   F.sum(F.col("has_license").cast("int")).alias("with_license")))
    if not spark.catalog.tableExists("gold.journal_weekly_activity"):
        weekly.write.format("delta").mode("overwrite").saveAsTable("gold.journal_weekly_activity")
    else:
        (DeltaTable.forName(spark, "gold.journal_weekly_activity").alias("t")
         .merge(weekly.alias("s"), "t.issn = s.issn AND t.week_start = s.week_start")
         .whenMatchedUpdateAll(condition="t.new_publications <> s.new_publications OR t.with_orcid <> s.with_orcid OR t.with_abstract <> s.with_abstract OR t.with_license <> s.with_license")
         .whenNotMatchedInsertAll().execute())

    publications = spark.table("silver.publications")
    publisher_summary = (publications
                         .withColumn("publisher_name", F.coalesce("publisher", F.lit("Sin editorial")))
                         .groupBy("publisher_name")
                         .agg(F.count("*").alias("publications")))
    (publisher_summary.write.format("delta").mode("overwrite")
     .saveAsTable("gold.publisher_summary"))

    document_type_summary = (publications
                             .withColumn("document_type", F.coalesce("work_type", F.lit("Sin tipo")))
                             .groupBy("issn", "journal_name", "document_type")
                             .agg(F.count("*").alias("publications")))
    (document_type_summary.write.format("delta").mode("overwrite")
     .saveAsTable("gold.document_type_summary"))

    journal_quality_summary = (publications.groupBy("issn", "journal_name")
                               .agg(F.count("*").alias("publications"),
                                    F.sum(F.col("has_orcid").cast("int")).alias("with_orcid"),
                                    F.sum(F.col("has_abstract").cast("int")).alias("with_abstract"),
                                    F.sum(F.col("has_license").cast("int")).alias("with_license")))
    (journal_quality_summary.write.format("delta").mode("overwrite")
     .saveAsTable("gold.journal_quality_summary"))

    week_bounds = weekly.agg(F.min("week_start"), F.max("week_start")).first()
    if week_bounds[0] is not None:
        calendar_weeks = spark.sql(
            f"SELECT explode(sequence(date('{week_bounds[0]}'), "
            f"date('{week_bounds[1]}'), interval 7 days)) AS week_start"
        )
        calendar_weeks = (calendar_weeks
                          .withColumn("year", F.year("week_start"))
                          .withColumn("week_number", F.weekofyear("week_start")))
        (calendar_weeks.write.format("delta").mode("overwrite")
         .saveAsTable("gold.calendar_week"))

    watermark_text = window_end.isoformat(timespec="seconds").replace("+00:00", "Z")
    control_schema = StructType([
        StructField("process_name", StringType(), False),
        StructField("watermark_utc", StringType(), False),
        StructField("last_run_id", StringType(), False),
        StructField("updated_at", TimestampType(), False),
    ])
    control_df = spark.createDataFrame([(PROCESS, watermark_text, run_id, utc_now())], control_schema)
    if not spark.catalog.tableExists("dbo.crossref_control"):
        control_df.write.format("delta").mode("overwrite").saveAsTable("dbo.crossref_control")
    else:
        (DeltaTable.forName(spark, "dbo.crossref_control").alias("t")
         .merge(control_df.alias("s"), "t.process_name = s.process_name")
         .whenMatchedUpdateAll().whenNotMatchedInsertAll().execute())
    append_run(run_id, started_at, start_text, end_text, page_count,
               rows_read, rows_valid, "Succeeded")
    print(json.dumps({"run_id": run_id, "status": "Succeeded", "pages": page_count,
                      "rows_read": rows_read, "distinct_dois": rows_valid,
                      "watermark_utc": watermark_text}, ensure_ascii=False))
except Exception as error:
    try:
        append_run(run_id, started_at, start_text, end_text, page_count,
                   rows_read, len(normalized), "Failed", error)
    except Exception as log_error:
        print(f"No se pudo registrar el fallo: {log_error}")
    raise
