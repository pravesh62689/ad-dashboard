import { ACCOUNTS_AND_PAYOUTS } from './staticData.js';
import type { DailyRevenuePoint, DashboardSnapshot, GscSiteData, PeriodMetrics } from './types.js';

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtUsd(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return `$${n.toFixed(2)}`;
}

function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return Math.round(n).toLocaleString('en-US');
}

function statusBadge(status: string, pendingLabel = 'Pending'): string {
  if (status === 'ok') return '<span class="badge ok">Live</span>';
  if (status === 'pending') return `<span class="badge pending">${esc(pendingLabel)}</span>`;
  if (status === 'expired') return '<span class="badge err">Token expired</span>';
  return '<span class="badge err">Error</span>';
}

export function renderRevenueChartSvg(series: DailyRevenuePoint[]): string {
  const w = 720;
  const h = 210;
  const padL = 44;
  const padR = 16;
  const padT = 16;
  const padB = 28;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const maxVal = Math.max(1, ...series.map((p) => p.total));
  const stepX = series.length > 1 ? plotW / (series.length - 1) : plotW;

  const coords = series.map((p, idx) => {
    const x = padL + idx * stepX;
    const y = padT + plotH - (p.total / maxVal) * plotH;
    return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)), point: p };
  });

  const polyline = coords.map((c) => `${c.x},${c.y}`).join(' ');
  const area =
    coords.length > 0
      ? `M ${padL},${padT + plotH} L ${coords.map((c) => `${c.x},${c.y}`).join(' L ')} L ${coords[coords.length - 1].x},${padT + plotH} Z`
      : '';

  const gridLines = [0, 0.5, 1].map((frac) => {
    const y = Number((padT + plotH - frac * plotH).toFixed(1));
    const label = `$${(maxVal * frac).toFixed(2)}`;
    return `<line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="#e2e8f0" stroke-dasharray="3 3" />
<text x="${padL - 6}" y="${y + 4}" text-anchor="end" font-size="10" fill="#64748b">${esc(label)}</text>`;
  });

  const dots = coords.map(
    (c) =>
      `<circle cx="${c.x}" cy="${c.y}" r="3" fill="#0f766e"><title>${esc(c.point.date)}: ${fmtUsd(c.point.total)} (Adsterra ${fmtUsd(c.point.adsterra)}, Clickadu ${fmtUsd(c.point.clickadu)})</title></circle>`,
  );

  const firstDate = series[0]?.date ?? '';
  const midDate = series[Math.floor(series.length / 2)]?.date ?? '';
  const lastDate = series[series.length - 1]?.date ?? '';

  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="210" role="img" aria-label="30-day revenue line chart">
  ${gridLines.join('\n  ')}
  ${area ? `<path d="${area}" fill="#0f766e" fill-opacity="0.10" />` : ''}
  ${polyline ? `<polyline fill="none" stroke="#0f766e" stroke-width="2.2" points="${polyline}" />` : ''}
  ${dots.join('\n  ')}
  <text x="${padL}" y="${h - 8}" font-size="10" fill="#64748b">${esc(firstDate)}</text>
  <text x="${padL + plotW / 2}" y="${h - 8}" text-anchor="middle" font-size="10" fill="#64748b">${esc(midDate)}</text>
  <text x="${w - padR}" y="${h - 8}" text-anchor="end" font-size="10" fill="#64748b">${esc(lastDate)}</text>
</svg>`;
}

function renderPeriodRow(label: string, m: PeriodMetrics): string {
  return `<tr>
  <td>${esc(label)}</td>
  <td>${fmtNum(m.impressions)}</td>
  <td>${fmtNum(m.clicks)}</td>
  <td>${fmtUsd(m.cpm)}</td>
  <td><strong>${fmtUsd(m.revenue)}</strong></td>
