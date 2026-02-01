import os
import hashlib
import time
from google.cloud import bigquery
from google.oauth2 import service_account
from dotenv import load_dotenv

load_dotenv()

# Simple in-memory cache with TTL
_query_cache: dict = {}
CACHE_TTL_SECONDS = 300  # 5 minutes


class BigQueryService:
    def __init__(self):
        self.project_id = os.getenv("GOOGLE_CLOUD_PROJECT")
        credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")

        if credentials_path and os.path.exists(credentials_path):
            credentials = service_account.Credentials.from_service_account_file(
                credentials_path,
                scopes=["https://www.googleapis.com/auth/bigquery"]
            )
            self.client = bigquery.Client(project=self.project_id, credentials=credentials)
        else:
            # Fall back to default credentials (gcloud auth)
            self.client = bigquery.Client(project=self.project_id)

    def list_datasets(self) -> list:
        """List all datasets in the project."""
        datasets = list(self.client.list_datasets())
        return [{"id": ds.dataset_id, "full_id": ds.full_dataset_id} for ds in datasets]

    def list_tables(self, dataset_id: str) -> list:
        """List all tables in a dataset."""
        dataset_ref = self.client.dataset(dataset_id)
        tables = list(self.client.list_tables(dataset_ref))
        return [
            {
                "id": table.table_id,
                "type": table.table_type,
                "full_id": f"{dataset_id}.{table.table_id}"
            }
            for table in tables
        ]

    def get_table_schema(self, dataset_id: str, table_id: str) -> list:
        """Get the schema of a table."""
        table_ref = self.client.dataset(dataset_id).table(table_id)
        table = self.client.get_table(table_ref)
        return [
            {
                "name": field.name,
                "type": field.field_type,
                "mode": field.mode,
                "description": field.description
            }
            for field in table.schema
        ]

    def preview_table(self, dataset_id: str, table_id: str, limit: int = 100) -> list:
        """Preview data from a table."""
        query = f"SELECT * FROM `{self.project_id}.{dataset_id}.{table_id}` LIMIT {limit}"
        return self.execute_query(query, limit)

    def execute_query(self, query: str, max_results: int = 1000) -> list:
        """Execute a BigQuery SQL query with caching."""
        # Create cache key from query and max_results
        cache_key = hashlib.md5(f"{query}:{max_results}".encode()).hexdigest()

        # Check cache
        if cache_key in _query_cache:
            cached_time, cached_result = _query_cache[cache_key]
            if time.time() - cached_time < CACHE_TTL_SECONDS:
                return cached_result

        # Execute query
        query_job = self.client.query(query)
        results = query_job.result()

        rows = []
        for row in results:
            rows.append(dict(row))
            if len(rows) >= max_results:
                break

        # Store in cache
        _query_cache[cache_key] = (time.time(), rows)

        # Clean old cache entries (simple cleanup)
        current_time = time.time()
        keys_to_delete = [k for k, (t, _) in _query_cache.items() if current_time - t > CACHE_TTL_SECONDS * 2]
        for k in keys_to_delete:
            del _query_cache[k]

        return rows
