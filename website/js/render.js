/* ===========================================================================
   PatientFlow — render engine
   Reads window.PF (the single source of truth) and renders reusable blocks
   into any page via [data-pf] mount points. One definition, everywhere.
   =========================================================================== */
(function () {
  if (!window.PF) return;
  const PF = window.PF;

  // Minimal inline icon set (stroke, currentColor) — no icon-font dependency.
  const I = {
    calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 7h8M8 11h8M8 15h5"/>',
    trending: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
    sparkles: '<path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3Z"/><path d="M19 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2Z"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="M9 12l2 2 4-4"/>',
    monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
    building: '<rect x="4" y="2" width="16" height="20" rx="1"/><path d="M9 22v-4h6v4M9 6h.01M15 6h.01M9 10h.01M15 10h.01M9 14h.01M15 14h.01"/>',
    box: '<path d="M21 8l-9-5-9 5 9 5 9-5Z"/><path d="M3 8v8l9 5 9-5V8M12 13v8"/>',
    idcard: '<rect x="2" y="4" width="20" height="16" rx="2"/><circle cx="8" cy="10" r="2"/><path d="M6 16c0-1.5 1.5-2.5 2-2.5s2 1 2 2.5M14 9h4M14 13h4"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/>',
    tooth: '<path d="M12 5.5c-2-2-5-2-6 .5-1 3 .5 5 1 8 .3 2 .5 4 2 4s1.5-3 3-3 1.5 3 3 3 1.7-2 2-4c.5-3 2-5 1-8-1-2.5-4-2.5-6-.5-.6.6-1.4.6-2 0Z"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>',
    star: '<path d="M12 2l3 6.5 7 .6-5.3 4.6 1.6 6.8L12 17l-6.3 3.5 1.6-6.8L2 9.1l7-.6L12 2Z"/>',
    stars: '<path d="M12 2l3 6.5 7 .6-5.3 4.6 1.6 6.8L12 17l-6.3 3.5 1.6-6.8L2 9.1l7-.6L12 2Z"/>',
    gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M5 12v9h14v-9M12 8S11 3 8.5 3 6 6 12 8ZM12 8s1-5 3.5-5S18 6 12 8Z"/>',
    chart: '<path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/><rect x="12" y="8" width="3" height="10"/><rect x="17" y="5" width="3" height="13"/>',
    wallet: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M16 14h2"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20Z"/>',
    whatsapp: '<path d="M12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.4A10 10 0 1 0 12 2Z"/><path d="M8.5 8c.3-.7 1.4-.5 1.7.1l.5 1.2c.2.4 0 .8-.3 1-.4.4-.4.6-.2 1 .5.9 1.3 1.6 2.2 2 .4.2.7.1 1-.3.2-.3.6-.5 1-.3l1.2.5c.6.3.8 1.4.1 1.7-1.3.7-2.9.4-4.6-.6a9 9 0 0 1-3.4-3.4C7.8 10.4 7.8 9 8.5 8Z" fill="currentColor" stroke="none"/>',
    megaphone: '<path d="M3 11v2a1 1 0 0 0 1 1h2l4 4V6L6 10H4a1 1 0 0 0-1 1Z"/><path d="M14 8a5 5 0 0 1 0 8M10 18v3"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>',
    robot: '<rect x="4" y="8" width="16" height="12" rx="2"/><path d="M12 4v4M8 14h.01M16 14h.01M9 18h6"/><circle cx="12" cy="3" r="1"/>',
    bell: '<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    chat: '<path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z"/>',
    palette: '<path d="M12 2a10 10 0 0 0 0 20c1.5 0 2-1 2-2 0-1.5 1-2 2-2h2a4 4 0 0 0 4-4c0-6-5-10-12-10Z"/><circle cx="7.5" cy="10.5" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="7.5" r="1.2" fill="currentColor" stroke="none"/><circle cx="16.5" cy="10.5" r="1.2" fill="currentColor" stroke="none"/>',
    gauge: '<path d="M12 14l4-4M3 18a9 9 0 1 1 18 0"/><circle cx="12" cy="18" r="1.5" fill="currentColor" stroke="none"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    stethoscope: '<path d="M6 3v5a4 4 0 0 0 8 0V3"/><path d="M10 17a6 6 0 0 0 6-6"/><circle cx="18" cy="9" r="2"/><circle cx="10" cy="20" r="2"/>',
    activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
  };

  function icon(name, cls) {
    return `<svg class="pf-ico ${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[name] || I.check}</svg>`;
  }
  PF.icon = icon;

  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const annual = (p) => p.annualOffer ? `
    <div class="pf-plan__annual">
      <span>${esc(p.annualOffer.label)}</span>
      <strong>${PF.fmtPrice(p.annualOffer.annualPricePKR)}<em>/year</em></strong>
      <p>${esc(p.annualOffer.note)}</p>
    </div>` : '';

  // ---- Renderers ---------------------------------------------------------
  const R = {
    // Feature grid — <div data-pf="features" data-plan="ai" data-limit="8">
    features(el) {
      const plan = el.dataset.plan || null;
      const limit = parseInt(el.dataset.limit || '0', 10);
      let list = plan ? PF.featuresForPlan(plan) : PF.FEATURES;
      if (limit) list = list.slice(0, limit);
      el.innerHTML = list.map(f => `
        <article class="pf-fcard" tabindex="0">
          <div class="pf-fcard__ic">${icon(f.icon)}</div>
          <h3>${esc(f.name)}</h3>
          <p>${esc(f.desc)}</p>
          <span class="pf-fcard__out">${icon('check')} ${esc(f.outcome)}</span>
        </article>`).join('');
    },

    // Category-grouped features — data-plan optional
    featuresByCat(el) {
      const plan = el.dataset.plan || null;
      el.innerHTML = PF.featuresByCategory(plan).map(cat => `
        <section class="pf-catblock">
          <header class="pf-catblock__h">${icon(cat.icon)}<h3>${esc(cat.name)}</h3><span>${cat.features.length}</span></header>
          <div class="pf-catgrid">
            ${cat.features.map(f => `
              <div class="pf-catitem">
                <div class="pf-catitem__ic">${icon(f.icon)}</div>
                <div><strong>${esc(f.name)}</strong><p>${esc(f.desc)}</p></div>
              </div>`).join('')}
          </div>
        </section>`).join('');
    },

    // Stat counters — <div data-pf="stats">
    stats(el) {
      el.innerHTML = PF.STATS.map(s => `
        <div class="pf-stat">
          <div class="pf-stat__n" data-count="${s.value}" data-suffix="${s.suffix}">0${s.suffix}</div>
          <div class="pf-stat__l">${esc(s.label)}</div>
        </div>`).join('');
      // count-up when visible
      el.querySelectorAll('[data-count]').forEach(n => {
        const io = new IntersectionObserver((ents) => ents.forEach(e => {
          if (!e.isIntersecting) return; io.disconnect();
          const target = +n.dataset.count, suf = n.dataset.suffix, dur = 1200, t0 = performance.now();
          const tick = (t) => { const p = Math.min(1, (t - t0) / dur); n.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))) + suf; if (p < 1) requestAnimationFrame(tick); };
          requestAnimationFrame(tick);
        }), { threshold: 0.4 });
        io.observe(n);
      });
    },

    // Plan cards for the pricing page — <div data-pf="plans">
    plans(el) {
      el.innerHTML = PF.planList.map(p => {
        const feats = PF.featuresForPlan(p.id);
        const shown = feats.slice(0, 8);
        return `
        <article class="pf-plan ${p.highlight ? 'pf-plan--hot' : ''}">
          ${p.highlight ? '<span class="pf-plan__badge">Most popular</span>' : ''}
          <h3>${esc(p.name)}</h3>
          <p class="pf-plan__tag">${esc(p.tagline)}</p>
          <div class="pf-plan__price">${PF.fmtPrice(p.pricePKR)}<span>/${p.period}</span></div>
          ${annual(p)}
          <ul class="pf-plan__list">
            ${shown.map(f => `<li>${icon('check')} ${esc(f.name)}</li>`).join('')}
            ${feats.length > shown.length ? `<li class="pf-plan__more">+ ${feats.length - shown.length} more</li>` : ''}
          </ul>
          <div class="pf-plan__cta">
            <a class="btn ${p.highlight ? 'btn-primary' : 'btn-ghost'}" href="register.html">${esc(p.ctaLabel)}</a>
            <a class="pf-plan__details" href="package.html?plan=${p.id}">View complete details →</a>
          </div>
        </article>`;
      }).join('');
    },

    // Comparison table — <div data-pf="compare">
    compare(el) {
      el.innerHTML = `
        <table class="pf-compare">
          <thead><tr><th>Feature</th>${PF.planList.map(p => `<th>${esc(p.name)}<span>${PF.fmtPrice(p.pricePKR)}/mo${p.annualOffer ? ' · annual available' : ''}</span></th>`).join('')}</tr></thead>
          <tbody>
            ${PF.CATEGORIES.map(cat => {
              const rows = PF.FEATURES.filter(f => f.category === cat.id);
              if (!rows.length) return '';
              return `<tr class="pf-compare__cat"><td colspan="${PF.planList.length + 1}">${esc(cat.name)}</td></tr>` +
                rows.map(f => `<tr><td>${esc(f.name)}</td>${PF.planList.map(p => `<td>${f.plans.includes(p.id) ? icon('check', 'ok') : '<span class="pf-dash">—</span>'}</td>`).join('')}</tr>`).join('');
            }).join('')}
          </tbody>
        </table>`;
    },

    // FAQ accordion — <div data-pf="faqs">
    faqs(el) {
      el.innerHTML = PF.FAQS.map((f, i) => `
        <details class="pf-faq" ${i === 0 ? 'open' : ''}>
          <summary>${esc(f.q)}</summary>
          <p>${esc(f.a)}</p>
        </details>`).join('');
    },

    // Use cases — <div data-pf="usecases">
    usecases(el) {
      el.innerHTML = PF.USE_CASES.map(u => `
        <article class="pf-uc">
          <div class="pf-uc__ic">${icon(u.icon)}</div>
          <h3>${esc(u.name)}</h3>
          <p>${esc(u.desc)}</p>
        </article>`).join('');
    },

    // Changelog timeline — <div data-pf="changelog">
    changelog(el) {
      const badge = (t) => `<span class="pf-badge pf-badge--${t}">${t}</span>`;
      el.innerHTML = `
        <div class="pf-cl__filters">
          <button class="pf-chip is-on" data-filter="all">All</button>
          ${['feature','improvement','fix','performance','security','ai'].map(t => `<button class="pf-chip" data-filter="${t}">${t}</button>`).join('')}
        </div>
        <div class="pf-timeline">
          ${PF.CHANGELOG.map(rel => `
            <article class="pf-rel" data-types="${[...new Set(rel.entries.map(e => e.type))].join(' ')}">
              <div class="pf-rel__meta">
                <span class="pf-rel__ver">v${rel.version}</span>
                <time>${new Date(rel.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</time>
              </div>
              <div class="pf-rel__body">
                <h3>${esc(rel.title)}</h3>
                <p class="pf-rel__impact">${icon('trending')} ${esc(rel.impact)}</p>
                <ul>${rel.entries.map(e => `<li data-type="${e.type}">${badge(e.type)} ${esc(e.text)}</li>`).join('')}</ul>
              </div>
            </article>`).join('')}
        </div>`;
      // filtering
      el.querySelectorAll('.pf-chip').forEach(chip => chip.addEventListener('click', () => {
        el.querySelectorAll('.pf-chip').forEach(c => c.classList.remove('is-on'));
        chip.classList.add('is-on');
        const f = chip.dataset.filter;
        el.querySelectorAll('.pf-rel').forEach(rel => {
          const items = rel.querySelectorAll('li');
          let any = false;
          items.forEach(li => { const show = f === 'all' || li.dataset.type === f; li.style.display = show ? '' : 'none'; if (show) any = true; });
          rel.style.display = any ? '' : 'none';
        });
      }));
    },

    // Interface showcase — <div data-pf="showcase"> (tabs + UI mockups + features)
    showcase(el) {
      const sidebar = (active) => {
        const nav = [['dashboard', 'gauge', 'Dashboard'], ['appointments', 'calendar', 'Appointments'], ['billing', 'receipt', 'Billing'], ['patients', 'users', 'Patients'], ['automation', 'whatsapp', 'AI Hub']];
        return `<aside class="pf-app__side"><div class="pf-app__brand"><span></span>PatientFlow</div>${nav.map(([id, ic, nm]) => `<div class="pf-app__nav ${active === id ? 'on' : ''}">${icon(ic)}<span>${nm}</span></div>`).join('')}</aside>`;
      };
      const main = {
        dashboard: `<div class="pf-app__top"><div class="pf-app__title">Dashboard</div><span class="pf-app__pill">Live</span></div>
          <div class="pf-app__stats">
            <div class="pf-card pf-app__stat"><div class="k">Today</div><div class="v">14</div></div>
            <div class="pf-card pf-app__stat"><div class="k">Collected</div><div class="v up">PKR 184k</div></div>
            <div class="pf-card pf-app__stat"><div class="k">Outstanding</div><div class="v or">PKR 42k</div></div>
            <div class="pf-card pf-app__stat"><div class="k">Patients</div><div class="v">1,240</div></div>
          </div>
          <div class="pf-card"><div style="font-weight:700;margin-bottom:6px">Revenue trend</div>
            <div class="pf-chartrow"><div class="pf-bars">${[38, 52, 44, 66, 58, 78, 72, 90].map(h => `<i style="height:${h}%"></i>`).join('')}</div>
            <div class="pf-legend"><div><span class="mut">This month</span><b>PKR 1.9M</b></div><div><span class="mut">Last month</span><b>PKR 1.6M</b></div><div><span class="mut">Growth</span><b style="color:#12a150">+18%</b></div></div></div></div>`,
        appointments: `<div class="pf-app__top"><div class="pf-app__title">Appointments</div><span class="pf-app__pill">Today · 14</span></div>
          <div class="pf-rows">
            ${[['09:00', 'Ahmed Waqar', 'Scaling & Polish', 'g', 'Confirmed'], ['10:30', 'Sara Malik', 'Root Canal', 'b', 'In chair'], ['11:15', 'Bilal Khan', 'Consultation', 'o', 'Waiting'], ['12:00', 'Hina Raza', 'Whitening', 'g', 'Confirmed'], ['13:30', 'Usman Ali', 'Follow-up', 'g', 'Confirmed']].map(([t, n, s, c, tag]) => `<div class="pf-row"><div class="pf-av">${t.slice(0, 2)}</div><div><div class="nm">${n}</div><div class="sub">${t} · ${s}</div></div><span class="pf-tag ${c}">${tag}</span></div>`).join('')}
          </div>`,
        billing: `<div class="pf-app__top"><div class="pf-app__title">Invoice · TSE-1042</div><span class="pf-app__pill">Paid</span></div>
          <div class="pf-card pf-inv">
            <div class="pf-inv__line"><span>Scaling & Polishing ×1</span><b>PKR 6,000</b></div>
            <div class="pf-inv__line"><span>Composite Filling ×2</span><b>PKR 9,000</b></div>
            <div class="pf-inv__line"><span>Discount (10%)</span><b style="color:#12a150">− PKR 1,500</b></div>
            <div class="pf-inv__total"><span>Total</span><span>PKR 13,500</span></div>
            <div class="pf-inv__pay"><div class="h">Payment details</div>
              <div class="r"><span>Bank</span><b>Meezan Bank</b></div>
              <div class="r"><span>Account</span><b>0123-4567890123</b></div>
              <div class="r"><span>IBAN</span><b>PK00 MEZN 0000 0123 4567</b></div></div>
          </div>`,
        patients: `<div class="pf-app__top"><div class="pf-app__title">Patients</div><span class="pf-app__pill">1,240</span></div>
          <div class="pf-rows">
            ${[['AW', 'Ahmed Waqar', 'PT-0153 · 0332-070050', 'g', 'Active'], ['SM', 'Sara Malik', 'PT-0154 · 0301-224510', 'b', 'New'], ['BK', 'Bilal Khan', 'PT-0148 · 0345-778120', 'o', 'Due'], ['HR', 'Hina Raza', 'PT-0140 · 0322-991233', 'g', 'Active']].map(([av, n, s, c, tag]) => `<div class="pf-row"><div class="pf-av">${av}</div><div><div class="nm">${n}</div><div class="sub">${s}</div></div><span class="pf-tag ${c}">${tag}</span></div>`).join('')}
          </div>`,
        automation: `<div class="pf-app__top"><div class="pf-app__title">AI &amp; WhatsApp</div><span class="pf-app__pill">Automated</span></div>
          <div class="pf-chat">
            <div class="pf-bub in"><div class="who">AI Receptionist</div>Hi Ahmed! This is a reminder for your appointment tomorrow at 9:00 AM. Reply 1 to confirm.</div>
            <div class="pf-bub out">1 ✓</div>
            <div class="pf-bub in"><div class="who">AI Receptionist</div>Confirmed! See you tomorrow 🦷</div>
          </div>
          <div style="display:grid;gap:6px;margin-top:10px">
            <div class="pf-auto"><span class="st"></span><b>Reminders</b><span class="mut">128 sent today</span></div>
            <div class="pf-auto"><span class="st"></span><b>Reactivation</b><span class="mut">17 replies</span></div>
            <div class="pf-auto"><span class="st"></span><b>Review requests</b><span class="mut">9 ★ this week</span></div>
          </div>`,
      };
      const win = (id) => `<div class="pf-win"><div class="pf-win__bar"><span class="pf-win__dot"></span><span class="pf-win__dot"></span><span class="pf-win__dot"></span><span class="pf-win__url">app.yourclinic.com/${id}</span></div><div class="pf-app">${sidebar(id)}<div class="pf-app__main">${main[id]}</div></div></div>`;
      const infoPanel = (s) => `<div class="pf-sc__info"><h3>${esc(s.name)}</h3><p>${esc(s.blurb)}</p><div class="pf-sc__feats">${s.features.map(fid => { const f = PF.featureById(fid); return f ? `<div class="pf-sc__feat">${icon(f.icon)}<div><strong>${esc(f.name)}</strong><p>${esc(f.desc)}</p></div></div>` : ''; }).join('')}</div></div>`;

      el.innerHTML = `
        <div class="pf-sc__tabs">${PF.SCREENS.map((s, i) => `<button class="pf-sc__tab ${i === 0 ? 'is-on' : ''}" data-screen="${s.id}">${icon(s.id === 'automation' ? 'whatsapp' : s.id === 'billing' ? 'receipt' : s.id === 'patients' ? 'users' : s.id === 'appointments' ? 'calendar' : 'gauge')}${esc(s.name)}</button>`).join('')}</div>
        <div class="pf-sc__stage"><div class="pf-sc__win">${win(PF.SCREENS[0].id)}</div>${infoPanel(PF.SCREENS[0])}</div>`;
      const stage = el.querySelector('.pf-sc__stage');
      el.querySelectorAll('.pf-sc__tab').forEach(tab => tab.addEventListener('click', () => {
        el.querySelectorAll('.pf-sc__tab').forEach(t => t.classList.remove('is-on'));
        tab.classList.add('is-on');
        const s = PF.SCREENS.find(x => x.id === tab.dataset.screen);
        stage.innerHTML = `<div class="pf-sc__win">${win(s.id)}</div>${infoPanel(s)}`;
      }));
    },

    // Security cards — <div data-pf="security">
    security(el) {
      el.innerHTML = PF.SECURITY.map(s => `
        <article class="pf-fcard">
          <div class="pf-fcard__ic">${icon(s.icon)}</div>
          <h3>${esc(s.title)}</h3>
          <p>${esc(s.desc)}</p>
        </article>`).join('');
    },

    // AI capabilities — <div data-pf="aicaps">
    aicaps(el) {
      el.innerHTML = PF.AI_CAPS.map(c => `
        <article class="pf-fcard">
          <div class="pf-fcard__ic">${icon(c.icon)}</div>
          <h3>${esc(c.title)} <span class="pf-badge pf-badge--${c.tag === 'Live' ? 'security' : 'ai'}" style="vertical-align:middle">${c.tag}</span></h3>
          <p>${esc(c.desc)}</p>
        </article>`).join('');
    },

    // Roadmap board — <div data-pf="roadmap">
    roadmap(el) {
      el.innerHTML = PF.ROADMAP_STATUSES.map(st => {
        const items = PF.ROADMAP.filter(r => r.status === st.id);
        return `
        <div class="pf-rmcol">
          <header class="pf-rmcol__h"><span class="pf-dot" style="background:${st.color}"></span>${st.name}<span class="pf-rmcol__n">${items.length}</span></header>
          ${items.map(r => `
            <article class="pf-rmcard">
              <h3>${esc(r.title)}</h3>
              <p>${esc(r.desc)}</p>
              ${r.progress > 0 && r.progress < 100 ? `<div class="pf-prog"><span style="width:${r.progress}%"></span></div>` : ''}
              <footer><span class="pf-rmcard__q">${esc(r.quarter)}</span>${r.votes ? `<span class="pf-rmcard__v">▲ ${r.votes}</span>` : ''}</footer>
            </article>`).join('') || '<p class="pf-rmcol__empty">Nothing here yet.</p>'}
        </div>`;
      }).join('');
    },
  };

  // Mount everything
  document.querySelectorAll('[data-pf]').forEach(el => { const fn = R[el.dataset.pf]; if (fn) try { fn(el); } catch (e) { console.error('PF render', el.dataset.pf, e); } });

  // Scroll reveal (shared)
  const io = new IntersectionObserver((ents) => ents.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(n => io.observe(n));
})();
