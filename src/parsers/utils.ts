import type { DailyRevenuePoint, PeriodMetrics } from '../types.js';

export interface DateWindows {
    todayStr: string;
    weekStartStr: string;
    monthStartStr: string;
    thirtyDaysAgoStr: string;
}

export function formatDateUtc(date: Date): string {
    return date.toISOString().slice(0, 10);
}

export function getDateWindows(now: Date = new Date()): DateWindows {
    const todayStr = formatDateUtc(now);
    const weekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6));
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const thirtyDaysAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 29));
    return {
        todayStr,
        weekStartStr: formatDateUtc(weekStart),
        monthStartStr: formatDateUtc(monthStart),
        thirtyDaysAgoStr: formatDateUtc(thirtyDaysAgo),
    };
}

export function emptyMetrics(): PeriodMetrics {
    return { impressions: 0, clicks: 0, cpm: 0, revenue: 0 };
}

export function addRowToMetrics(
    target: PeriodMetrics,
    impressions: number,
    clicks: number,
    revenue: number,
): void {
    target.impressions += impressions;
    target.clicks += clicks;
    target.revenue = Number((target.revenue + revenue).toFixed(6));
    target.cpm = target.impressions > 0 ? Number(((target.revenue / target.impressions) * 1000).toFixed(4)) : 0;
}

export function toNumber(val: unknown): number {
    if (typeof val === 'number' && Number.isFinite(val)) return val;
    if (typeof val === 'string') {
        const cleaned = val.replace(/[$,%\s,]/g, '');
        const n = Number(cleaned);
        return Number.isFinite(n) ? n : 0;
    }
    return 0;
}

export function normalizeDateStr(raw: unknown): string {
    if (typeof raw !== 'string') return '';
    const m = raw.match(/\d{4}-\d{2}-\d{2}/);
    return m ? m[0] : '';
}

export function build30DaySeries(
    adsterraDaily: Record<string, number>,
    clickaduDaily: Record<string, number>,
    now: Date = new Date(),
): DailyRevenuePoint[] {
    const out: DailyRevenuePoint[] = [];
    for (let i = 29; i >= 0; i--) {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
        const date = formatDateUtc(d);
        const adsterra = Number((adsterraDaily[date] ?? 0).toFixed(4));
        const clickadu = Number((clickaduDaily[date] ?? 0).toFixed(4));
        out.push({
            date,
            adsterra,
            clickadu,
            total: Number((adsterra + clickadu).toFixed(4)),
        });
    }
    return out;
}
