import { parseAdsterraBalance, parseAdsterraStats } from './parsers/adsterra.js';
import { parseBloggerStatus } from './parsers/blogger.js';
import { parseCfWebAnalytics } from './parsers/cfAnalytics.js';
import { parseClickaduStats } from './parsers/clickadu.js';
import {
    extractSitemapChildUrls,
    extractSitemapPageUrls,
    isTokenExpiredError,
    isUrlIndexed,
    parseGscAnalytics,
    parseGscSitemaps,
} from './parsers/gsc.js';
import { build30DaySeries, emptyMetrics, getDateWindows, type DateWindows } from './parsers/utils.js';
import { ADSTERRA_UNITS, SHIFTANDTIP_BLOG_ID } from './staticData.js';
import type {
    AdsterraData,
    BloggerData,
    CfAnalyticsData,
    ClickaduData,
    DashboardSnapshot,
    Env,
    GscSiteData,
} from './types.js';

async function fetchAdsterra(env: Env, windows: DateWindows): Promise<AdsterraData> {
    if (!env.ADSTERRA_API_TOKEN) {
        return {
            status: 'pending',
            error: 'Not connected',
            balance: null,
            today: emptyMetrics(),
            last7d: emptyMetrics(),
            month: emptyMetrics(),
            units: ADSTERRA_UNITS.map((u) => ({
                placementId: u.placementId,
                label: u.label,
                today: emptyMetrics(),
                last7d: emptyMetrics(),
                month: emptyMetrics(),
            })),
            daily: {},
        };
    }

    try {
        const start = windows.thirtyDaysAgoStr < windows.monthStartStr ? windows.thirtyDaysAgoStr : windows.monthStartStr;
        const url = new URL('https://api3.adsterratools.com/publisher/stats.json');
        url.searchParams.set('start_date', start);
        url.searchParams.set('finish_date', windows.todayStr);
        url.searchParams.append('group_by[]', 'date');
        url.searchParams.append('group_by[]', 'placement');

        const headers = {
            Accept: 'application/json',
            'X-API-Key': env.ADSTERRA_API_TOKEN,
        };

        const [statsRes, balRes] = await Promise.all([
            fetch(url.toString(), { headers }),
            fetch('https://api3.adsterratools.com/publisher/balance.json', { headers }).catch(() => null),
        ]);

        if (!statsRes.ok) {
            const detail = (await statsRes.text().catch(() => '')).slice(0, 120);
            return {
                status: 'error',
                error: statsRes.status === 401 ? 'error: invalid token' : `HTTP ${statsRes.status}${detail ? `: ${detail}` : ''}`,
                balance: null,
                today: emptyMetrics(),
                last7d: emptyMetrics(),
                month: emptyMetrics(),
                units: ADSTERRA_UNITS.map((u) => ({
                    placementId: u.placementId,
                    label: u.label,
                    today: emptyMetrics(),
                    last7d: emptyMetrics(),
                    month: emptyMetrics(),
                })),
                daily: {},
            };
        }

        const statsJson = await statsRes.json();
        let balance: number | null = null;
        if (balRes && balRes.ok) {
            balance = parseAdsterraBalance(await balRes.json());
        }
        return parseAdsterraStats(statsJson, windows, balance);
    } catch (err) {
        return {
            status: 'error',
            error: err instanceof Error ? err.message : 'Fetch error',
            balance: null,
            today: emptyMetrics(),
            last7d: emptyMetrics(),
            month: emptyMetrics(),
            units: ADSTERRA_UNITS.map((u) => ({
                placementId: u.placementId,
                label: u.label,
                today: emptyMetrics(),
                last7d: emptyMetrics(),
                month: emptyMetrics(),
            })),
            daily: {},
        };
    }
}

async function fetchClickadu(env: Env, windows: DateWindows): Promise<ClickaduData> {
    if (!env.CLICKADU_API_TOKEN) {
        return {
            status: 'pending',
            error: 'Approved — API token pending',
            today: emptyMetrics(),
            last7d: emptyMetrics(),
            month: emptyMetrics(),
            daily: {},
        };
    }

    try {
        const start = windows.thirtyDaysAgoStr < windows.monthStartStr ? windows.thirtyDaysAgoStr : windows.monthStartStr;
        const buildUrl = (proto: 'https' | 'http') => {
            const u = new URL(`${proto}://v2.api.clickadu.com/partner/stats`);
            u.searchParams.set('token', env.CLICKADU_API_TOKEN!);
            u.searchParams.set('dateFrom', start);
            u.searchParams.set('dateTo', windows.todayStr);
            u.searchParams.set('groupBy', 'day');
            u.searchParams.set('format', 'json');
            u.searchParams.set('timezone', 'EST');
            return u.toString();
        };

        let res: Response;
        try {
            res = await fetch(buildUrl('https'), { headers: { Accept: 'application/json' } });
            if (res.status >= 500) {
                res = await fetch(buildUrl('http'), { headers: { Accept: 'application/json' } });
            }
        } catch {
            res = await fetch(buildUrl('http'), { headers: { Accept: 'application/json' } });
        }

        if (!res.ok) {
            const detail = (await res.text().catch(() => '')).slice(0, 120);
            return {
                status: 'error',
                error: `HTTP ${res.status}${detail ? `: ${detail}` : ''}`,
                today: emptyMetrics(),
                last7d: emptyMetrics(),
                last30d: emptyMetrics(),
                month: emptyMetrics(),
                daily: {},
            };
        }
        return parseClickaduStats(await res.json(), windows);
    } catch (err) {
        return {
            status: 'error',
            error: err instanceof Error ? err.message : 'Fetch error',
            today: emptyMetrics(),
            last7d: emptyMetrics(),
            month: emptyMetrics(),
            daily: {},
        };
    }
}

