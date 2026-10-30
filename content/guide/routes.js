/*
 * Pathway progression route guides: "<University> <Degree>: how can I study it, get accepted, transfer?"
 * One route = one pathway centre (e.g. ONCAMPUS Amsterdam) + one partner university + one degree.
 * Base facts come from the provider pages (stored as facts on the route); pathway fee, duration and
 * intakes are read live from the centre's programs in the database.
 */
'use strict';

const ROUTE_FACTS = [
  { key: 'centre', label: 'Pathway merkezi (katalogdaki ad)', type: 'text', hint: 'Örn. ONCampus Amsterdam. Merkezin canlı program bilgileri buradan okunur.' },
  { key: 'partner', label: 'Geçiş yapılan üniversite', type: 'text' },
  { key: 'partner_short', label: 'Üniversite kısa adı', type: 'text', hint: 'Boşsa tam ad kullanılır.' },
  { key: 'degree', label: 'Bölüm / derece adı', type: 'text' },
  { key: 'level', label: 'Seviye', type: 'select', options: ['Bachelor', 'Master'] },
  { key: 'via', label: 'Pathway programı (UPP, MQP, Foundation, International Year One, Pre-Master)', type: 'text' },
  { key: 'academic_entry', label: 'Akademik şart', type: 'textarea' },
  { key: 'english_entry', label: 'İngilizce şartı', type: 'textarea' },
  { key: 'other_note', label: 'Matematik testi / diğer şartlar', type: 'textarea' },
  { key: 'language', label: 'Eğitim dili', type: 'text' },
  { key: 'duration', label: 'Derece süresi', type: 'text' },
  { key: 'guarantee', label: 'Geçiş garantisi ifadesi', type: 'textarea' },
  { key: 'degree_tuition_note', label: 'Derecenin okul ücreti notu', type: 'textarea', hint: 'Pathway ücreti programdan otomatik gelir; derecenin yıllık ücretini buraya yaz.' },
  { key: 'location', label: 'Şehir / kampüs', type: 'text' },
  { key: 'admit_note', label: 'Kabul için ek notlar', type: 'textarea' },
  { key: 'source_url', label: 'Sağlayıcı sayfası', type: 'text' },
  { key: 'sources', label: 'Kaynak bağlantıları', type: 'list' },
  { key: 'verified_at', label: 'Son doğrulama tarihi', type: 'date' },
];

const ROUTE_QUESTIONS = [
  { id: 'intro', intro: true, q: c => `${c.P} ${c.D} nasıl okuyabilirim?` },
  { id: 'transition', q: c => `${c.C} üzerinden ${c.P} ${c.D} programına nasıl geçiş yapabilirim?` },
  { id: 'admit', q: c => `${c.P} ${c.D} için nasıl kabul alabilirim?` },
  { id: 'requirements', q: c => `${c.P} ${c.D} için gerekli şartlar nelerdir?` },
  { id: 'pathway', q: c => `${c.D} için hangi ${c.C} programını okumalıyım?` },
  { id: 'guarantee', q: c => `${c.C} sonrası ${c.P} geçişi garantili mi?` },
  { id: 'maths', q: c => `${c.P} ${c.D} için matematik testi (OMPT) gerekir mi?` },
  { id: 'cost', q: c => `${c.P} ${c.D} yolu toplam ne kadara mal olur?` },
  { id: 'steps', q: c => `${c.P} ${c.D} için başvuru adımları nelerdir?` },
  { id: 'alternatives', q: c => `${c.P} ${c.D} yerine hangi programlara geçiş yapabilirim?` },
];

module.exports = { ROUTE_FACTS, ROUTE_QUESTIONS };
