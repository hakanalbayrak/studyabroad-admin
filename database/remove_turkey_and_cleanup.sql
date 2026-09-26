-- ── 1. Remove Turkish-language programs (all countries) ──────────────────────
DELETE FROM programs
WHERE language_of_instruction IN ('Turkish', 'English/Turkish');

-- ── 2. Remove work-and-study programs ────────────────────────────────────────
DELETE FROM programs
WHERE LOWER(name) LIKE '%work%study%'
   OR LOWER(name) LIKE '%work and study%';

-- ── 3. Remove orbit configs tied to Turkey locations ─────────────────────────
DELETE oc FROM orbit_configs oc
INNER JOIN entity_locations el ON el.id = oc.entity_location_id
WHERE el.country = 'Turkey';

-- ── 4. Remove programs tied to Turkey locations ───────────────────────────────
DELETE p FROM programs p
INNER JOIN entity_locations el ON el.id = p.entity_location_id
WHERE el.country = 'Turkey';

-- ── 5. Remove Turkey locations ────────────────────────────────────────────────
DELETE FROM entity_locations WHERE country = 'Turkey';

-- ── 6. Remove entities that now have no locations ─────────────────────────────
DELETE FROM entities
WHERE id NOT IN (SELECT DISTINCT entity_id FROM entity_locations);

-- ── 7. Remove any orphaned program_types no longer used ───────────────────────
DELETE FROM program_types
WHERE id NOT IN (SELECT DISTINCT program_type_id FROM programs);
