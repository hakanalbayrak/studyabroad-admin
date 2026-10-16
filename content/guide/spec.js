/*
 * University guide spec: what a guide asks, which facts the admin can fill in.
 * Questions are phrased with Turkish suffix helpers from utils/guide.js:
 *   c.N (name) c.N_abl (-den) c.N_dat (-e) c.N_loc (-de) c.N_gen (-in)
 * Adding a question = add a row here and a default in utils/guide.js (or leave it
 * hidden until an admin writes an answer).
 */
'use strict';

const GROUPS = [
  { id: 'kabul', title: 'Kabul ve şartlar' },
  { id: 'ucret', title: 'Ücret, burs ve yaşam' },
  { id: 'konum', title: 'Konum ve kampüs' },
  { id: 'kariyer', title: 'Diploma ve kariyer' },
  { id: 'okul', title: 'Okul ve bölümler' },
  { id: 'basvuru', title: 'Başvuru süreci' },
];

// order = display order. `intro` = the first question, rendered as H1 + lead paragraph.
const QUESTIONS = [
  { id: 'admit', group: 'kabul', intro: true, q: c => `${c.N_abl} kabul alabilir miyim?` },
  { id: 'exam', group: 'kabul', q: c => `${c.N_abl} kabul almak için sınava girmem gerekir mi?` },
  { id: 'noexam', group: 'kabul', q: c => `${c.N_dat} sınava girmeden kabul alabilir miyim?` },
  { id: 'gpa', group: 'kabul', q: c => `${c.N_abl} kabul almak için ortalamamın kaç olması gerekir?` },
  { id: 'english', group: 'kabul', q: c => `${c.N_dat} başvururken İngilizce yeterlilik belgesi (IELTS, TOEFL) gerekir mi?` },
  { id: 'language', group: 'kabul', q: c => `${c.N_loc} eğitim dili nedir?` },
  { id: 'prep', group: 'kabul', q: c => `${c.N_loc} hazırlık var mı?` },
  { id: 'intakes', group: 'kabul', q: c => `${c.N_dat} ne zaman başvurulur? Başvuru ve kabul dönemleri nedir?` },
  { id: 'getaccepted', group: 'kabul', q: c => `${c.N_abl} kabul almak için ne yapmalıyım?` },

  { id: 'tuition', group: 'ucret', q: c => `${c.N} yıllık okul ücreti ne kadar?` },
  { id: 'scholarship', group: 'ucret', q: c => `${c.N_abl} burs kazanabilir miyim? Burs için ne yapmalıyım?` },
  { id: 'housing', group: 'ucret', q: c => `${c.N_loc} yurt var mı? Yurt fiyatları nedir?` },
  { id: 'living', group: 'ucret', q: c => `${c.N_dat} gitmek için aylık yaşam gideri ne kadar?` },
  { id: 'parttime', group: 'ucret', q: c => `${c.N_loc} okurken çalışabilir miyim?` },

  { id: 'location', group: 'konum', q: c => `${c.N} hangi şehirde ve hangi ülkede?` },
  { id: 'visa', group: 'konum', q: c => `${c.N_dat} gitmek için vize gerekir mi?` },
  { id: 'type', group: 'konum', q: c => `${c.N} devlet üniversitesi mi, özel üniversite mi?` },
  { id: 'size', group: 'konum', q: c => `${c.N_loc} kaç öğrenci var? Kampüs hayatı nasıl?` },

  { id: 'equivalency', group: 'kariyer', q: c => `${c.N_gen} diploması Türkiye'de denk sayılır mı? (Diploma denkliği)` },
  { id: 'recognition', group: 'kariyer', q: c => `${c.N_gen} diploması dünyada geçerli mi?` },
  { id: 'jobs', group: 'kariyer', q: c => `${c.N_gen} diploması ile iş bulabilir miyim? Ne kadar maaş alırım?` },
  { id: 'stay', group: 'kariyer', q: c => `${c.N_abl} mezun olduktan sonra ülkede kalabilir miyim?` },
  { id: 'alumni', group: 'kariyer', q: c => `${c.N_abl} mezun olmuş ünlü biri veya başarılı bir iş insanı var mı?` },
  { id: 'startups', group: 'kariyer', q: c => `${c.N} kaç startup çıkarıyor, patentleri var mı?` },

  { id: 'programs', group: 'okul', q: c => `${c.N_loc} hangi bölümler var?` },
  { id: 'masters', group: 'okul', q: c => `${c.N_loc} yüksek lisans yapabilir miyim?` },
  { id: 'ranking', group: 'okul', q: c => `${c.N} dünya sıralaması nedir?` },
  { id: 'good', group: 'okul', q: c => `${c.N} iyi bir üniversite mi?` },
  { id: 'value', group: 'okul', q: c => `${c.N} bana ne kazandırır?` },
  { id: 'whichmajor', group: 'okul', q: c => `${c.N_loc} hangi bölümü okumalıyım?` },

  { id: 'howapply', group: 'basvuru', q: c => `${c.N_dat} nasıl başvurabilirim?` },
  { id: 'whatdo', group: 'basvuru', q: c => `${c.N_dat} başvurmak için ne yapmalıyım?` },
  { id: 'docs', group: 'basvuru', q: c => `${c.N_dat} başvurmak için hangi belgeler gerekli?` },
];

