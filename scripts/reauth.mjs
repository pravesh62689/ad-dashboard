import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import readline from 'node:readline/promises';

const CLIENT_SECRET_CANDIDATES = [
    process.env.GOOGLE_CLIENT_SECRET_PATH,
    'secrets/client_secret.json',
    'F:/shiftandtip/secrets/client_secret.json',
].filter(Boolean);

function loadClientConfig() {
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
        return {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        };
    }
    for (const p of CLIENT_SECRET_CANDIDATES) {
        const resolved = path.resolve(p);
        if (fs.existsSync(resolved)) {
            const raw = JSON.parse(fs.readFileSync(resolved, 'utf8'));
            const cfg = raw.installed || raw.web;
            if (cfg?.client_id && cfg?.client_secret) {
                return { clientId: cfg.client_id, clientSecret: cfg.client_secret };
            }
        }
    }
    throw new Error('Set GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET or provide secrets/client_secret.json');
}

async function authorizeOne({ label, secretNames, scopes, port, clientId, clientSecret }) {
    const server = http.createServer();
    await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
    const redirectUri = `http://127.0.0.1:${port}/oauth2callback`;

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', scopes.join(' '));
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');

    console.log(`\n[${label}] Open in browser:\n${authUrl.toString()}\n`);

    const code = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('OAuth callback timed out')), 600_000);
        server.on('request', (req, res) => {
            const u = new URL(req.url, redirectUri);
            if (u.pathname !== '/oauth2callback') {
                res.writeHead(404).end();
                return;
            }
            clearTimeout(timer);
            const c = u.searchParams.get('code');
            res.writeHead(200, { 'Content-Type': 'text/plain' }).end('Authorized. You may close this tab.');
            server.close();
            if (!c) reject(new Error('Missing authorization code'));
            else resolve(c);
        });
    });

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
        }).toString(),
    });
    const tokenJson = await tokenRes.json();
    if (!tokenJson.refresh_token) {
        throw new Error(`No refresh_token returned for ${label}: ${JSON.stringify(tokenJson)}`);
    }

    for (const secretName of Array.isArray(secretNames) ? secretNames : [secretNames]) {
        try {
            execFileSync('gh', ['secret', 'set', secretName, '-R', 'pravesh62689/ad-dashboard'], {
                input: tokenJson.refresh_token,
                stdio: ['pipe', 'ignore', 'pipe'],
            });
            console.log(`[${label}] Updated GitHub secret ${secretName}`);
        } catch {
            console.log(`[${label}] Run manually: npx wrangler secret put ${secretName}`);
        }
    }
}

async function main() {
    const { clientId, clientSecret } = loadClientConfig();
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    await rl.question('Press Enter to authorize FileBrik GSC (praveshrathore2002@gmail.com)... ');
    await authorizeOne({
        label: 'FileBrik GSC',
        secretNames: ['GSC_FILEBRIK_REFRESH_TOKEN'],
        scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
        port: 48122,
        clientId,
        clientSecret,
    });

    await rl.question('Press Enter to authorize Shift & Tip GSC + Blogger (rathore.monty2002@gmail.com)... ');
    await authorizeOne({
        label: 'Shift & Tip GSC + Blogger',
        secretNames: ['GSC_SHIFTANDTIP_REFRESH_TOKEN', 'BLOGGER_REFRESH_TOKEN'],
        scopes: [
            'https://www.googleapis.com/auth/webmasters.readonly',
            'https://www.googleapis.com/auth/blogger.readonly',
        ],
        port: 48121,
        clientId,
        clientSecret,
    });
    rl.close();
    console.log('\nDone! Trigger Deploy Worker in GitHub Actions to sync the new secrets to Cloudflare.');
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
