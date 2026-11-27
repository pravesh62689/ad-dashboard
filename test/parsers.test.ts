import { describe, expect, it } from 'vitest';
import { parseAdsterraBalance, parseAdsterraStats } from '../src/parsers/adsterra.js';
import { parseBloggerStatus } from '../src/parsers/blogger.js';
import { parseCfWebAnalytics } from '../src/parsers/cfAnalytics.js';
import { parseClickaduStats } from '../src/parsers/clickadu.js';
import { isTokenExpiredError, parseGscAnalytics, parseGscSitemaps } from '../src/parsers/gsc.js';
import { build30DaySeries, getDateWindows } from '../src/parsers/utils.js';

const NOW = new Date('2026-11-27T12:00:00.000Z');
const WINDOWS = getDateWindows(NOW);

describe('Adsterra parser', () => {
    it('aggregates today, 7d, month and placement units accurately', () => {
        const balance = parseAdsterraBalance({ balance: '14.52' });
        expect(balance).toBe(14.52);

        const fixture = {
            items: [
                { ddate: '2026-11-27', placement: '32499187', impression: 1000, clicks: 12, revenue: '1.25' },
                { ddate: '2026-11-27', placement: '32499188', impression: 500, clicks: 5, revenue: '0.25' },
                { ddate: '2026-11-22', placement: '32499189', impression: 2000, clicks: 30, revenue: '1.50' },
                { ddate: '2026-11-05', placement: '32499187', impression: 4000, clicks: 20, revenue: '2.00' },
            ],
        };

        const parsed = parseAdsterraStats(fixture, WINDOWS, balance);
        expect(parsed.status).toBe('ok');
        expect(parsed.balance).toBe(14.52);
        expect(parsed.today.impressions).toBe(1500);
        expect(parsed.today.clicks).toBe(17);
        expect(parsed.today.revenue).toBe(1.5);
        expect(parsed.today.cpm).toBe(1);

        expect(parsed.last7d.impressions).toBe(3500);
        expect(parsed.last7d.revenue).toBe(3);

        expect(parsed.last30d?.impressions).toBe(7500);
        expect(parsed.last30d?.revenue).toBe(5);

        expect(parsed.month.impressions).toBe(7500);
        expect(parsed.month.revenue).toBe(5);

        const popunder = parsed.units.find((u) => u.placementId === '32499187')!;
        expect(popunder.today.revenue).toBe(1.25);
        expect(popunder.month.revenue).toBe(3.25);
        expect(parsed.daily['2026-11-27']).toBe(1.5);
    });
});

describe('Clickadu parser', () => {
    it('aggregates today, 7d, month and daily map', () => {
        const fixture = {
            result: [
                { day: '2026-11-27', impressions: 800, clicks: 10, money: 0.8 },
                { day: '2026-11-24', impressions: 1200, clicks: 15, money: 1.2 },
                { day: '2026-11-02', impressions: 3000, clicks: 20, money: 2.0 },
            ],
        };

        const parsed = parseClickaduStats(fixture, WINDOWS);
        expect(parsed.status).toBe('ok');
        expect(parsed.today.impressions).toBe(800);
        expect(parsed.today.revenue).toBe(0.8);
        expect(parsed.last7d.revenue).toBe(2);
        expect(parsed.last30d?.revenue).toBe(4);
        expect(parsed.month.revenue).toBe(4);
        expect(parsed.daily['2026-11-24']).toBe(1.2);

        const bad = parseClickaduStats({ status: false, error: 'Invalid token' }, WINDOWS);
        expect(bad.status).toBe('error');
        expect(bad.error).toBe('Invalid token');
    });
});

