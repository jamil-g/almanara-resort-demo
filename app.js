// 1) Put your Mapbox token here
mapboxgl.accessToken = 'pk.eyJ1IjoiamFtaWxnIiwiYSI6ImNqd2cweTAyaTBobTU0YnBoajl5azhpb2UifQ.yZjJFnSf2UFlGfyEkk_I8g';

// Approximate hotel center. Adjust after you load your exact boundary/POI layer.
const HOTEL = {
  name: 'Al Manara, a Luxury Collection Hotel, Saraya Aqaba',
  lng: 34.9940,
  lat: 29.5360,
  zoom: 17.2,
  bearing: -28,
  pitch: 64
};

const AQABA = { lng: 35.006, lat: 29.532, zoom: 13.2, bearing: 0, pitch: 45 };

function standardStyle(show3d) {
  return {
    version: 8,
    imports: [{ id: 'basemap', url: 'mapbox://styles/mapbox/standard', config: { show3dObjects: show3d } }],
    sources: {},
    layers: []
  };
}

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/light-v11',
  center: [HOTEL.lng, HOTEL.lat],
  zoom: HOTEL.zoom,
  bearing: HOTEL.bearing,
  pitch: HOTEL.pitch,
  antialias: true,
  hash: true
});

map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'bottom-right');
map.addControl(new mapboxgl.FullscreenControl(), 'bottom-right');
map.addControl(new mapboxgl.ScaleControl({ maxWidth: 120, unit: 'metric' }), 'bottom-left');

let photoMode = true;
let is3D = true;
let mapStyle = 'light'; // 'standard' | 'satellite' | 'light'
let cityBldgVisible = false;

map.on('style.load', async () => {
  try { map.setConfigProperty('basemap', 'lightPreset', 'dusk'); } catch {}
  try { map.setConfigProperty('basemap', 'showPointOfInterestLabels', true); } catch {}
  try { map.setConfigProperty('basemap', 'showRoadLabels', true); } catch {}
  try { map.setConfigProperty('basemap', 'showPlaceLabels', true); } catch {}

  if (mapStyle === 'standard') addTerrain();
  addSkyLayer();
  await addResortLayers();
  setCityBuildings(cityBldgVisible);
  await loadWeather();
  setSunByHour(12);
});

function addTerrain() {
  if (!map.getSource('mapbox-dem')) {
    map.addSource('mapbox-dem', {
      type: 'raster-dem',
      url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
      tileSize: 512,
      maxzoom: 14
    });
  }
  map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.15 });
}

function addSkyLayer() {
  if (!map.getLayer('sky')) {
    map.addLayer({
      id: 'sky',
      type: 'sky',
      paint: {
        'sky-type': 'atmosphere',
        'sky-atmosphere-sun-intensity': 18,
        'sky-atmosphere-halo-color': 'rgba(255, 196, 123, 1)',
        'sky-atmosphere-color': 'rgba(132, 181, 255, 1)'
      }
    });
  }
}