// Facts an admin can fill in per university. type: text | textarea | number | select | list | date | bool
const ENTITY_FACTS = [
  { key: 'short_name', label: 'Kısa ad (sorularda kullanılır)', type: 'text', hint: 'Boşsa okul adı kullanılır. Parantezli adlar için doldur.' },
  { key: 'pron', label: 'Okunuşu (Türkçe ek için)', type: 'text', hint: 'Örn. "kınstraktır yunivörsiti". Boşsa otomatik. Ekler (-den, -de) yanlış çıkarsa doldur.' },
  { key: 'type_of_institution', label: 'Kurum türü', type: 'text', hint: 'Örn. Özel, kâr amacı gütmeyen üniversite' },
  { key: 'founded_year', label: 'Kuruluş yılı', type: 'number' },
  { key: 'accreditation', label: 'Akreditasyon / tanınırlık', type: 'textarea' },
  { key: 'students_total', label: 'Toplam öğrenci', type: 'number' },
  { key: 'students_intl_note', label: 'Uluslararası öğrenci notu', type: 'text', hint: 'Örn. 120’den fazla ülkeden öğrenci' },
  { key: 'exam_required', label: 'Giriş sınavı', type: 'select', options: ['', 'none', 'optional', 'conditional', 'required'], hint: 'none = yok, optional = isteğe bağlı, conditional = bazı diplomalar için, required = zorunlu' },
  { key: 'exam_note', label: 'Sınav notu', type: 'textarea' },
  { key: 'gpa_note', label: 'Not ortalaması şartı', type: 'textarea' },
  { key: 'english_note', label: 'İngilizce şartı (resmî)', type: 'textarea', hint: 'Doluysa veritabanındaki program şartlarının yerine geçer.' },
  { key: 'prep_note', label: 'Hazırlık / foundation', type: 'textarea' },
  { key: 'tuition_note', label: 'Ücret notu', type: 'textarea', hint: 'Rakamlar programlardan otomatik gelir; burada resmî site notu, ek ücretler yazılır.' },
  { key: 'scholarship_note', label: 'Burs bilgisi', type: 'textarea' },
  { key: 'housing_note', label: 'Yurt / konaklama', type: 'textarea' },
  { key: 'living_note', label: 'Aylık yaşam gideri notu', type: 'textarea' },
  { key: 'work_note', label: 'Okurken çalışma notu', type: 'textarea' },
  { key: 'location_note', label: 'Şehir / ulaşım notu', type: 'textarea' },
  { key: 'campus_note', label: 'Kampüs hayatı', type: 'textarea' },
  { key: 'recognition_note', label: 'Diploma geçerliliği notu', type: 'textarea' },
  { key: 'jobs_note', label: 'İş imkânları ve maaş', type: 'textarea' },
  { key: 'alumni_note', label: 'Ünlü mezunlar', type: 'textarea', hint: 'Yalnızca doğrulanmış kişiler. Boşsa soru sayfada gösterilmez.' },
  { key: 'startup_note', label: 'Startup / patent', type: 'textarea', hint: 'Boşsa soru gösterilmez.' },
  { key: 'ranking_note', label: 'Sıralama notu', type: 'textarea' },
  { key: 'value_note', label: 'Sana ne kazandırır', type: 'textarea' },
  { key: 'good_note', label: 'İyi bir okul mu (özet)', type: 'textarea' },
  { key: 'apply_steps', label: 'Başvuru adımları', type: 'list', hint: 'Her satır bir adım' },
  { key: 'docs', label: 'Gerekli belgeler', type: 'list', hint: 'Her satır bir belge' },
  { key: 'deadline_note', label: 'Başvuru tarihleri notu', type: 'textarea' },
  { key: 'apply_url', label: 'Resmî başvuru bağlantısı', type: 'text' },
  { key: 'sources', label: 'Kaynak bağlantıları', type: 'list', hint: 'Her satır bir URL' },
  { key: 'verified_at', label: 'Son doğrulama tarihi', type: 'date' },
];

const COUNTRY_FACTS = [
  { key: 'visa', label: 'Türk vatandaşları için vize', type: 'textarea' },
  { key: 'blocked', label: 'Bloke hesap / mali yeterlilik', type: 'textarea' },
  { key: 'living', label: 'Aylık yaşam gideri', type: 'textarea' },
  { key: 'work', label: 'Öğrenci çalışma hakkı', type: 'textarea' },
  { key: 'stay', label: 'Mezuniyet sonrası kalış', type: 'textarea' },
  { key: 'denklik', label: 'Türkiye’de diploma denkliği (YÖK)', type: 'textarea' },
  { key: 'recognition', label: 'Dünyada geçerlilik', type: 'textarea' },
  { key: 'entry', label: 'Türk lise diploması ile giriş', type: 'textarea' },
  { key: 'sources', label: 'Kaynak bağlantıları', type: 'list' },
  { key: 'verified_at', label: 'Son doğrulama tarihi', type: 'date' },
];

const COUNTRY_TR = {
  Germany: 'Almanya', 'United Kingdom': 'İngiltere', 'United States': 'ABD', Canada: 'Kanada', Australia: 'Avustralya',
  Austria: 'Avusturya', Belgium: 'Belçika', Cyprus: 'Kıbrıs', 'Czech Republic': 'Çekya', France: 'Fransa', Hungary: 'Macaristan',
  Ireland: 'İrlanda', Italy: 'İtalya', Malta: 'Malta', Netherlands: 'Hollanda', Spain: 'İspanya', 'United Arab Emirates': 'Birleşik Arap Emirlikleri',
};

module.exports = { GROUPS, QUESTIONS, ENTITY_FACTS, COUNTRY_FACTS, COUNTRY_TR };