async function refreshGoogleAccessToken(
    clientId: string,
    clientSecret: string,
    refreshToken: string,
): Promise<{ accessToken: string | null; expired: boolean; error?: string }> {
    const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
    });
    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });
    const text = await res.text();
    if (!res.ok) {
        return {
            accessToken: null,
            expired: isTokenExpiredError(res.status, text),
            error: `OAuth HTTP ${res.status}`,
        };
    }
    const json = JSON.parse(text) as { access_token?: string };
    return {
        accessToken: json.access_token ?? null,
        expired: !json.access_token,
    };
}

const MAX_INSPECT_PER_SITE = 60;
const INSPECT_BATCH_SIZE = 15;
const INSPECT_TTL_MS = 24 * 60 * 60 * 1000;

interface GscInspectCache {
    urls: string[];
    cursor: number;
    indexedCount: number;
    checkedCount: number;
    totalCount: number;
    checkedAt: string;
    completedAt: string | null;
}

async function fetchSitemapUrls(siteUrl: string, isFileBrik: boolean): Promise<string[]> {
    const base = siteUrl.replace(/\/$/, '');
    const found = new Set<string>();

    async function walk(smUrl: string, depth = 0): Promise<void> {
        if (depth > 3 || found.size >= MAX_INSPECT_PER_SITE) return;
        try {
            const res = await fetch(smUrl);
            if (!res.ok) return;
            const xml = await res.text();
            const children = extractSitemapChildUrls(xml);
            if (children.length > 0) {
                for (const c of children) {
                    await walk(c, depth + 1);
                    if (found.size >= MAX_INSPECT_PER_SITE) break;
                }
            } else {
                for (const u of extractSitemapPageUrls(xml)) {
                    found.add(u);
                    if (found.size >= MAX_INSPECT_PER_SITE) break;
                }
            }
        } catch {
            // ignore sitemap fetch errors
        }
    }

    if (isFileBrik) {
        await walk(`${base}/sitemap-index.xml`);
    } else {
        await walk(`${base}/sitemap.xml`);
        await walk(`${base}/sitemap-pages.xml`);
    }
    return [...found].slice(0, MAX_INSPECT_PER_SITE);
}

async function inspectSiteWithCache(
    env: Env,
    siteKey: 'filebrik' | 'shiftandtip',
    siteUrl: string,
    headers: Record<string, string>,
    now: Date,
): Promise<GscInspectCache> {
    const cacheKey = `gsc-inspect:v1:${siteKey}`;
    let cache: GscInspectCache | null = null;
    try {
        const raw = await env.DASHBOARD_KV.get(cacheKey);
        if (raw) cache = JSON.parse(raw) as GscInspectCache;
    } catch {
        cache = null;
    }

    if (cache?.completedAt) {
        const ageMs = now.getTime() - Date.parse(cache.completedAt);
        if (Number.isFinite(ageMs) && ageMs < INSPECT_TTL_MS) {
            return cache;
        }
    }

    if (!cache || cache.completedAt) {
        const urls = await fetchSitemapUrls(siteUrl, siteKey === 'filebrik');
        cache = {
            urls,
            cursor: 0,
            indexedCount: 0,
            checkedCount: 0,
            totalCount: urls.length,
            checkedAt: now.toISOString(),
            completedAt: urls.length === 0 ? now.toISOString() : null,
        };
    }

    const end = Math.min(cache.urls.length, cache.cursor + INSPECT_BATCH_SIZE);
    for (let i = cache.cursor; i < end; i++) {
        try {
            const res = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    inspectionUrl: cache.urls[i],
                    siteUrl,
                    languageCode: 'en-US',
                }),
            });
            if (res.ok) {
                const payload = await res.json();
                if (isUrlIndexed(payload)) cache.indexedCount += 1;
                cache.checkedCount += 1;
            }
        } catch {
            // continue on transient inspection error
        }
        cache.cursor = i + 1;
    }

    cache.checkedAt = now.toISOString();
    if (cache.cursor >= cache.urls.length) {
        cache.completedAt = cache.checkedAt;
    }

    await env.DASHBOARD_KV.put(cacheKey, JSON.stringify(cache));
    return cache;
}

