import { ADSTERRA_UNITS } from '../staticData.js';
import type { AdsterraData, AdsterraUnitData } from '../types.js';
import { addRowToMetrics, emptyMetrics, normalizeDateStr, toNumber, type DateWindows } from './utils.js';

export function parseAdsterraBalance(payload: unknown): number | null {
    if (!payload || typeof payload !== 'object') return null;
    const obj = payload as Record<string, unknown>;
    const raw =
        obj.balance ??
        obj.amount ??
        (obj.data && typeof obj.data === 'object'
            ? (obj.data as Record<string, unknown>).balance ?? (obj.data as Record<string, unknown>).amount
            : undefined);
    if (raw === undefined || raw === null || raw === '') return null;
    return Number(toNumber(raw).toFixed(4));
}

export function parseAdsterraStats(
    payload: unknown,
    windows: DateWindows,
    balance: number | null = null,
): AdsterraData {
    const obj = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
    const items = Array.isArray(obj.items) ? obj.items : Array.isArray(obj.data) ? obj.data : [];

    const today = emptyMetrics();
    const last7d = emptyMetrics();
    const month = emptyMetrics();
    const daily: Record<string, number> = {};

    const unitMap = new Map<string, AdsterraUnitData>();
    for (const u of ADSTERRA_UNITS) {
        unitMap.set(u.placementId, {
            placementId: u.placementId,
            label: u.label,
            today: emptyMetrics(),
            last7d: emptyMetrics(),
            month: emptyMetrics(),
        });
    }

    for (const rawRow of items) {
        if (!rawRow || typeof rawRow !== 'object') continue;
        const row = rawRow as Record<string, unknown>;
        const date = normalizeDateStr(row.ddate ?? row.date ?? row.day);
        if (!date) continue;

        const impressions = toNumber(row.impression ?? row.impressions);
        const clicks = toNumber(row.clicks ?? row.click);
        const revenue = toNumber(row.revenue ?? row.money ?? row.earnings);
        const placementId = String(row.placement ?? row.placement_id ?? row.placementId ?? '').trim();

        daily[date] = Number(((daily[date] ?? 0) + revenue).toFixed(6));

        const unit = unitMap.get(placementId);
        if (date === windows.todayStr) {
            addRowToMetrics(today, impressions, clicks, revenue);
            if (unit) addRowToMetrics(unit.today, impressions, clicks, revenue);
        }
        if (date >= windows.weekStartStr && date <= windows.todayStr) {
            addRowToMetrics(last7d, impressions, clicks, revenue);
            if (unit) addRowToMetrics(unit.last7d, impressions, clicks, revenue);
        }
        if (date >= windows.monthStartStr && date <= windows.todayStr) {
            addRowToMetrics(month, impressions, clicks, revenue);
            if (unit) addRowToMetrics(unit.month, impressions, clicks, revenue);
        }
    }

    return {
        status: 'ok',
        balance,
        today,
        last7d,
        month,
        units: ADSTERRA_UNITS.map((u) => unitMap.get(u.placementId)!),
        daily,
    };
}
