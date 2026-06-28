# Al Manara 3D Resort Experience

## Setup
1. Open `app.js`.
2. Replace `PUT_YOUR_MAPBOX_TOKEN_HERE` with your Mapbox public token.
3. Run locally:
   ```bash
   python -m http.server 8060
   ```
4. Open: http://localhost:8060

## Edit your GIS layers
- `data/resort-poi.geojson` — points of interest with name, description, image, link, gallery, events.
- `data/resort-boundary.geojson` — resort boundary or building footprints. Add `height_m` to extrude in 3D.

## Weather
Uses Open-Meteo Forecast API for air/wind/sunrise/sunset and Open-Meteo Marine API for sea surface temperature, wave height and current.