async function addResortLayers() {
  // Your manual layers. Replace files later; app will keep working.
  map.addSource('resort-boundary', { type: 'geojson', data: 'data/resort-boundary.geojson' });
  map.addSource('resort-poi', { type: 'geojson', data: 'data/resort-poi.geojson' });
  map.addSource('resort-buildings', { type: 'geojson', data: 'data/resort_bldg.geojson' });

  map.addLayer({
    id: 'resort-boundary-fill',
    type: 'fill',
    source: 'resort-boundary',
    paint: { 'fill-color': '#e7bd73', 'fill-opacity': 0.16 }
  });

  map.addLayer({
    id: 'resort-boundary-line',
    type: 'line',
    source: 'resort-boundary',
    paint: { 'line-color': '#e7bd73', 'line-width': 3, 'line-opacity': 0.95 }
  });

  map.addLayer({
    id: 'resort-highlight-extrusion',
    type: 'fill-extrusion',
    source: 'resort-boundary',
    paint: {
      'fill-extrusion-color': '#e7bd73',
      'fill-extrusion-height': 1,
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 0.10
    }
  });

  const BLDG_COLOR = ['match', ['get', 'type'],
    0, '#e7bd73',
    1, '#f4a261',
    2, '#e05c5c',
    3, '#94a3b8',
    4, '#c084fc',
    5, '#38bdf8',
    6, '#4ade80',
    '#e7bd73'
  ];

  const bldgLayer = {
    id: 'resort-buildings-extrusion',
    type: 'fill-extrusion',
    source: 'resort-buildings',
    paint: {
      'fill-extrusion-color': BLDG_COLOR,
      'fill-extrusion-height': ['case',
        ['>', ['coalesce', ['get', 'Height'], 0], 0],
        ['*', ['coalesce', ['get', 'Height'], 0], 1.5],
        0.5
      ],
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 0.95,
      'fill-extrusion-vertical-gradient': true,
      'fill-extrusion-ambient-occlusion-intensity': 0.35,
      'fill-extrusion-ambient-occlusion-radius': 3.0
    }
  };
  if (mapStyle === 'standard') bldgLayer.slot = 'middle';
  map.addLayer(bldgLayer);

  map.addLayer({
    id: 'resort-buildings-labels',
    type: 'symbol',
    source: 'resort-buildings',
    minzoom: 16.5,
    layout: {
      'text-field': ['get', 'name'],
      'text-size': 11,
      'text-anchor': 'center'
    },
    paint: {
      'text-color': '#ffffff',
      'text-halo-color': '#09131d',
      'text-halo-width': 1.2
    }
  });

  map.addLayer({
    id: 'resort-poi-points',
    type: 'circle',
    source: 'resort-poi',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 3, 17, 6],
      'circle-color': ['match', ['get', 'type'], 7, '#fbbf24', 8, '#f87171', 9, '#22d3ee', '#e7bd73'],
      'circle-stroke-color': '#101926',
      'circle-stroke-width': 2
    }
  });

  map.addLayer({
    id: 'resort-poi-labels',
    type: 'symbol',
    source: 'resort-poi',
    minzoom: 15,
    layout: {
      'text-field': ['get', 'name'],
      'text-size': 12,
      'text-offset': [0, 1.25],
      'text-anchor': 'top'
    },
    paint: {
      'text-color': '#f7f4ec',
      'text-halo-color': '#09131d',
      'text-halo-width': 1.5
    }
  });

  map.on('click', 'resort-poi-points', (e) => {
    const f = e.features[0];
    const p = f.properties;
    const coords = f.geometry.coordinates.slice();
    const POI_IMGS = {
      7: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=900&auto=format&fit=crop',
      9: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=900&auto=format&fit=crop'
    };
    const image = p.image || POI_IMGS[p.type] || 'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=900&auto=format&fit=crop';
    const link = p.link || 'https://www.marriott.com/en-us/hotels/aqjlc-al-manara-a-luxury-collection-hotel-saraya-aqaba/overview/';
    const events = p.events || link;
    const gallery = p.gallery || link;

    const html = `
      <div class="popup-card">
        ${photoMode ? `<img src="${image}" alt="${escapeHtml(p.name)}">` : ''}
        <div class="popup-body">
          <h3>${escapeHtml(p.name || 'Resort Area')}</h3>
          <p>${escapeHtml(p.description || 'Explore this point of interest inside the resort experience.')}</p>
          <div class="popup-links">
            <a href="${link}" target="_blank">Details</a>
            <a href="${gallery}" target="_blank">Gallery</a>
            <a href="${events}" target="_blank">Events</a>
          </div>
        </div>
      </div>`;
    new mapboxgl.Popup({ offset: 18 }).setLngLat(coords).setHTML(html).addTo(map);
  });

  map.on('mouseenter', 'resort-poi-points', () => map.getCanvas().style.cursor = 'pointer');
  map.on('mouseleave', 'resort-poi-points', () => map.getCanvas().style.cursor = '');

  const BLDG_TYPE_NAME = { 0: 'Hotel', 1: 'Bar / Cantina', 2: 'Restaurant', 3: 'Passage', 4: 'Villa', 5: 'Pool', 6: 'Spa' };

  map.on('click', 'resort-buildings-extrusion', (e) => {
    if (!e.features.length) return;
    const f = e.features[0];
    const p = f.properties;
    const link = p.page_url || 'https://www.marriott.com/en-us/hotels/aqjlc-al-manara-a-luxury-collection-hotel-saraya-aqaba/overview/';
    const hours = (p.openhour && p.openhour !== '00:00:00') ? `<p style="color:var(--muted);margin:0 0 10px">${escapeHtml(p.openhour)} – ${escapeHtml(p.closehour)}</p>` : '';
    const html = `
      <div class="popup-card">
        <div class="popup-body">
          <h3>${escapeHtml(p.name || 'Building')}</h3>
          <p>${escapeHtml(BLDG_TYPE_NAME[p.type] || 'Building')}${p.floors ? ' · ' + p.floors + ' floor' + (p.floors !== 1 ? 's' : '') : ''}</p>
          ${p.description ? `<p>${escapeHtml(p.description)}</p>` : ''}
          ${hours}
          <div class="popup-links"><a href="${link}" target="_blank">Details</a></div>
        </div>
      </div>`;
    new mapboxgl.Popup({ offset: 12 }).setLngLat(e.lngLat).setHTML(html).addTo(map);
  });

  map.on('mouseenter', 'resort-buildings-extrusion', () => map.getCanvas().style.cursor = 'pointer');
  map.on('mouseleave', 'resort-buildings-extrusion', () => map.getCanvas().style.cursor = '');
}

