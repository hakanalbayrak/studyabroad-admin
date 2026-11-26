// Applies the PANELEDU "Campus Pop" look to the transactional emails in mailer.js.
// Each template is a container div with a coloured header div and a bordered body div;
// this restyles those and appends one shared footer, so templates stay simple.
const SITE = process.env.APP_URL || 'https://paneledu.com';
const INK = '#14142b', COBALT = '#2b44ff', SUN = '#ffd23f';

const LOGO = `<div style="font-family:Arial,Helvetica,sans-serif;font-weight:800;font-size:16px;letter-spacing:-.4px;margin-bottom:8px;color:#ffffff"><span style="display:inline-block;width:22px;height:22px;background:${SUN};color:${INK};border:2px solid ${INK};border-radius:6px;font:800 13px/18px Arial,sans-serif;text-align:center;vertical-align:middle;margin-right:8px">P</span><span style="vertical-align:middle">paneledu</span></div>`;

const FOOTER = `<div style="max-width:560px;margin-top:16px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.7;color:#5a5a78;text-align:center">
  <strong style="color:${INK}">PANELEDU</strong> &middot; Yurt dışı eğitim platformu<br>
  <a href="${SITE}" style="color:${COBALT}">paneledu.com</a> &middot; <a href="${SITE}/privacy" style="color:${COBALT}">Gizlilik</a> &middot; <a href="${SITE}/terms" style="color:${COBALT}">Koşullar</a> &middot; info@paneledu.com<br>
  Bu e-postayı PANELEDU hesabın veya talebin nedeniyle aldın.
</div>`;

function brandHtml(html) {
  if (!/border-radius:1[02]px 1[02]px 0 0/.test(html)) return html; // not one of our card templates
  let out = html
    .replace(/font-family:system-ui,sans-serif;max-width:(\d+)px;color:#1e293b/g, (_, w) => `font-family:Arial,Helvetica,sans-serif;max-width:${Math.max(+w, 540)}px;color:${INK}`)
    // header
    .replace(/(<div style=")background:(?:linear-gradient\([^)]*\)|#6366f1);color:#fff;padding:\d+px(?: \d+px)?;border-radius:1[02]px 1[02]px 0 0(">)/g,
      `$1background:${COBALT};color:#ffffff;padding:20px 22px;border:2px solid ${INK};border-radius:12px 12px 0 0$2${LOGO}`)
    // body card
    .replace(/border:1px solid #e2e8f0;border-top:none;/g, `border:2px solid ${INK};border-top:none;background:#ffffff;`)
    // buttons: purple fill -> sun yellow with ink outline
    .replace(/background:#6366f1;color:#fff;padding:(\d+px \d+px);border-radius:\d+px/g, `background:${SUN};color:${INK};border:2px solid ${INK};padding:$1;border-radius:10px;font-weight:700`)
    .replace(/#6366f1/g, COBALT).replace(/#8b5cf6|#06b6d4/g, COBALT)
    .replace(/color:#64748b/g, 'color:#5a5a78').replace(/color:#1e293b/g, `color:${INK}`)
    .replace(/#f8fafc|#f1f5f9/g, '#e6e9ff');
  const i = out.lastIndexOf('</div>');
  if (i === -1) return out;
  // the final </div> closes the container; put the shared footer inside it
  return out.slice(0, i) + FOOTER + out.slice(i);
}

module.exports = { brandHtml };
