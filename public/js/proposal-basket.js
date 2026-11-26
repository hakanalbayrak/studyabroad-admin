/* Staff-only proposal basket helper (admin + advisor). Visitors and students get nothing from this file.
 * Basket lives in localStorage ('pe_proposal'); saved proposals live on the server (/api/proposals). */
(function () {
  var role = null;
  try {
    var t = localStorage.getItem('sa_token');
    if (t) { var p = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); if (!p.exp || p.exp > Date.now() / 1000) role = p.role; }
  } catch (e) {}
  var can = role === 'admin' || role === 'advisor';
  function get() { try { return JSON.parse(localStorage.getItem('pe_proposal') || '[]'); } catch (e) { return []; } }
  function toast(msg) {
    var el = document.getElementById('proposalToast');
    if (!el) { el = document.createElement('div'); el.id = 'proposalToast'; el.style.cssText = 'position:fixed;bottom:84px;right:24px;z-index:600;background:#1f2937;color:#fff;padding:10px 14px;border-radius:8px;font-size:.84rem'; document.body.appendChild(el); }
    el.textContent = msg; el.style.display = 'block'; clearTimeout(el._t); el._t = setTimeout(function () { el.style.display = 'none'; }, 2200);
  }
  function badge() {
    if (!can) return;
    var b = document.getElementById('proposalBadge');
    if (!b) { b = document.createElement('div'); b.id = 'proposalBadge'; b.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:500'; b.innerHTML = '<a href="/proposal" style="display:flex;gap:8px;align-items:center;background:var(--accent,#2b44ff);color:#fff;font-weight:700;font-size:.86rem;padding:10px 16px;border-radius:999px;text-decoration:none">Teklif Sepeti (<span id="proposalCount">0</span>)</a>'; document.body.appendChild(b); }
    var n = get().length; b.style.display = n ? 'block' : 'none'; var c = document.getElementById('proposalCount'); if (c) c.textContent = n;
  }
  function add(p, uni) {
    if (!can || !p) return;
    var basket = get();
    if (basket.some(function (x) { return x.id === p.id; })) { toast('Bu program zaten teklif sepetinde.'); return; }
    basket.push({
      id: p.id, name: p.name, university_name: (uni && uni.name) || p.university_name, type_name: p.type_name,
      tuition_fee: p.tuition_fee, tuition_currency: p.tuition_currency, duration: p.duration,
      english_req_type: p.english_req_type, english_req_score: p.english_req_score, gpa_requirement: p.gpa_requirement,
      intake_months: p.intake_months, language_of_instruction: p.language_of_instruction,
      city: (uni && uni.city) || p.city, country: (uni && uni.country) || p.country,
      scholarship_available: p.scholarship_available, application_deadline: p.application_deadline
    });
    localStorage.setItem('pe_proposal', JSON.stringify(basket)); badge(); toast('Teklif sepetine eklendi');
  }
  window.ProposalBasket = { can: can, add: add, badge: badge };
  document.addEventListener('DOMContentLoaded', badge);
})();