async function loadWeather() {
  const lat = HOTEL.lat, lng = HOTEL.lng;
  const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,is_day&daily=sunrise,sunset&timezone=auto`;
  const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lng}&hourly=sea_surface_temperature,wave_height,ocean_current_velocity,ocean_current_direction&timezone=auto&forecast_days=1`;

  try {
    const [weather, marine] = await Promise.all([
      fetch(forecastUrl).then(r => r.json()),
      fetch(marineUrl).then(r => r.json()).catch(() => null)
    ]);

    const current = weather.current || {};
    const m = pickClosestMarine(marine);
    const sunset = weather.daily?.sunset?.[0]?.split('T')?.[1] || '—';

    document.getElementById('weatherGrid').className = 'weather-grid';
    document.getElementById('weatherGrid').innerHTML = `
      ${metric('Air', fmt(current.temperature_2m, '°C'))}
      ${metric('Feels', fmt(current.apparent_temperature, '°C'))}
      ${metric('Sea', fmt(m?.sea_surface_temperature, '°C'))}
      ${metric('Wind', `${fmt(current.wind_speed_10m, ' km/h')} ${degToCompass(current.wind_direction_10m)}`)}
      ${metric('Gusts', fmt(current.wind_gusts_10m, ' km/h'))}
      ${metric('Waves', fmt(m?.wave_height, ' m'))}
      ${metric('Current', fmt(m?.ocean_current_velocity, ' km/h'))}
      ${metric('Sunset', sunset)}
    `;
  } catch (err) {
    document.getElementById('weatherGrid').innerHTML = 'Weather data unavailable. Check internet/API access.';
  }
}

function pickClosestMarine(marine) {
  if (!marine?.hourly?.time?.length) return null;
  const now = new Date();
  let bestIdx = 0, bestDiff = Infinity;
  marine.hourly.time.forEach((t, i) => {
    const diff = Math.abs(new Date(t).getTime() - now.getTime());
    if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
  });
  const out = {};
  Object.keys(marine.hourly).forEach(k => { if (k !== 'time') out[k] = marine.hourly[k]?.[bestIdx]; });
  return out;
}