</tr>`;
}

function renderGscCard(title: string, gsc: GscSiteData): string {
  const queriesRows =
    gsc.topQueries.length > 0
      ? gsc.topQueries
        .map(
          (q) =>
            `<tr><td>${esc(q.query)}</td><td>${fmtNum(q.clicks)}</td><td>${fmtNum(q.impressions)}</td><td>${q.ctr}%</td><td>${q.position}</td></tr>`,
        )
        .join('')
      : '<tr><td colspan="5" class="muted">No query data yet</td></tr>';

  return `<section class="card">
  <div class="card-head">
    <h3>GSC — ${esc(title)}</h3>
    ${statusBadge(gsc.status)}
  </div>
  <p class="muted">${esc(gsc.siteUrl)} · ${esc(gsc.accountEmail)}${gsc.error ? ` · ${esc(gsc.error)}` : ''}</p>
  <div class="mini-grid">
    <div><span class="k">Indexed${gsc.inspectCheckedAt ? ` (checked ${esc(gsc.inspectCheckedAt.slice(0, 10))})` : ''}</span><span class="v">${fmtNum(gsc.indexed)}/${fmtNum(gsc.inspectTotal ?? gsc.discovered)}</span></div>
    <div><span class="k">Discovered</span><span class="v">${fmtNum(gsc.discovered)}</span></div>
    <div><span class="k">Not Indexed</span><span class="v">${fmtNum(gsc.notIndexed)}</span></div>
    <div><span class="k">Clicks (30d)</span><span class="v">${fmtNum(gsc.clicks)}</span></div>
    <div><span class="k">Impressions (30d)</span><span class="v">${fmtNum(gsc.impressions)}</span></div>
  </div>
  <h4>Top 10 Queries</h4>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Query</th><th>Clicks</th><th>Impr.</th><th>CTR</th><th>Pos</th></tr></thead>
      <tbody>${queriesRows}</tbody>
    </table>
  </div>
</section>`;
}

const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000;

export function isSnapshotStale(updatedAt: string, now: Date = new Date()): boolean {
  const ts = Date.parse(updatedAt);
  if (!Number.isFinite(ts)) return true;
  return now.getTime() - ts > STALE_THRESHOLD_MS;
}

export function renderDashboardHtml(snapshot: DashboardSnapshot, now: Date = new Date()): string {
  const anyExpired = snapshot.gsc.filebrik.tokenExpired || snapshot.gsc.shiftandtip.tokenExpired || snapshot.blogger.tokenExpired;
  const isStale = isSnapshotStale(snapshot.updatedAt, now);

  const totalToday = snapshot.adsterra.today.revenue + snapshot.clickadu.today.revenue;
  const total7d = snapshot.adsterra.last7d.revenue + snapshot.clickadu.last7d.revenue;
  const totalMonth = snapshot.adsterra.month.revenue + snapshot.clickadu.month.revenue;

  const unitRows = snapshot.adsterra.units
    .map(
      (u) => `<tr>
  <td>${esc(u.label)} (<code>${esc(u.placementId)}</code>)</td>
  <td>${fmtNum(u.today.impressions)} / ${fmtUsd(u.today.revenue)}</td>
  <td>${fmtNum(u.last7d.impressions)} / ${fmtUsd(u.last7d.revenue)}</td>
  <td>${fmtNum(u.month.impressions)} / ${fmtUsd(u.month.revenue)}</td>
</tr>`,
    )
    .join('');

  const pagesRows =
    snapshot.cfAnalytics.topPages.length > 0
      ? snapshot.cfAnalytics.topPages
        .map((p) => `<tr><td>${esc(p.path)}</td><td>${fmtNum(p.views)}</td><td>${fmtNum(p.visitors)}</td></tr>`)
        .join('')
      : '<tr><td colspan="3" class="muted">No pageviews yet</td></tr>';

  const countryRows =
    snapshot.cfAnalytics.topCountries.length > 0
      ? snapshot.cfAnalytics.topCountries
        .map((c) => `<tr><td>${esc(c.country)}</td><td>${fmtNum(c.views)}</td><td>${fmtNum(c.visitors)}</td></tr>`)
        .join('')
      : '<tr><td colspan="3" class="muted">No country data yet</td></tr>';

  const accountRows = ACCOUNTS_AND_PAYOUTS.map(
    (a) => `<tr>
  <td><strong>${esc(a.site)}</strong></td>
  <td>${esc(a.host)}</td>
  <td>${esc(a.owningEmail)}</td>
  <td>${esc(a.adNetworks)}</td>
  <td>${esc(a.payoutMethodAndMin)}</td>
