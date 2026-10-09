import httpx
import asyncio

async def test_weather():
    url = "https://api.open-meteo.com/v1/forecast?latitude=23.03&longitude=72.58&current=temperature_2m,relative_humidity_2m,precipitation,weather_code&daily=precipitation_probability_max,temperature_2m_max,temperature_2m_min&timezone=auto"
    async with httpx.AsyncClient() as client:
        res = await client.get(url)
        print(res.json())

asyncio.run(test_weather())
