export interface AccountPayoutRow {
    site: string;
    host: string;
    owningEmail: string;
    adNetworks: string;
    payoutMethodAndMin: string;
}

export const ADSTERRA_UNITS = [
    { placementId: '32499187', label: 'Popunder' },
    { placementId: '32499188', label: 'Native' },
    { placementId: '32499189', label: 'Social Bar' },
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
        adNetworks: 'Adsterra + Clickadu (Pending site approval)',
        payoutMethodAndMin: 'Adsterra: PayPal ($25 min); Clickadu: after KYC',
    },
];