</tr>`,
  ).join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Earnings &amp; Insights</title>
  <style>
    :root { --bg: #f8fafc; --card: #ffffff; --ink: #0f172a; --muted: #64748b; --line: #e2e8f0; --accent: #0f766e; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background: var(--bg); color: var(--ink); line-height: 1.45; }
    main { max-width: 1120px; margin: 0 auto; padding: 20px 16px 48px; }
    header { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 8px; margin-bottom: 16px; }
    h1 { margin: 0; font-size: 1.4rem; }
    h2, h3, h4 { margin: 0 0 8px; font-size: 1rem; }
    h4 { margin-top: 14px; font-size: 0.9rem; color: var(--muted); }
    .muted { color: var(--muted); font-size: 0.85rem; margin: 4px 0 10px; }
    .banner { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 10px 14px; border-radius: 8px; margin-bottom: 16px; font-weight: 600; }
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-bottom: 16px; }
    .grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; margin-bottom: 16px; }
    .card { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 16px; margin-bottom: 16px; }
    .grid-2 .card { margin-bottom: 0; }
    .card-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .kpi .k, .mini-grid .k { display: block; font-size: 0.78rem; color: var(--muted); }
    .kpi .v { font-size: 1.35rem; font-weight: 700; }
    .mini-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(90px, 1fr)); gap: 8px; margin: 10px 0; }
    .mini-grid .v { font-size: 1.05rem; font-weight: 600; }
    .badge { font-size: 0.75rem; padding: 2px 8px; border-radius: 999px; font-weight: 600; }
    .badge.ok { background: #dcfce7; color: #166534; }
    .badge.pending { background: #fef9c3; color: #854d0e; }
    .badge.err { background: #fee2e2; color: #991b1b; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--line); white-space: nowrap; }
    th { color: var(--muted); font-weight: 600; }
    code { background: #f1f5f9; padding: 1px 4px; border-radius: 4px; font-size: 0.8rem; }
  </style>
</head>
<body>
<main>
  <header>
    <h1>Earnings &amp; Insights</h1>
    <span class="muted">Last updated: ${esc(snapshot.updatedAt)} · <a href="?refresh=1">Refresh now</a></span>
  </header>

  ${anyExpired ? '<div class="banner">token expired → run <code>npm run reauth</code></div>' : ''}
  ${isStale ? '<div class="banner">Stale data — last updated over 2 hours ago</div>' : ''}

  <div class="kpi-grid">
    <div class="card kpi"><span class="k">Revenue Today</span><span class="v">${fmtUsd(totalToday)}</span></div>
    <div class="card kpi"><span class="k">Revenue (7d)</span><span class="v">${fmtUsd(total7d)}</span></div>
    <div class="card kpi"><span class="k">Revenue (Month)</span><span class="v">${fmtUsd(totalMonth)}</span></div>
    <div class="card kpi"><span class="k">Adsterra Balance</span><span class="v">${fmtUsd(snapshot.adsterra.balance)}</span></div>
    <div class="card kpi"><span class="k">FileBrik Visitors (30d)</span><span class="v">${fmtNum(snapshot.cfAnalytics.visitors)}</span></div>
    <div class="card kpi"><span class="k">Substantial posts toward AdSense</span><span class="v">${snapshot.blogger.adsenseSubstantial}/${snapshot.blogger.adsenseTarget}</span></div>
  </div>

  <section class="card">
    <div class="card-head">
      <h2>30-Day Revenue</h2>
      <span class="muted">Combined Adsterra + Clickadu (USD)</span>
    </div>
    ${renderRevenueChartSvg(snapshot.revenueSeries30d)}
  </section>

  <div class="grid-2">
    <section class="card">
      <div class="card-head">
        <h3>Adsterra Publisher</h3>
        ${statusBadge(snapshot.adsterra.status, 'Not connected')}
      </div>
      <p class="muted">Balance: <strong>${fmtUsd(snapshot.adsterra.balance)}</strong>${snapshot.adsterra.error ? ` · ${esc(snapshot.adsterra.error)}` : ''}</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Period</th><th>Impr.</th><th>Clicks</th><th>CPM</th><th>Revenue</th></tr></thead>
          <tbody>
            ${renderPeriodRow('Today', snapshot.adsterra.today)}
            ${renderPeriodRow('Last 7 days', snapshot.adsterra.last7d)}
            ${renderPeriodRow('Last 30 days', snapshot.adsterra.last30d ?? snapshot.adsterra.month)}
            ${renderPeriodRow('This month', snapshot.adsterra.month)}
          </tbody>
        </table>
      </div>
      <h4>Per Unit (Impr. / Revenue)</h4>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Unit</th><th>Today</th><th>7d</th><th>Month</th></tr></thead>
          <tbody>${unitRows}</tbody>
        </table>
      </div>
    </section>

    <section class="card">
      <div class="card-head">
        <h3>Clickadu Publisher</h3>
        ${statusBadge(snapshot.clickadu.status)}
      </div>
      <p class="muted">${snapshot.clickadu.status === 'pending' ? 'Approved — API token pending' : esc(snapshot.clickadu.error ?? 'Active')}</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Period</th><th>Impr.</th><th>Clicks</th><th>CPM</th><th>Revenue</th></tr></thead>
          <tbody>
            ${renderPeriodRow('Today', snapshot.clickadu.today)}
            ${renderPeriodRow('Last 7 days', snapshot.clickadu.last7d)}
            ${renderPeriodRow('Last 30 days', snapshot.clickadu.last30d ?? snapshot.clickadu.month)}
            ${renderPeriodRow('This month', snapshot.clickadu.month)}
          </tbody>
        </table>
      </div>
    </section>
  </div>

  <div class="grid-2" style="margin-top:16px">
    ${renderGscCard('FileBrik', snapshot.gsc.filebrik)}
    ${renderGscCard('Shift &amp; Tip', snapshot.gsc.shiftandtip)}
  </div>

  <div class="grid-2" style="margin-top:16px">
    <section class="card">
      <div class="card-head">
        <h3>Cloudflare Web Analytics — filebrik.pages.dev</h3>
        ${statusBadge(snapshot.cfAnalytics.status)}
      </div>
      <p class="muted">${snapshot.cfAnalytics.error ? esc(snapshot.cfAnalytics.error) : 'Last 30 days (RUM)'}</p>
      <div class="mini-grid">
        <div><span class="k">Visitors</span><span class="v">${fmtNum(snapshot.cfAnalytics.visitors)}</span></div>
        <div><span class="k">Pageviews</span><span class="v">${fmtNum(snapshot.cfAnalytics.pageviews)}</span></div>
      </div>
      <h4>Top Pages</h4>
      <div class="table-wrap">
        <table><thead><tr><th>Path</th><th>Views</th><th>Visitors</th></tr></thead><tbody>${pagesRows}</tbody></table>
      </div>
      <h4>Top Countries</h4>
      <div class="table-wrap">
        <table><thead><tr><th>Country</th><th>Views</th><th>Visitors</th></tr></thead><tbody>${countryRows}</tbody></table>
      </div>
    </section>

    <section class="card">
      <div class="card-head">
        <h3>Blogger &amp; AdSense — Shift &amp; Tip</h3>
        ${statusBadge(snapshot.blogger.status)}
      </div>
      <p class="muted">Blog ID: <code>${esc(snapshot.blogger.blogId)}</code>${snapshot.blogger.error ? ` · ${esc(snapshot.blogger.error)}` : ''}</p>
      <div class="mini-grid">
        <div><span class="k">Live Posts</span><span class="v">${fmtNum(snapshot.blogger.livePosts)}</span></div>
        <div><span class="k">Scheduled</span><span class="v">${fmtNum(snapshot.blogger.scheduledPosts)}</span></div>
        <div><span class="k">Next Publish</span><span class="v">${esc(snapshot.blogger.nextPublishDate ? snapshot.blogger.nextPublishDate.slice(0, 10) : '—')}</span></div>
        <div><span class="k">Substantial posts toward AdSense</span><span class="v">${snapshot.blogger.adsenseSubstantial}/${snapshot.blogger.adsenseTarget}</span></div>
      </div>
      <p class="muted">AdSense gate: <strong>${snapshot.blogger.adsenseReady ? 'READY TO APPLY' : `Waiting (${snapshot.blogger.adsenseSubstantial}/${snapshot.blogger.adsenseTarget} substantial posts >=600w live >=7d; ${fmtNum(snapshot.blogger.livePosts)} live total)`}</strong></p>
    </section>
  </div>

  <section class="card" style="margin-top:16px">
    <h3>Accounts &amp; Payouts</h3>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Site</th><th>Host</th><th>Owning Email</th><th>Ad Networks</th><th>Payout Method &amp; Minimum</th></tr></thead>
        <tbody>${accountRows}</tbody>
      </table>
    </div>
  </section>
</main>
</body>
</html>`;
}