async function fetchGscSite(
    env: Env,
    siteKey: 'filebrik' | 'shiftandtip',
    siteUrl: string,
    accountEmail: string,
    refreshToken: string | undefined,
    windows: DateWindows,
    now: Date,
): Promise<GscSiteData> {
    const empty: GscSiteData = {
        status: 'pending',
        tokenExpired: false,
        siteUrl,
        accountEmail,
        indexed: 0,
        discovered: 0,
        notIndexed: 0,
        clicks: 0,
        impressions: 0,
        topQueries: [],
    };

    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !refreshToken) {
        empty.error = 'Missing Google OAuth secrets';
        return empty;
    }

    try {
        const auth = await refreshGoogleAccessToken(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, refreshToken);
        if (!auth.accessToken) {
            return {
                ...empty,
                status: auth.expired ? 'expired' : 'error',
                tokenExpired: auth.expired,
                error: auth.error ?? 'Token refresh failed',
            };
        }

        const headers = {
            Authorization: `Bearer ${auth.accessToken}`,
            'Content-Type': 'application/json',
        };
        const encodedSite = encodeURIComponent(siteUrl);

        const [analyticsRes, sitemapsRes, inspectCache] = await Promise.all([
            fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodedSite}/searchAnalytics/query`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    startDate: windows.thirtyDaysAgoStr,
                    endDate: windows.todayStr,
                    dimensions: ['query'],
                    rowLimit: 10,
                }),
            }),
            fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodedSite}/sitemaps`, { headers }),
            inspectSiteWithCache(env, siteKey, siteUrl, headers, now),
        ]);

        if (!analyticsRes.ok) {
            const errText = await analyticsRes.text();
            const expired = isTokenExpiredError(analyticsRes.status, errText);
            return {
                ...empty,
                status: expired ? 'expired' : 'error',
                tokenExpired: expired,
                error: `GSC HTTP ${analyticsRes.status}`,
            };
        }

        const analytics = parseGscAnalytics(await analyticsRes.json());
        const sitemaps = sitemapsRes.ok ? parseGscSitemaps(await sitemapsRes.json()) : { indexed: 0, discovered: 0, notIndexed: 0 };
        const baseTotal = sitemaps.discovered > 0 ? sitemaps.discovered : inspectCache.checkedCount;

        return {
            status: 'ok',
            tokenExpired: false,
            siteUrl,
            accountEmail,
            indexed: inspectCache.indexedCount,
            inspectTotal: inspectCache.totalCount,
            inspectChecked: inspectCache.checkedCount,
            inspectCheckedAt: inspectCache.completedAt ?? inspectCache.checkedAt,
            discovered: sitemaps.discovered,
            notIndexed: Math.max(0, baseTotal - inspectCache.indexedCount),
            ...analytics,
        };
    } catch (err) {
        return {
            ...empty,
            status: 'error',
            error: err instanceof Error ? err.message : 'Fetch error',
        };
    }
}

async function fetchCfAnalytics(env: Env, windows: DateWindows): Promise<CfAnalyticsData> {
    if (!env.CF_ANALYTICS_TOKEN || !env.CF_ACCOUNT_ID || !env.CF_WEB_ANALYTICS_SITE_TAG) {
        return {
            status: 'pending',
            error: 'Set CF_ANALYTICS_TOKEN, CF_ACCOUNT_ID, CF_WEB_ANALYTICS_SITE_TAG',
            visitors: 0,
            pageviews: 0,
            topPages: [],
            topCountries: [],
        };
    }

    const runQuery = async (query: string) => {
        const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${env.CF_ANALYTICS_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query,
                variables: {
                    accountTag: env.CF_ACCOUNT_ID,
                    siteTag: env.CF_WEB_ANALYTICS_SITE_TAG,
                    start: windows.thirtyDaysAgoStr,
                    end: windows.todayStr,
                },
            }),
        });
        if (!res.ok) throw new Error(`CF GraphQL HTTP ${res.status}`);
        return res.json();
    };

    try {
        const [summaryPayload, pagesPayload, countriesPayload] = await Promise.all([
            runQuery(`query($accountTag: String!, $siteTag: String!, $start: Date!, $end: Date!) {
                viewer { accounts(filter: { accountTag: $accountTag }) {
                    rumPageloadEventsAdaptiveGroups(limit: 1, filter: { siteTag: $siteTag, date_geq: $start, date_leq: $end }) {
                        sum { visits pageViews }
                    }
                } }
            }`),
            runQuery(`query($accountTag: String!, $siteTag: String!, $start: Date!, $end: Date!) {
                viewer { accounts(filter: { accountTag: $accountTag }) {
                    rumPageloadEventsAdaptiveGroups(limit: 10, filter: { siteTag: $siteTag, date_geq: $start, date_leq: $end }, orderBy: [sum_pageViews_DESC]) {
                        dimensions { requestPath }
                        sum { visits pageViews }
                    }
                } }
            }`),
            runQuery(`query($accountTag: String!, $siteTag: String!, $start: Date!, $end: Date!) {
                viewer { accounts(filter: { accountTag: $accountTag }) {
                    rumPageloadEventsAdaptiveGroups(limit: 10, filter: { siteTag: $siteTag, date_geq: $start, date_leq: $end }, orderBy: [sum_visits_DESC]) {
                        dimensions { countryName }
                        sum { visits pageViews }
                    }
                } }
            }`),
        ]);

        return parseCfWebAnalytics(summaryPayload, pagesPayload, countriesPayload);
    } catch (err) {
        return {
            status: 'error',
            error: err instanceof Error ? err.message : 'Fetch error',
            visitors: 0,
            pageviews: 0,
            topPages: [],
            topCountries: [],
        };
    }
}

