-- Keep only universities located in Spain, Netherlands, United Kingdom, Germany, Hungary.
-- Soft-deactivate (status='inactive') everything else — reversible, matches the app's
-- existing convention: every public query already excludes entities with status='inactive'.
--
-- An entity is KEPT if it has at least one location in the allowed list.
-- Country matching is case-insensitive and tolerant of common spelling variants.

-- 1) PREVIEW — run this first and review the list before touching anything.
SELECT e.id, e.name, e.status,
       GROUP_CONCAT(DISTINCT el.country ORDER BY el.country SEPARATOR ', ') AS countries
FROM entities e
JOIN entity_locations el ON el.entity_id = e.id
WHERE e.status != 'inactive'
  AND NOT EXISTS (
    SELECT 1 FROM entity_locations el2
    WHERE el2.entity_id = e.id
      AND LOWER(TRIM(el2.country)) IN (
        'spain',
        'netherlands', 'the netherlands', 'holland',
        'united kingdom', 'uk', 'u.k.', 'great britain', 'england', 'britain',
        'scotland', 'wales', 'northern ireland',
        'germany', 'deutschland',
        'hungary'
      )
  )
GROUP BY e.id, e.name, e.status
ORDER BY e.name;

-- 2) If the preview list above looks correct, run this to deactivate them:
UPDATE entities e
SET e.status = 'inactive'
WHERE e.status != 'inactive'
  AND NOT EXISTS (
    SELECT 1 FROM entity_locations el
    WHERE el.entity_id = e.id
      AND LOWER(TRIM(el.country)) IN (
        'spain',
        'netherlands', 'the netherlands', 'holland',
        'united kingdom', 'uk', 'u.k.', 'great britain', 'england', 'britain',
        'scotland', 'wales', 'northern ireland',
        'germany', 'deutschland',
        'hungary'
      )
  );

-- 3) Verify — should now only list the 5 target countries among active entities:
SELECT DISTINCT el.country
FROM entity_locations el
JOIN entities e ON e.id = el.entity_id
WHERE e.status != 'inactive'
ORDER BY el.country;
