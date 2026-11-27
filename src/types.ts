export interface KVNamespace {
    get(key: string): Promise<string | null>;
    put(key: string, value: string): Promise<void>;
}

export interface ScheduledController {
    cron: string;
    scheduledTime: number;
}

export interface ExecutionContext {
    waitUntil(promise: Promise<unknown>): void;
}

export interface Env {
    DASHBOARD_KV: KVNamespace;
    DASH_PASSWORD?: string;
    ADSTERRA_API_TOKEN?: string;
    CLICKADU_API_TOKEN?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    GSC_FILEBRIK_REFRESH_TOKEN?: string;
    GSC_SHIFTANDTIP_REFRESH_TOKEN?: string;
    BLOGGER_REFRESH_TOKEN?: string;
    CF_ANALYTICS_TOKEN?: string;
    CF_ACCOUNT_ID?: string;
    CF_WEB_ANALYTICS_SITE_TAG?: string;
}

export interface PeriodMetrics {
    impressions: number;
    clicks: number;
    cpm: number;
    revenue: number;
}

export interface DailyRevenuePoint {
    date: string;
    adsterra: number;
    clickadu: number;
    total: number;
}

export interface AdsterraUnitData {
    placementId: string;
    label: string;
    today: PeriodMetrics;
    last7d: PeriodMetrics;
    last30d?: PeriodMetrics;
    month: PeriodMetrics;
}

export interface AdsterraData {
    status: 'ok' | 'pending' | 'error';
    error?: string;
    balance: number | null;
    today: PeriodMetrics;
    last7d: PeriodMetrics;
    last30d?: PeriodMetrics;
    month: PeriodMetrics;
    units: AdsterraUnitData[];
    daily: Record<string, number>;
}

export interface ClickaduData {
    status: 'ok' | 'pending' | 'error';
    error?: string;
    today: PeriodMetrics;
    last7d: PeriodMetrics;
    last30d?: PeriodMetrics;
    month: PeriodMetrics;
    daily: Record<string, number>;
}

export interface GscQueryRow {
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
}

export interface GscSiteData {
    status: 'ok' | 'pending' | 'expired' | 'error';
    tokenExpired: boolean;
    error?: string;
    siteUrl: string;
    accountEmail: string;
    indexed: number;
    discovered: number;
    notIndexed: number;
    clicks: number;
    impressions: number;
    topQueries: GscQueryRow[];
}

export interface CfPageRow {
    path: string;
    views: number;
    visitors: number;
}

export interface CfCountryRow {
    country: string;
    views: number;
    visitors: number;
}

export interface CfAnalyticsData {
    status: 'ok' | 'pending' | 'error';
    error?: string;
    visitors: number;
    pageviews: number;
    topPages: CfPageRow[];
    topCountries: CfCountryRow[];
}

export interface BloggerData {
    status: 'ok' | 'pending' | 'expired' | 'error';
    tokenExpired: boolean;
    error?: string;
    blogId: string;
    livePosts: number;
    scheduledPosts: number;
    nextPublishDate: string | null;
    adsenseSubstantial: number;
    adsenseTarget: number;
    adsenseReady: boolean;
}

export interface DashboardSnapshot {
    updatedAt: string;
    adsterra: AdsterraData;
    clickadu: ClickaduData;
    gsc: {
        filebrik: GscSiteData;
        shiftandtip: GscSiteData;
    };
    cfAnalytics: CfAnalyticsData;
    blogger: BloggerData;
    revenueSeries30d: DailyRevenuePoint[];
}
