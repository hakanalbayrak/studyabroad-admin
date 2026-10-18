-- Remove selected countries and all universities exclusively based in those countries.
-- "Exclusively" = entity has NO locations outside the target list.
-- CASCADE handles: entity_locations, programs, orbit_configs, media.
--
-- Countries being removed:
--   Denmark, Georgia, Latvia, Lithuania, Poland, Switzerland
--
-- Run in phpMyAdmin. Safe to run multiple times (idempotent).

-- ── Preview (run this SELECT first to confirm what will be deleted) ──────────
-- SELECT e.id, e.name,
--        GROUP_CONCAT(el.country ORDER BY el.country SEPARATOR ', ') AS countries
-- FROM entities e
-- JOIN entity_locations el ON el.entity_id = e.id
-- WHERE e.id NOT IN (
--   SELECT entity_id FROM entity_locations
--   WHERE country NOT IN ('Denmark','Georgia','Latvia','Lithuania','Poland','Switzerland')
-- )
-- GROUP BY e.id, e.name
-- ORDER BY e.name;

-- ── Delete ───────────────────────────────────────────────────────────────────
DELETE FROM entities
WHERE id IN (
  -- entities that have at least one location in the target countries
  SELECT entity_id FROM entity_locations
  WHERE country IN ('Denmark','Georgia','Latvia','Lithuania','Poland','Switzerland')
)
AND id NOT IN (
  -- …but exclude any that also have a location outside the target countries
  SELECT entity_id FROM entity_locations
  WHERE country NOT IN ('Denmark','Georgia','Latvia','Lithuania','Poland','Switzerland')
);
