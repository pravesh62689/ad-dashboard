export interface AccountPayoutRow {
    site: string;
    host: string;
    owningEmail: string;
    adNetworks: string;
    payoutMethodAndMin: string;
}

export const ADSTERRA_UNITS = [
    { placementId: '32499187', label: 'Popunder', site: 'FileBrik' as const },
    { placementId: '32499188', label: 'Native', site: 'FileBrik' as const },
    { placementId: '32499189', label: 'Social Bar', site: 'FileBrik' as const },
    { placementId: '32523687', label: 'Popunder', site: 'SpinPick' as const },
    { placementId: '32523688', label: 'Native', site: 'SpinPick' as const },
    { placementId: '32523689', label: '320x50', site: 'SpinPick' as const },
    { placementId: '32523690', label: '300x250', site: 'SpinPick' as const },
    { placementId: '32523691', label: '728x90', site: 'SpinPick' as const },
    { placementId: '32524335', label: 'Social Bar', site: 'SpinPick' as const },
] as const;

export const SHIFTANDTIP_BLOG_ID = '4523693247154244983';

export const ACCOUNTS_AND_PAYOUTS: AccountPayoutRow[] = [
    {
        site: 'filebrik.pages.dev',
        host: 'Cloudflare Pages',
        owningEmail: 'praveshrathore2002@gmail.com',
        adNetworks: 'Adsterra (Popunder 32499187, Native 32499188, Social Bar 32499189), Clickadu (Pending)',
        payoutMethodAndMin: 'Adsterra: PayPal ($25 min); Clickadu: after KYC',
    },
    {
        site: 'shiftandtip.blogspot.com',
        host: 'Blogger',
        owningEmail: 'rathore.monty2002@gmail.com',
        adNetworks: 'Google AdSense (x/20 substantial posts gate)',
        payoutMethodAndMin: 'PNB Bank Transfer (after AdSense approval, $100 min)',
    },
    {
        site: 'spinpick-app.pages.dev',
        host: 'Cloudflare Pages',
        owningEmail: 'praveshrathore2002@gmail.com',
        adNetworks: 'Adsterra (Site 6234377: Popunder 32523687, Native 32523688, 320x50, 300x250, 728x90, Social Bar 32524335); Clickadu (Pending)',
        payoutMethodAndMin: 'Adsterra: PayPal ($25 min); Clickadu: after KYC',
    },
];
