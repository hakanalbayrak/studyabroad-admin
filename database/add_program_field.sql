-- Discipline/field tag for programs (powers the eligibility funnel field filter).
-- Values: 'Business & Economics','Engineering','Medicine & Health',
--         'AI & Technology','Social Sciences', or NULL/'' (unclassified).
ALTER TABLE programs ADD COLUMN field VARCHAR(60) DEFAULT NULL;