function metric(label, value) { return `<div class="metric"><div class="label">${label}</div><div class="value">${value ?? '—'}</div></div>`; }
function fmt(v, suffix='') { return (v === undefined || v === null || Number.isNaN(v)) ? '—' : `${Math.round(v * 10) / 10}${suffix}`; }
function degToCompass(deg) {
  if (deg === undefined || deg === null) return '';
  const dirs = ['N','NE','E','SE','S','SW','W','NW'];
  return dirs[Math.round(deg / 45) % 8];
}
function escapeHtml(s='') { return String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

function flyTo(view) { map.flyTo({ center: [view.lng, view.lat], zoom: view.zoom, bearing: view.bearing, pitch: view.pitch, duration: 1600, essential: true }); }

function setCityBuildings(visible) {
  cityBldgVisible = visible;
  try { map.setConfigProperty('basemap', 'show3dObjects', visible); } catch {}
}

function setSunByHour(hour) {
  document.getElementById('sunHour').textContent = `${String(hour).padStart(2, '0')}:00`;
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  const pos = SunCalc.getPosition(d, HOTEL.lat, HOTEL.lng);
  const azimuthDeg = (pos.azimuth * 180 / Math.PI) + 180;
  const altitudeDeg = Math.max(0, pos.altitude * 180 / Math.PI);
  const polar = Math.max(mapStyle === 'standard' ? 15 : 45, 90 - altitudeDeg);

  if (mapStyle === 'standard') {
    // Standard style: GL JS v3 PBR handles intensity well at any level
    const intensity = altitudeDeg > 0 ? 0.65 : 0.25;
    try { map.setLights([{ id: 'sun', type: 'directional', properties: { direction: [azimuthDeg, polar], intensity, 'cast-shadows': true } }]); } catch {}
    const preset = hour < 6 ? 'night' : hour < 10 ? 'dawn' : hour < 16 ? 'day' : hour < 19 ? 'dusk' : 'night';
    try { map.setConfigProperty('basemap', 'lightPreset', preset); } catch {}
  } else {
    // Classic styles (light-v11, satellite): set intensity to 0 so illumination = 1.0 on every face.
    // Colours stay fully saturated; 3D depth is read from viewing angle + extrusion height, not shading.
    try { map.setLight({ anchor: 'map', color: '#ffffff', position: [1.5, azimuthDeg, polar], intensity: 0 }); } catch {}
  }

  if (map.getLayer('sky')) {
    map.setPaintProperty('sky', 'sky-atmosphere-sun', [azimuthDeg, altitudeDeg]);
    map.setPaintProperty('sky', 'sky-atmosphere-sun-intensity', altitudeDeg > 0 ? 18 : 4);
  }
}

document.getElementById('homeBtn').onclick = () => flyTo(HOTEL);
document.getElementById('cityBtn').onclick = () => flyTo(AQABA);
document.getElementById('pitchBtn').onclick = () => {
  is3D = !is3D;
  map.easeTo({ pitch: is3D ? 64 : 0, bearing: is3D ? HOTEL.bearing : 0, duration: 900 });
};

const STYLE_CYCLE = ['light', 'standard', 'satellite'];
const STYLE_LABELS = { standard: 'Standard', satellite: 'Satellite', light: 'Light Map' };
function getMapStyle(mode) {
  if (mode === 'satellite') return 'mapbox://styles/mapbox/satellite-streets-v12';
  if (mode === 'light') return 'mapbox://styles/mapbox/light-v11';
  return standardStyle(cityBldgVisible);
}
function updateStyleBtn() {
  document.getElementById('styleBtn').textContent = STYLE_LABELS[mapStyle];
  const city3dRow = document.getElementById('city3dToggle').closest('label');
  if (mapStyle === 'light') {
    city3dRow.title = 'Not available in Light Map mode';
    city3dRow.style.opacity = '0.38';
    document.getElementById('city3dToggle').disabled = true;
  } else {
    city3dRow.title = '';
    city3dRow.style.opacity = '';
    document.getElementById('city3dToggle').disabled = false;
  }
}
document.getElementById('styleBtn').onclick = () => {
  mapStyle = STYLE_CYCLE[(STYLE_CYCLE.indexOf(mapStyle) + 1) % STYLE_CYCLE.length];
  map.setStyle(getMapStyle(mapStyle));
  updateStyleBtn();
};
updateStyleBtn();
document.getElementById('sunSlider').oninput = (e) => setSunByHour(Number(e.target.value));
document.getElementById('sunsetBtn').onclick = () => { document.getElementById('sunSlider').value = 18; setSunByHour(18); flyTo({ ...HOTEL, zoom: 16.8, pitch: 72, bearing: -65 }); };

document.getElementById('walkBtn').onclick = async () => {
  map.flyTo({ center: [35.0018, 29.5338], zoom: 15.4, pitch: 62, bearing: 12, duration: 1400, essential: true });
  await wait(1450);
  map.flyTo({ center: [HOTEL.lng, HOTEL.lat], zoom: 17.4, pitch: 68, bearing: -32, duration: 2200, essential: true });
};
document.getElementById('poiToggle').onchange = (e) => ['resort-poi-points','resort-poi-labels'].forEach(id => map.setLayoutProperty(id, 'visibility', e.target.checked ? 'visible' : 'none'));
document.getElementById('boundaryToggle').onchange = (e) => ['resort-boundary-fill','resort-boundary-line','resort-highlight-extrusion'].forEach(id => map.setLayoutProperty(id, 'visibility', e.target.checked ? 'visible' : 'none'));
document.getElementById('buildingToggle').onchange = (e) => ['resort-buildings-extrusion','resort-buildings-labels'].forEach(id => map.setLayoutProperty(id, 'visibility', e.target.checked ? 'visible' : 'none'));
document.getElementById('city3dToggle').onchange = (e) => setCityBuildings(e.target.checked);
document.getElementById('photoToggle').onchange = (e) => photoMode = e.target.checked;
document.getElementById('labelsToggle').onchange = (e) => {
  const v = e.target.checked;
  try {
    map.setConfigProperty('basemap', 'showPointOfInterestLabels', v);
    map.setConfigProperty('basemap', 'showRoadLabels', v);
    map.setConfigProperty('basemap', 'showPlaceLabels', v);
  } catch {}
};

document.querySelectorAll('.module').forEach(btn => {
  btn.onclick = () => {
    const text = {
      'Events': "Future add-on: today's events, live entertainment, beach club calendar and private guest invitations.",
      'Dining': "Future add-on: restaurants, opening hours, table booking links and chef recommendations by location.",
      'Activities': "Future add-on: beach activities, lagoon experiences, spa offers, kids/family routes and seasonal packages.",
      'Guest Navigation': "Future add-on: walking routes from room to pool, beach, spa, dining and reception with QR access."
    }[btn.dataset.module];
    document.getElementById('moduleHint').textContent = text;
  };
});

function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
