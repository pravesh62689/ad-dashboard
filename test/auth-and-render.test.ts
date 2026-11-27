import { describe, expect, it } from 'vitest';
import { checkDashboardAuth } from '../src/auth.js';
import { build30DaySeries, emptyMetrics } from '../src/parsers/utils.js';
import { renderDashboardHtml } from '../src/render.js';
import { ADSTERRA_UNITS, SHIFTANDTIP_BLOG_ID } from '../src/staticData.js';
import type { DashboardSnapshot } from '../src/types.js';

describe('HTTP Basic Auth', () => {
    it('fails closed (503) when DASH_PASSWORD is not configured', () => {
        const req = new Request('https://ad-dashboard.example.workers.dev/');
        const res = checkDashboardAuth(req, undefined);
        expect(res?.status).toBe(503);
    });

    it('rejects missing or wrong credentials with 401', () => {
        const req1 = new Request('https://ad-dashboard.example.workers.dev/');
        const res1 = checkDashboardAuth(req1, 'secret-pass');
        expect(res1?.status).toBe(401);
        expect(res1?.headers.get('WWW-Authenticate')).toContain('Basic');

        const badAuth = 'Basic ' + btoa('pravesh:wrong-pass');
        const req2 = new Request('https://ad-dashboard.example.workers.dev/', { headers: { Authorization: badAuth } });
        expect(checkDashboardAuth(req2, 'secret-pass')?.status).toBe(401);
    });

    it('allows valid pravesh credentials', () => {
        const goodAuth = 'Basic ' + btoa('pravesh:secret-pass');
        const req = new Request('https://ad-dashboard.example.workers.dev/', { headers: { Authorization: goodAuth } });
        expect(checkDashboardAuth(req, 'secret-pass')).toBeNull();
    });
});

describe('Dashboard HTML renderer', () => {
    it('renders SVG chart, expired token banner, Pending Clickadu, and static Accounts & Payouts', () => {
        const snapshot: DashboardSnapshot = {
            updatedAt: '2026-11-27T04:00:00.000Z',
            adsterra: {
                status: 'ok',
                balance: 12.34,
                today: { impressions: 1000, clicks: 10, cpm: 1.2, revenue: 1.2 },
                last7d: emptyMetrics(),
                month: emptyMetrics(),
                units: ADSTERRA_UNITS.map((u) => ({
                    placementId: u.placementId,
                    label: u.label,
                    today: emptyMetrics(),
                    last7d: emptyMetrics(),
                    month: emptyMetrics(),
                })),
                daily: { '2026-11-27': 1.2 },
            },
            clickadu: {
                status: 'pending',
                today: emptyMetrics(),
                last7d: emptyMetrics(),
                month: emptyMetrics(),
                daily: {},
            },
            gsc: {
                filebrik: {
                    status: 'expired',
                    tokenExpired: true,
                    error: 'OAuth HTTP 400',
                    siteUrl: 'https://filebrik.pages.dev/',
                    accountEmail: 'praveshrathore2002@gmail.com',
                    indexed: 5,
                    inspectTotal: 56,
                    inspectCheckedAt: '2026-11-27T18:00:00.000Z',
                    discovered: 56,
                    notIndexed: 51,
                    clicks: 12,
                    impressions: 240,
                    topQueries: [{ query: 'compress pdf', clicks: 5, impressions: 100, ctr: 5, position: 8.1 }],
                },
                shiftandtip: {
                    status: 'ok',
                    tokenExpired: false,
                    siteUrl: 'https://shiftandtip.blogspot.com/',
                    accountEmail: 'rathore.monty2002@gmail.com',
                    indexed: 7,
                    discovered: 10,
                    notIndexed: 3,
                    clicks: 3,
                    impressions: 90,
                    topQueries: [],
                },
            },
            cfAnalytics: {
                status: 'ok',
                visitors: 100,
                pageviews: 250,
                topPages: [{ path: '/', views: 100, visitors: 80 }],
                topCountries: [{ country: 'IN', views: 200, visitors: 90 }],
            },
            blogger: {
                status: 'ok',
                tokenExpired: false,
                blogId: SHIFTANDTIP_BLOG_ID,
                livePosts: 7,
                scheduledPosts: 19,
                nextPublishDate: '2026-12-01T12:00:00Z',
                adsenseSubstantial: 0,
                adsenseTarget: 20,
                adsenseReady: false,
            },
            revenueSeries30d: build30DaySeries({ '2026-11-27': 1.2 }, {}, new Date('2026-11-27T04:00:00.000Z')),
        };

        const html = renderDashboardHtml(snapshot, new Date('2026-11-27T04:30:00.000Z'));
        expect(html).toContain('<svg viewBox="0 0 720 210"');
        expect(html).toContain('token expired');
        expect(html).toContain('npm run reauth');
        expect(html).not.toContain('Stale data');
        expect(html).toContain('Approved — API token pending');
        expect(html).toContain('Pending');
        expect(html).toContain('32499187');
        expect(html).toContain('praveshrathore2002@gmail.com');
        expect(html).toContain('rathore.monty2002@gmail.com');
        expect(html).toContain('PNB Bank Transfer');
        expect(html).toContain('Substantial posts toward AdSense');
        expect(html).toContain('Indexed (checked 2026-11-27)');
        expect(html).toContain('5/56');
        expect(html).toContain('0/20');

        const staleHtml = renderDashboardHtml(snapshot, new Date('2026-11-27T07:00:00.000Z'));
        expect(staleHtml).toContain('Stale data');
    });
});