describe('Google Search Console parsers', () => {
    it('parses top 10 queries and sitemap indexed/discovered counts', () => {
        const analytics = parseGscAnalytics({
            rows: [
                { keys: ['compress pdf 100kb'], clicks: 45, impressions: 900, ctr: 0.05, position: 4.2 },
                { keys: ['exam photo resizer'], clicks: 30, impressions: 600, ctr: 0.05, position: 6.1 },
            ],
        });
        expect(analytics.clicks).toBe(75);
        expect(analytics.impressions).toBe(1500);
        expect(analytics.topQueries).toHaveLength(2);
        expect(analytics.topQueries[0].ctr).toBe(5);

        const sitemaps = parseGscSitemaps({
            sitemap: [
                { contents: [{ type: 'web', submitted: '56', indexed: '12' }] },
                { contents: [{ type: 'web', submitted: '10', indexed: '10' }] },
            ],
        });
        expect(sitemaps).toEqual({ indexed: 22, discovered: 66, notIndexed: 44 });
    });

    it('detects expired OAuth tokens', () => {
        expect(isTokenExpiredError(400, '{"error":"invalid_grant"}')).toBe(true);
        expect(isTokenExpiredError(401, 'Unauthorized')).toBe(true);
        expect(isTokenExpiredError(500, 'Internal error')).toBe(false);
    });
});

describe('Cloudflare Web Analytics GraphQL parser', () => {
    it('parses summary, top pages, and top countries', () => {
        const summary = {
            data: { viewer: { accounts: [{ rumPageloadEventsAdaptiveGroups: [{ sum: { visits: 420, pageViews: 890 } }] }] } },
        };
        const pages = {
            data: {
                viewer: {
                    accounts: [
                        {
                            rumPageloadEventsAdaptiveGroups: [
                                { dimensions: { requestPath: '/tools/compress-pdf/' }, sum: { visits: 210, pageViews: 390 } },
                            ],
                        },
                    ],
                },
            },
        };
        const countries = {
            data: {
                viewer: {
                    accounts: [
                        {
                            rumPageloadEventsAdaptiveGroups: [
                                { dimensions: { countryName: 'IN' }, sum: { visits: 300, pageViews: 640 } },
                            ],
                        },
                    ],
                },
            },
        };

        const parsed = parseCfWebAnalytics(summary, pages, countries);
        expect(parsed.visitors).toBe(420);
        expect(parsed.pageviews).toBe(890);
        expect(parsed.topPages[0]).toEqual({ path: '/tools/compress-pdf/', views: 390, visitors: 210 });
        expect(parsed.topCountries[0]).toEqual({ country: 'IN', views: 640, visitors: 300 });
    });
});

describe('Blogger & AdSense tracker parser', () => {
    it('counts live/scheduled posts, next publish date, and substantial posts >=7d old', () => {
        const longBody = `<p>${'word '.repeat(650)}</p>`;
        const shortBody = '<p>Too short</p>';
        const live = {
            items: [
                { published: '2026-11-10T10:00:00Z', content: longBody },
                { published: '2026-11-25T10:00:00Z', content: longBody }, // < 7d old
                { published: '2026-11-01T10:00:00Z', content: shortBody }, // < 600w
            ],
        };
        const scheduled = {
            items: [
                { published: '2026-12-03T12:00:00Z' },
                { published: '2026-12-01T12:00:00Z' },
            ],
        };

        const parsed = parseBloggerStatus(live, scheduled, NOW);
        expect(parsed.livePosts).toBe(3);
        expect(parsed.scheduledPosts).toBe(2);
        expect(parsed.nextPublishDate).toBe('2026-12-01T12:00:00Z');
        expect(parsed.adsenseSubstantial).toBe(1);
        expect(parsed.adsenseTarget).toBe(20);
        expect(parsed.adsenseReady).toBe(false);
    });
});

describe('30-day revenue series builder', () => {
    it('builds 30 UTC days combining Adsterra and Clickadu', () => {
        const series = build30DaySeries({ '2026-11-27': 1.5 }, { '2026-11-27': 0.5 }, NOW);
        expect(series).toHaveLength(30);
        expect(series[29]).toEqual({
            date: '2026-11-27',
            adsterra: 1.5,
            clickadu: 0.5,
            total: 2,
        });
    });
});
