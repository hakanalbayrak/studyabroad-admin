const https = require('https');
const db = require('../db');

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function httpsGetJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': 'StudyAbroadAdmin/1.0 (study abroad platform; contact via site)', ...headers }
    }, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch (e) { reject(new Error('Bad JSON from ' + new URL(url).hostname)); }
      });
    }).on('error', reject);
  });
}

function httpsPostJson(hostname, path, headers, bodyObj) {
  const body = JSON.stringify(bodyObj);
  return new Promise((resolve, reject) => {
    const rq = https.request({
      hostname, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), ...headers }
    }, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => {
        try { resolve({ status: r.statusCode, body: JSON.parse(d) }); }
        catch (e) { resolve({ status: r.statusCode, body: {} }); }
      });
    });
    rq.on('error', reject);
    rq.write(body);
    rq.end();
  });
}

// ── Query cleaning ────────────────────────────────────────────────────────────
// Only strips parenthetical agency codes like "(EB UK)", "(TBS)", "(ECFY)".
// Does NOT strip " - City" suffixes so "SRH University - Heidelberg" keeps
// its campus city.
function cleanName(name) {
  return String(name || '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── City extraction from Google Places addressComponents ──────────────────────
function extractCity(addressComponents) {
  if (!Array.isArray(addressComponents)) return null;
  const pick = types => {
    const c = addressComponents.find(a => a.types && types.some(t => a.types.includes(t)));
    return c ? c.longText : null;
  };
  return pick(['locality']) || pick(['postal_town']) || pick(['administrative_area_level_2']) || pick(['administrative_area_level_1']) || null;
}

// ── Google Places Text Search (Places API New) ────────────────────────────────
async function googleTextSearch(query) {
  const key = process.env.GOOGLE_MAPS_KEY;
  if (!key) return null;
  const { status, body } = await httpsPostJson(
    'places.googleapis.com',
    '/v1/places:searchText',
    {
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'places.location,places.displayName,places.formattedAddress,places.addressComponents'
    },
    { textQuery: query }
  );
  if (status !== 200) return null;
  const p = body.places && body.places[0];
  if (!p || !p.location) return null;
  return {
    lat: p.location.latitude,
    lng: p.location.longitude,
    city: extractCity(p.addressComponents),
    display: (p.displayName && p.displayName.text) || p.formattedAddress || query,
    source: 'google'
  };
}

// ── Nominatim (free OSM fallback) ─────────────────────────────────────────────
async function nominatimSearch(query) {
  const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(query);
  return httpsGetJson(url);
}

async function nominatimResolve(query) {
  const results = await nominatimSearch(query);
  if (results && results[0]) {
    return {
      lat: parseFloat(results[0].lat),
      lng: parseFloat(results[0].lon),
      city: null,
      display: results[0].display_name,
      source: 'osm'
    };
  }
  return null;
}

// ── Main resolver ─────────────────────────────────────────────────────────────
// Priority order:
// 1. Google: original full name + country   (keeps "SRH University - Heidelberg")
// 2. Google: cleaned name + country         (drops agency codes like "(EB UK)")
// 3. Google: cleaned name + city + country  (disambiguate when city is known)
// 4. Google: city + country                 (city-centre fallback)
// 5. OSM:    original name + country
// 6. OSM:    city + country
async function resolveCoordinates({ name, city, country }) {
  const clean = cleanName(name);
  const attempts = [];

  if (name && country) attempts.push(() => googleTextSearch(`${name}, ${country}`));
  if (clean !== name && clean && country) attempts.push(() => googleTextSearch(`${clean}, ${country}`));
  if (clean && city && country && !name.toLowerCase().includes(city.toLowerCase())) {
    attempts.push(() => googleTextSearch(`${clean}, ${city}, ${country}`));
  }
  if (city && country) attempts.push(() => googleTextSearch(`${city}, ${country}`));
  if (name && country) attempts.push(() => nominatimResolve(`${name} ${country}`));
  if (city && country) attempts.push(() => nominatimResolve(`${city} ${country}`));

  for (const attempt of attempts) {
    try {
      const r = await attempt();
      if (r && isFinite(r.lat) && isFinite(r.lng)) return r;
    } catch (e) { /* try next */ }
  }
  return null;
}

// ── Background helper called after entity create/update ───────────────────────
async function autoGeoLookup(locationId, entityName, country, city) {
  try {
    const r = await resolveCoordinates({ name: entityName, city, country });
    if (!r) return;

    const updates = ['latitude=?', 'longitude=?'];
    const vals = [r.lat, r.lng];
    if (r.city) { updates.push('city=?'); vals.push(r.city); }
    vals.push(locationId);

    await db.query(
      `UPDATE entity_locations SET ${updates.join(', ')} WHERE id=? AND (latitude IS NULL OR longitude IS NULL)`,
      vals
    );
    await db.query(
      `UPDATE orbit_configs SET orbit_center_lat=?, orbit_center_lng=?,
        scan_target_lat = COALESCE(scan_target_lat, ?),
        scan_target_lng = COALESCE(scan_target_lng, ?)
       WHERE entity_location_id=?
         AND (orbit_center_lat IS NULL OR orbit_center_lng IS NULL)`,
      [r.lat, r.lng, r.lat, r.lng, locationId]
    );
  } catch (e) {
    console.error(`[autoGeoLookup] ${entityName}: ${e.message}`);
  }
}

module.exports = { resolveCoordinates, autoGeoLookup, nominatimSearch, cleanName };
