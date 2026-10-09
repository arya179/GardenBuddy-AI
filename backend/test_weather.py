import pytest
from fastapi.testclient import TestClient
from main import app
import respx
import httpx

client = TestClient(app)

@respx.mock
def test_search_city_valid():
    respx.get(url__startswith="https://geocoding-api.open-meteo.com/").mock(return_value=httpx.Response(200, json={"results": [{"name": "Ahmedabad"}]}))
    response = client.get("/api/location/search?query=Ahmedabad")
    assert response.status_code == 200
    assert response.json() == [{"name": "Ahmedabad"}]

@respx.mock
def test_search_city_invalid_or_missing():
    # Missing
    response = client.get("/api/location/search?query=")
    assert response.status_code == 400
    # Invalid
    respx.get(url__startswith="https://geocoding-api.open-meteo.com/").mock(return_value=httpx.Response(200, json={}))
    response = client.get("/api/location/search?query=xyz123abc")
    assert response.status_code == 200
    assert response.json() == []

@respx.mock
def test_search_city_timeout():
    respx.get(url__startswith="https://geocoding-api.open-meteo.com/").mock(side_effect=httpx.TimeoutException("Timeout"))
    response = client.get("/api/location/search?query=Ahmedabad")
    assert response.status_code == 504
    assert "timeout" in response.json()["detail"].lower()

@respx.mock
def test_get_weather_valid():
    respx.get(url__startswith="https://api.open-meteo.com/").mock(return_value=httpx.Response(200, json={"current": {"temperature_2m": 30.0}}))
    response = client.get("/api/location/weather?lat=23.0&lon=72.0")
    assert response.status_code == 200
    assert response.json()["current"]["temperature_2m"] == 30.0

@respx.mock
def test_get_weather_malformed_params():
    response = client.get("/api/location/weather?lat=abc&lon=def")
    assert response.status_code == 400
    assert "valid numbers" in response.json()["detail"]

@respx.mock
def test_get_weather_connection_error():
    respx.get(url__startswith="https://api.open-meteo.com/").mock(side_effect=httpx.ConnectError("Connection refused"))
    response = client.get("/api/location/weather?lat=23.0&lon=72.0")
    assert response.status_code == 502
    assert "connection failure" in response.json()["detail"].lower()

@respx.mock
def test_get_weather_rate_limit():
    respx.get(url__startswith="https://api.open-meteo.com/").mock(return_value=httpx.Response(429, json={"error": True, "reason": "Too many requests"}))
    response = client.get("/api/location/weather?lat=23.0&lon=72.0")
    assert response.status_code == 429
    assert "rate limit" in response.json()["detail"].lower()
