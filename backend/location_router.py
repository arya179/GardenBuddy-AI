from fastapi import APIRouter, HTTPException
import httpx

router = APIRouter()

@router.get("/search")
async def search_city(query: str):
    if not query:
        return []
    
    url = f"https://geocoding-api.open-meteo.com/v1/search?name={query}&count=5&language=en&format=json"
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, timeout=5.0)
            response.raise_for_status()
            data = response.json()
            results = data.get("results", [])
            return results
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