async function fetchBlogger(env: Env, now: Date): Promise<BloggerData> {
    const empty: BloggerData = {
        status: 'pending',
        tokenExpired: false,
        blogId: SHIFTANDTIP_BLOG_ID,
        livePosts: 0,
        scheduledPosts: 0,
        nextPublishDate: null,
        adsenseSubstantial: 0,
        adsenseTarget: 20,
        adsenseReady: false,
    };

    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.BLOGGER_REFRESH_TOKEN) {
        empty.error = 'Set BLOGGER_REFRESH_TOKEN + Google OAuth secrets';
        return empty;
    }

    try {
        const auth = await refreshGoogleAccessToken(
            env.GOOGLE_CLIENT_ID,
            env.GOOGLE_CLIENT_SECRET,
            env.BLOGGER_REFRESH_TOKEN,
        );
        if (!auth.accessToken) {
            return {
                ...empty,
                status: auth.expired ? 'expired' : 'error',
                tokenExpired: auth.expired,
                error: auth.error ?? 'Token refresh failed',
            };
        }

        const headers = { Authorization: `Bearer ${auth.accessToken}` };
        const [liveRes, schedRes] = await Promise.all([
            fetch(`https://www.googleapis.com/blogger/v3/blogs/${SHIFTANDTIP_BLOG_ID}/posts?status=LIVE&maxResults=100`, {
                headers,
            }),
            fetch(
                `https://www.googleapis.com/blogger/v3/blogs/${SHIFTANDTIP_BLOG_ID}/posts?status=SCHEDULED&maxResults=100`,
                { headers },
            ),
        ]);

        if (!liveRes.ok || !schedRes.ok) {
            const errText = await (!liveRes.ok ? liveRes : schedRes).text();
            const status = !liveRes.ok ? liveRes.status : schedRes.status;
            const expired = isTokenExpiredError(status, errText);
            return {
                ...empty,
                status: expired ? 'expired' : 'error',
                tokenExpired: expired,
                error: `Blogger HTTP ${status}`,
            };
        }

        return parseBloggerStatus(await liveRes.json(), await schedRes.json(), now);
    } catch (err) {
        return {
            ...empty,
            status: 'error',
            error: err instanceof Error ? err.message : 'Fetch error',
        };
    }
}

export async function collectDashboardSnapshot(env: Env, now: Date = new Date()): Promise<DashboardSnapshot> {
    const windows = getDateWindows(now);
    const [adsterra, clickadu, filebrikGsc, shiftGsc, cfAnalytics, blogger] = await Promise.all([
        fetchAdsterra(env, windows),
        fetchClickadu(env, windows),
        fetchGscSite(env, 'filebrik', 'https://filebrik.pages.dev/', 'praveshrathore2002@gmail.com', env.GSC_FILEBRIK_REFRESH_TOKEN, windows, now),
        fetchGscSite(env, 'shiftandtip', 'https://shiftandtip.blogspot.com/', 'rathore.monty2002@gmail.com', env.GSC_SHIFTANDTIP_REFRESH_TOKEN, windows, now),
        fetchCfAnalytics(env, windows),
        fetchBlogger(env, now),
    ]);

    return {
        updatedAt: now.toISOString(),
        adsterra,
        clickadu,
        gsc: {
            filebrik: filebrikGsc,
            shiftandtip: shiftGsc,
        },
        cfAnalytics,
        blogger,
        revenueSeries30d: build30DaySeries(adsterra.daily, clickadu.daily, now),
    };
}
