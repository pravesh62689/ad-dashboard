import { SHIFTANDTIP_BLOG_ID } from '../staticData.js';
import type { BloggerData } from '../types.js';

const MIN_SUBSTANTIAL_WORDS = 600;
const MIN_AGE_DAYS = 7;
const ADSENSE_TARGET = 20;

export function countWordsFromHtml(html: string): number {
    const text = String(html || '')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return text ? text.split(' ').length : 0;
}

export function parseBloggerStatus(
    livePayload: unknown,
    scheduledPayload: unknown,
    now: Date = new Date(),
): BloggerData {
    const liveObj = livePayload && typeof livePayload === 'object' ? (livePayload as Record<string, unknown>) : {};
    const schedObj =
        scheduledPayload && typeof scheduledPayload === 'object' ? (scheduledPayload as Record<string, unknown>) : {};

    const liveItems = Array.isArray(liveObj.items) ? liveObj.items : [];
    const schedItems = Array.isArray(schedObj.items) ? schedObj.items : [];

    const cutoffMs = now.getTime() - MIN_AGE_DAYS * 24 * 60 * 60 * 1000;
    let adsenseSubstantial = 0;

    for (const rawPost of liveItems) {
        if (!rawPost || typeof rawPost !== 'object') continue;
        const post = rawPost as Record<string, unknown>;
        const pubMs = Date.parse(String(post.published ?? ''));
        const words = countWordsFromHtml(String(post.content ?? ''));
        if (Number.isFinite(pubMs) && pubMs <= cutoffMs && words >= MIN_SUBSTANTIAL_WORDS) {
            adsenseSubstantial += 1;
        }
    }

    const futureDates = schedItems
        .map((p) => (p && typeof p === 'object' ? String((p as Record<string, unknown>).published ?? '') : ''))
        .filter((d) => Number.isFinite(Date.parse(d)))
        .sort((a, b) => Date.parse(a) - Date.parse(b));

    return {
        status: 'ok',
        tokenExpired: false,
        blogId: SHIFTANDTIP_BLOG_ID,
        livePosts: liveItems.length,
        scheduledPosts: schedItems.length,
        nextPublishDate: futureDates[0] ?? null,
        adsenseSubstantial,
        adsenseTarget: ADSENSE_TARGET,
        adsenseReady: adsenseSubstantial >= ADSENSE_TARGET,
    };
}
