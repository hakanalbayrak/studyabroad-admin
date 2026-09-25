// One-off repair for the catalog import mess found 2026-09-25:
// an earlier (2026-06-14) bulk import created program_types rows named
// after raw CSV credential-level strings (with a MySQL non-strict-mode
// default of category='undergraduate' on all of them), and today's
// corrected import duplicated most of the same programs under the
// properly-mapped types. This consolidates them. Meant to be run once via
// POST /api/admin/catalog-cleanup, then removed from the codebase.
const router = require('express').Router();
const db = require('../db');

// old (broken) type name -> new (canonical, pre-seeded) type name(s) to dedupe/remap onto
const OLD_TO_NEW = {
  "Bachelor's Degree": ['Bachelor Programs'],
  "Master's Degree": ['Master Programs'],
  'Diploma & Associate Degree': ['Diploma Programs'],
  'Graduate Certificate & Diploma': ['Certificate Programs'],
  'Foundation,Pathway and IYO': ['Foundation Programs', 'Pathway Programs', 'Pre-Master Programs'],
};

const CATEGORY_FIX = {
  'Master Programs': 'postgraduate',
  'Foundation Programs': 'preparation',
  'Pathway Programs': 'preparation',
  'Pre-Master Programs': 'preparation',
  'Diploma Programs': 'other',
  'Certificate Programs': 'other',
  'Other Credentials': 'other',
};

router.post('/', async (req, res) => {
  const report = {};
  try {
    // 1. Remove "Work & Study" programs entirely, per explicit direction.
    const [wsDel] = await db.query(
      `DELETE p FROM programs p
       JOIN program_types pt ON pt.id = p.program_type_id
       WHERE pt.name = 'Work & Study'`
    );
    report.workStudyDeleted = wsDel.affectedRows;

    // 2. Dedup: delete old-typed rows that have a matching new-typed row
    //    (same entity, same trimmed program name).
    report.dedupDeletedByOldType = {};
    for (const [oldName, newNames] of Object.entries(OLD_TO_NEW)) {
      const placeholders = newNames.map(() => '?').join(',');
      const [r] = await db.query(
        `DELETE old FROM programs old
         JOIN program_types opt ON opt.id = old.program_type_id
         JOIN entity_locations oel ON oel.id = old.entity_location_id
         WHERE opt.name = ?
         AND EXISTS (
           SELECT 1 FROM programs new
           JOIN program_types npt ON npt.id = new.program_type_id
           JOIN entity_locations nel ON nel.id = new.entity_location_id
           WHERE npt.name IN (${placeholders})
             AND nel.entity_id = oel.entity_id
             AND TRIM(new.name) = TRIM(old.name)
         )`,
        [oldName, ...newNames]
      );
      report.dedupDeletedByOldType[oldName] = r.affectedRows;
    }

    // 3. Remap surviving old-typed rows onto the canonical new type.
    //    Simple 1:1 mappings first.
    report.remappedByOldType = {};
    for (const [oldName, newNames] of Object.entries(OLD_TO_NEW)) {
      if (newNames.length !== 1) continue;
      const [r] = await db.query(
        `UPDATE programs p
         JOIN program_types opt ON opt.id = p.program_type_id
         JOIN program_types npt ON npt.name = ?
         SET p.program_type_id = npt.id
         WHERE opt.name = ?`,
        [newNames[0], oldName]
      );
      report.remappedByOldType[oldName] = r.affectedRows;
    }

    // 3b. "Foundation,Pathway and IYO" (3-way) — sniff by course name.
    const [fpRemap] = await db.query(
      `UPDATE programs p
       JOIN program_types opt ON opt.id = p.program_type_id
       JOIN program_types fpt ON fpt.name = 'Foundation Programs'
       JOIN program_types ppt ON ppt.name = 'Pathway Programs'
       JOIN program_types mpt ON mpt.name = 'Pre-Master Programs'
       SET p.program_type_id = CASE
         WHEN LOWER(p.name) LIKE '%pre-master%' OR LOWER(p.name) LIKE '%pre master%' OR LOWER(p.name) LIKE '%premaster%' THEN mpt.id
         WHEN LOWER(p.name) LIKE '%foundation%' THEN fpt.id
         ELSE ppt.id
       END
       WHERE opt.name = 'Foundation,Pathway and IYO'`
    );
    report.remappedByOldType['Foundation,Pathway and IYO'] = fpRemap.affectedRows;

    // 4. Fix category on the types that got a bad default when created.
    report.categoryFixes = {};
    for (const [name, category] of Object.entries(CATEGORY_FIX)) {
      const [r] = await db.query('UPDATE program_types SET category = ? WHERE name = ?', [category, name]);
      report.categoryFixes[name] = r.affectedRows;
    }

    // 5. Delete now-orphaned old type rows (should have 0 programs left).
    const oldTypeNames = [...Object.keys(OLD_TO_NEW), 'Work & Study'];
    const [orphanCheck] = await db.query(
      `SELECT pt.name, COUNT(p.id) as cnt FROM program_types pt
       LEFT JOIN programs p ON p.program_type_id = pt.id
       WHERE pt.name IN (${oldTypeNames.map(() => '?').join(',')})
       GROUP BY pt.name`,
      oldTypeNames
    );
    report.remainingOldTypeCounts = orphanCheck;
    const stillHasPrograms = orphanCheck.filter(r => r.cnt > 0).map(r => r.name);
    if (stillHasPrograms.length) {
      report.warning = `Not deleting these old types, still referenced: ${stillHasPrograms.join(', ')}`;
    }
    const toDelete = oldTypeNames.filter(n => !stillHasPrograms.includes(n));
    if (toDelete.length) {
      const [delTypes] = await db.query(
        `DELETE FROM program_types WHERE name IN (${toDelete.map(() => '?').join(',')})`,
        toDelete
      );
      report.oldTypesDeleted = { names: toDelete, count: delTypes.affectedRows };
    }

    // 6. Reactivate entities that have active programs but got stuck
    //    'inactive' by an earlier country-focus pruning.
    const [react] = await db.query(
      `UPDATE entities e
       JOIN entity_locations el ON el.entity_id = e.id
       JOIN programs p ON p.entity_location_id = el.id
       SET e.status = 'active'
       WHERE e.status = 'inactive' AND p.status = 'active'`
    );
    report.entitiesReactivated = react.affectedRows;

    // 7. Final tallies.
    const [[totals]] = await db.query(
      `SELECT COUNT(*) as total_programs FROM programs WHERE status='active'`
    );
    const [finalTypes] = await db.query(
      `SELECT pt.name, pt.category, COUNT(p.id) as cnt
       FROM program_types pt LEFT JOIN programs p ON p.program_type_id = pt.id AND p.status='active'
       GROUP BY pt.id ORDER BY cnt DESC`
    );
    report.finalTotals = totals;
    report.finalTypeBreakdown = finalTypes;

    res.json(report);
  } catch (e) {
    report.error = e.message;
    res.status(500).json(report);
  }
});

module.exports = router;
