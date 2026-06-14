const https = require('https');
const db = require('../db');

function nominatimSearch(query) {
  const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(query);
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': 'StudyAbroadAdmin/1.0 (study abroad platform; contact via site)' }
    }, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch (e) { reject(new Error('Nominatim parse error')); }
      });
    }).on('error', reject);
  });
}

// Fire-and-forget: called after entity+location are committed to DB.
// Looks up coordinates and sets orbit_config center if not already present.
async function autoGeoLookup(locationId, entityName, country) {
  try {
    const query = `${entityName} ${country || ''}`.trim();
    const results = await nominatimSearch(query);
    if (!results || !results[0]) return;

    const lat = parseFloat(results[0].lat);
    const lng  = parseFloat(results[0].lon);

    await db.query(
      'UPDATE entity_locations SET latitude=?, longitude=? WHERE id=? AND (latitude IS NULL OR longitude IS NULL)',
      [lat, lng, locationId]
    );

    // Update orbit center if it was left null
    await db.query(
      `UPDATE orbit_configs SET orbit_center_lat=?, orbit_center_lng=?,
        scan_target_lat = COALESCE(scan_target_lat, ?),
        scan_target_lng = COALESCE(scan_target_lng, ?)
       WHERE entity_location_id=?
         AND (orbit_center_lat IS NULL OR orbit_center_lng IS NULL)`,
      [lat, lng, lat, lng, locationId]
    );
  } catch (e) {
    // Background task — log silently, don't surface to user
    console.error(`[autoGeoLookup] ${entityName}: ${e.message}`);
  }
}

module.exports = { nominatimSearch, autoGeoLookup };
