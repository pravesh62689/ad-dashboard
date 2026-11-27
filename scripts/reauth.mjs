import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const CLIENT_SECRET_CANDIDATES = [
    process.env.GOOGLE_CLIENT_SECRET_PATH,
    'secrets/client_secret.json',
    'F:/shiftandtip/secrets/client_secret.json',
].filter(Boolean);

const CALLBACK_TIMEOUT_MS = 15 * 60 * 1000;

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

async function startListener({ label, account, secretNames, scopes, port, clientId, clientSecret }) {
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
    authUrl.searchParams.set('login_hint', account);

    const waitForCallback = (async () => {
        const code = await new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                server.close();
                reject(new Error(`OAuth callback timed out after 15 min for ${label}`));
            }, CALLBACK_TIMEOUT_MS);
            server.on('request', (req, res) => {
                const u = new URL(req.url, redirectUri);
                if (u.pathname !== '/oauth2callback') {
                    res.writeHead(404).end();
                    return;
                }
                clearTimeout(timer);
                const c = u.searchParams.get('code');
                const err = u.searchParams.get('error');
                res.writeHead(200, { 'Content-Type': 'text/plain' }).end(
                    err ? `Authorization error: ${err}` : `Authorized ${label}. You may close this tab.`,
                );
                server.close();
                if (err || !c) reject(new Error(`Authorization failed for ${label}: ${err || 'missing code'}`));
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
            throw new Error(`No refresh_token returned for ${label}`);
        }

        for (const secretName of secretNames) {
            execFileSync('gh', ['secret', 'set', secretName, '-R', 'pravesh62689/ad-dashboard'], {
                input: tokenJson.refresh_token,
                stdio: ['pipe', 'ignore', 'pipe'],
            });
            console.log(`[${label}] Updated GitHub secret ${secretName}`);
        }
    })();

    return { label, account, authUrl: authUrl.toString(), waitForCallback };
}

async function main() {
    const { clientId, clientSecret } = loadClientConfig();
    const listeners = await Promise.all([
        startListener({
            label: 'FileBrik GSC',
            account: 'praveshrathore2002@gmail.com',
            secretNames: ['GSC_FILEBRIK_REFRESH_TOKEN'],
            scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
            port: 48122,
            clientId,
            clientSecret,
        }),
        startListener({
            label: 'Shift & Tip GSC + Blogger',
            account: 'rathore.monty2002@gmail.com',
            secretNames: ['GSC_SHIFTANDTIP_REFRESH_TOKEN', 'BLOGGER_REFRESH_TOKEN'],
            scopes: [
                'https://www.googleapis.com/auth/webmasters.readonly',
                'https://www.googleapis.com/auth/blogger.readonly',
            ],
            port: 48121,
            clientId,
            clientSecret,
        }),
    ]);

    for (const l of listeners) {
        console.log(`${l.label} (${l.account}):\n${l.authUrl}\n`);
    }

    await Promise.all(listeners.map((l) => l.waitForCallback));
    console.log('All OAuth tokens updated. Triggering Deploy Worker...');

    execFileSync('gh', ['workflow', 'run', 'deploy.yml', '-R', 'pravesh62689/ad-dashboard'], { stdio: 'inherit' });
    await new Promise((r) => setTimeout(r, 4000));
    const runId = execFileSync(
        'gh',
        ['run', 'list', '-R', 'pravesh62689/ad-dashboard', '--limit', '1', '--json', 'databaseId', '--jq', '.[0].databaseId'],
        { encoding: 'utf8' },
    ).trim();
    execFileSync('gh', ['run', 'watch', runId, '-R', 'pravesh62689/ad-dashboard', '--exit-status'], { stdio: 'inherit' });
    console.log(`Deploy Worker (${runId}) succeeded.`);
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
