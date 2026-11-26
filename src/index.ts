import { checkDashboardAuth } from './auth.js';
import { collectDashboardSnapshot } from './fetchers.js';
import { renderDashboardHtml } from './render.js';
import type { DashboardSnapshot, Env, ExecutionContext, ScheduledController } from './types.js';

const SNAPSHOT_KEY = 'snapshot:v1';

async function refreshAndStoreSnapshot(env: Env): Promise<DashboardSnapshot> {
    const snapshot = await collectDashboardSnapshot(env, new Date());
    await env.DASHBOARD_KV.put(SNAPSHOT_KEY, JSON.stringify(snapshot));
    return snapshot;
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const authError = checkDashboardAuth(request, env.DASH_PASSWORD);
        if (authError) return authError;

        const url = new URL(request.url);
        const forceRefresh = url.searchParams.get('refresh') === '1';

        let snapshot: DashboardSnapshot | null = null;
        if (!forceRefresh) {
            const raw = await env.DASHBOARD_KV.get(SNAPSHOT_KEY);
            if (raw) {
                try {
                    snapshot = JSON.parse(raw) as DashboardSnapshot;
                } catch {
                    snapshot = null;
                }
            }
        }

        if (!snapshot) {
            snapshot = await refreshAndStoreSnapshot(env);
        }

        if (url.pathname === '/api/snapshot') {
            return new Response(JSON.stringify(snapshot, null, 2), {
                headers: {
                    'Content-Type': 'application/json; charset=UTF-8',
                    'Cache-Control': 'no-store',
                    'X-Content-Type-Options': 'nosniff',
                },
            });
        }

        return new Response(renderDashboardHtml(snapshot), {
            headers: {
                'Content-Type': 'text/html; charset=UTF-8',
                'Cache-Control': 'no-store',
                'X-Content-Type-Options': 'nosniff',
                'X-Frame-Options': 'DENY',
                'Referrer-Policy': 'no-referrer',
            },
        });
    },

    async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
        ctx.waitUntil(refreshAndStoreSnapshot(env));
    },
};
