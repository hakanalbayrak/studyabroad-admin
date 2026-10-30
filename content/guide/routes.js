/*
 * Partner university guides ("<University> nasıl okuyabilirim / kabul alabilirim"): one page per university.
 * The degree list and entry requirements come from the partner programme data (admin editable); the text never
 * names the pathway provider and only hints at supported entry routes for students who miss the direct requirements.
 */
'use strict';

const ROUTE_FACTS = [
  { key: 'partner', label: 'Üniversite adı', type: 'text' },
  { key: 'partner_short', label: 'Kısa ad (sorularda kullanılır)', type: 'text', hint: 'Boşsa tam ad kullanılır.' },
  { key: 'pron', label: 'Okunuşu (Türkçe ek için)', type: 'text', hint: 'Ekler (-e, -de) yanlış çıkarsa doldur.' },
  { key: 'country', label: 'Ülke (İngilizce ad)', type: 'text', hint: 'Örn. United Kingdom, France, Netherlands, Ireland.' },
  { key: 'location', label: 'Şehir', type: 'text' },
  { key: 'bachelor_academic', label: 'Lisans akademik şart', type: 'textarea' },
  { key: 'bachelor_english', label: 'Lisans İngilizce şartı', type: 'textarea' },
  { key: 'master_academic', label: 'Yüksek lisans akademik şart', type: 'textarea' },
  { key: 'master_english', label: 'Yüksek lisans İngilizce şartı', type: 'textarea' },
  { key: 'other_note', label: 'Matematik testi / diğer şartlar', type: 'textarea' },
  { key: 'bachelor_degrees', label: 'Lisans bölümleri', type: 'list', hint: 'Her satır bir bölüm' },
  { key: 'master_degrees', label: 'Yüksek lisans bölümleri', type: 'list', hint: 'Her satır bir bölüm' },
  { key: 'alt_note', label: 'Şartları karşılamayanlar için yol (açıklama)', type: 'textarea', hint: 'Boşsa varsayılan metin kullanılır.' },
  { key: 'degree_tuition_note', label: 'Okul ücreti notu', type: 'textarea' },
  { key: 'admit_note', label: 'Kabul için ek notlar', type: 'textarea' },
  { key: 'meta_description', label: 'Google açıklaması', type: 'textarea' },
  { key: 'sources', label: 'Kaynak bağlantıları (dahili)', type: 'list' },
  { key: 'verified_at', label: 'Son doğrulama tarihi', type: 'date' },
];

const ROUTE_QUESTIONS = [
  { id: 'intro', intro: true, q: c => `${c.P} nasıl okuyabilirim? Türk öğrenciler için rehber` },
  { id: 'admit', q: c => `${c.P_dat} nasıl kabul alabilirim?` },
  { id: 'requirements', q: c => `${c.P_gen} kabul şartları nelerdir?` },
  { id: 'english', q: c => `${c.P_dat} başvururken İngilizce şartı nedir?` },
  { id: 'programs', q: c => `${c.P_loc} hangi bölümler var?` },
  { id: 'whichmajor', q: c => `${c.P_loc} hangi bölümü okumalıyım?` },
  { id: 'notmeet', q: c => `${c.P_gen} şartlarını karşılamıyorsam ne yapabilirim?` },
  { id: 'maths', q: c => `${c.P_dat} başvururken matematik testi gerekir mi?` },
  { id: 'cost', q: c => `${c.P_loc} okumanın maliyeti nedir?` },
  { id: 'steps', q: c => `${c.P_dat} başvuru adımları nelerdir?` },
];

module.exports = { ROUTE_FACTS, ROUTE_QUESTIONS };
