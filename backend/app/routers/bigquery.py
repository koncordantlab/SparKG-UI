from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.services.bigquery_service import BigQueryService

router = APIRouter()
bq_service = BigQueryService()


class QueryRequest(BaseModel):
    query: str
    max_results: Optional[int] = 1000


@router.get("/datasets")
async def list_datasets():
    """List all datasets in the project."""
    try:
        datasets = bq_service.list_datasets()
        return {"datasets": datasets}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/datasets/{dataset_id}/tables")
async def list_tables(dataset_id: str):
    """List all tables in a dataset."""
    try:
        tables = bq_service.list_tables(dataset_id)
        return {"tables": tables}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/datasets/{dataset_id}/tables/{table_id}/schema")
async def get_table_schema(dataset_id: str, table_id: str):
    """Get the schema of a table."""
    try:
        schema = bq_service.get_table_schema(dataset_id, table_id)
        return {"schema": schema}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/datasets/{dataset_id}/tables/{table_id}/preview")
async def preview_table(dataset_id: str, table_id: str, limit: int = 100):
    """Preview data from a table."""
    try:
        data = bq_service.preview_table(dataset_id, table_id, limit)
        return {"data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/query")
async def execute_query(request: QueryRequest):
    """Execute a custom BigQuery SQL query."""
    try:
        results = bq_service.execute_query(request.query, request.max_results)
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
