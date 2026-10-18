-- Epic 7: provider-side commission links (IELTS/TOEFL/Duolingo/etc).
-- URLs start as plain (non-commission) provider pages — placeholders until
-- real affiliate/tracked links are supplied, editable from the admin panel
-- without a code change. Clicks route through /api/go/:provider so the
-- click count (and later, commission accounting) works no matter where the
-- link is swapped in.
CREATE TABLE IF NOT EXISTS affiliate_links (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  provider_key VARCHAR(30) NOT NULL UNIQUE,
  label        VARCHAR(100) NOT NULL,
  url          VARCHAR(500) NOT NULL,
  clicks       INT NOT NULL DEFAULT 0,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO affiliate_links (provider_key, label, url) VALUES
  ('ielts',     'IELTS',                     'https://www.britishcouncil.org.tr/sinav/ielts'),
  ('toefl',     'TOEFL iBT',                 'https://www.ets.org/toefl'),
  ('duolingo',  'Duolingo English Test',     'https://englishtest.duolingo.com'),
  ('pte',       'Pearson PTE',               'https://www.pearsonpte.com'),
  ('cambridge', 'Cambridge English',         'https://www.cambridgeenglish.org')
ON DUPLICATE KEY UPDATE provider_key = provider_key;
