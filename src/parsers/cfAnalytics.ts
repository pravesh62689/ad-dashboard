import type { CfAnalyticsData, CfCountryRow, CfPageRow } from '../types.js';
import { toNumber } from './utils.js';

interface CfGroupRow {
    dimensions?: Record<string, unknown>;
    sum?: Record<string, unknown>;
}

function extractGroups(payload: unknown): CfGroupRow[] {
    if (!payload || typeof payload !== 'object') return [];
    const data = (payload as Record<string, unknown>).data;
    if (!data || typeof data !== 'object') return [];
    const viewer = (data as Record<string, unknown>).viewer;
    if (!viewer || typeof viewer !== 'object') return [];
    const accounts = (viewer as Record<string, unknown>).accounts;
    if (!Array.isArray(accounts) || !accounts[0] || typeof accounts[0] !== 'object') return [];
    const groups = (accounts[0] as Record<string, unknown>).rumPageloadEventsAdaptiveGroups;
    return Array.isArray(groups) ? (groups as CfGroupRow[]) : [];
}

export function parseCfWebAnalytics(
    summaryPayload: unknown,
    pagesPayload: unknown,
    countriesPayload: unknown,
): CfAnalyticsData {
    let visitors = 0;
    let pageviews = 0;
    for (const g of extractGroups(summaryPayload)) {
        visitors += toNumber(g.sum?.visits);
        pageviews += toNumber(g.sum?.pageViews);
    }

    const topPages: CfPageRow[] = [];
    for (const g of extractGroups(pagesPayload)) {
        const path = String(g.dimensions?.requestPath ?? '/').trim() || '/';
        topPages.push({
            path,
            views: toNumber(g.sum?.pageViews),
            visitors: toNumber(g.sum?.visits),
        });
        if (topPages.length >= 10) break;
    }

    const topCountries: CfCountryRow[] = [];
    for (const g of extractGroups(countriesPayload)) {
        const country = String(g.dimensions?.countryName ?? 'Unknown').trim() || 'Unknown';
        topCountries.push({
            country,
            views: toNumber(g.sum?.pageViews),
            visitors: toNumber(g.sum?.visits),
        });
        if (topCountries.length >= 10) break;
    }

    return {
        status: 'ok',
        visitors,
        pageviews,
        topPages,
        topCountries,
    };
}
