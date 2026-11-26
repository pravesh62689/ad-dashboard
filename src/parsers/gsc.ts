import type { GscQueryRow } from '../types.js';
import { toNumber } from './utils.js';

export function isTokenExpiredError(status: number, bodyText: string): boolean {
    if (status === 401) return true;
    return /invalid_grant|Token has been expired or revoked/i.test(bodyText);
}

export function parseGscAnalytics(payload: unknown): {
    clicks: number;
    impressions: number;
    topQueries: GscQueryRow[];
} {
    const obj = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
    const rows = Array.isArray(obj.rows) ? obj.rows : [];

    let clicks = 0;
    let impressions = 0;
    const topQueries: GscQueryRow[] = [];

    for (const rawRow of rows) {
        if (!rawRow || typeof rawRow !== 'object') continue;
        const row = rawRow as Record<string, unknown>;
        const c = toNumber(row.clicks);
        const imp = toNumber(row.impressions);
        clicks += c;
        impressions += imp;
        const keys = Array.isArray(row.keys) ? row.keys : [];
        const query = typeof keys[0] === 'string' ? keys[0] : '';
        if (query && topQueries.length < 10) {
            topQueries.push({
                query,
                clicks: c,
                impressions: imp,
                ctr: Number((toNumber(row.ctr) * 100).toFixed(2)),
                position: Number(toNumber(row.position).toFixed(1)),
            });
        }
    }

    return { clicks, impressions, topQueries };
}

export function parseGscSitemaps(payload: unknown): {
    indexed: number;
    discovered: number;
    notIndexed: number;
} {
    const obj = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
    const sitemaps = Array.isArray(obj.sitemap) ? obj.sitemap : [];

    let indexed = 0;
    let discovered = 0;

    for (const rawMap of sitemaps) {
        if (!rawMap || typeof rawMap !== 'object') continue;
        const contents = Array.isArray((rawMap as Record<string, unknown>).contents)
            ? ((rawMap as Record<string, unknown>).contents as unknown[])
            : [];
        for (const rawContent of contents) {
            if (!rawContent || typeof rawContent !== 'object') continue;
            const c = rawContent as Record<string, unknown>;
            discovered += toNumber(c.submitted);
            indexed += toNumber(c.indexed);
        }
    }

    const notIndexed = Math.max(0, discovered - indexed);
    return { indexed, discovered, notIndexed };
}
