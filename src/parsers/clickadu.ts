import type { ClickaduData } from '../types.js';
import { addRowToMetrics, emptyMetrics, normalizeDateStr, toNumber, type DateWindows } from './utils.js';

export function parseClickaduStats(payload: unknown, windows: DateWindows): ClickaduData {
    const obj = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
    const rows = Array.isArray(payload)
        ? payload
        : Array.isArray(obj.result)
          ? obj.result
          : Array.isArray(obj.data)
            ? obj.data
            : Array.isArray(obj.items)
              ? obj.items
              : [];

    const today = emptyMetrics();
    const last7d = emptyMetrics();
    const month = emptyMetrics();
    const daily: Record<string, number> = {};

    for (const rawRow of rows) {
        if (!rawRow || typeof rawRow !== 'object') continue;
        const row = rawRow as Record<string, unknown>;
        const date = normalizeDateStr(row.day ?? row.date ?? row.ddate);
        if (!date) continue;

        const impressions = toNumber(row.impressions ?? row.impression ?? row.shows);
        const clicks = toNumber(row.clicks ?? row.click);
        const revenue = toNumber(row.money ?? row.revenue ?? row.profit ?? row.amount);

        daily[date] = Number(((daily[date] ?? 0) + revenue).toFixed(6));

        if (date === windows.todayStr) {
            addRowToMetrics(today, impressions, clicks, revenue);
        }
        if (date >= windows.weekStartStr && date <= windows.todayStr) {
            addRowToMetrics(last7d, impressions, clicks, revenue);
        }
        if (date >= windows.monthStartStr && date <= windows.todayStr) {
            addRowToMetrics(month, impressions, clicks, revenue);
        }
    }

    return {
        status: 'ok',
        today,
        last7d,
        month,
        daily,
    };
}
