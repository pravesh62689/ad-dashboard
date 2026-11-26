const EXPECTED_USER = 'pravesh';

export function constantTimeEqual(a: string, b: string): boolean {
    const enc = new TextEncoder();
    const bytesA = enc.encode(a);
    const bytesB = enc.encode(b);
    const maxLen = Math.max(bytesA.length, bytesB.length);
    let diff = bytesA.length ^ bytesB.length;
    for (let i = 0; i < maxLen; i++) {
        const ba = i < bytesA.length ? bytesA[i] : 0;
        const bb = i < bytesB.length ? bytesB[i] : 0;
        diff |= ba ^ bb;
    }
    return diff === 0;
}

export function parseBasicAuthHeader(header: string | null): { user: string; pass: string } | null {
    if (!header || !header.startsWith('Basic ')) return null;
    const encoded = header.slice(6).trim();
    if (!encoded) return null;
    try {
        const decoded = atob(encoded);
        const idx = decoded.indexOf(':');
        if (idx === -1) return null;
        return {
            user: decoded.slice(0, idx),
            pass: decoded.slice(idx + 1),
        };
    } catch {
        return null;
    }
}

export function checkDashboardAuth(request: Request, dashPassword?: string): Response | null {
    if (!dashPassword) {
        return new Response('DASH_PASSWORD secret is not configured on this Worker.', {
            status: 503,
            headers: {
                'Content-Type': 'text/plain; charset=UTF-8',
                'Cache-Control': 'no-store',
            },
        });
    }

    const creds = parseBasicAuthHeader(request.headers.get('Authorization'));
    if (!creds || !constantTimeEqual(creds.user, EXPECTED_USER) || !constantTimeEqual(creds.pass, dashPassword)) {
        return new Response('Unauthorized', {
            status: 401,
            headers: {
                'WWW-Authenticate': 'Basic realm="Ad Dashboard", charset="UTF-8"',
                'Content-Type': 'text/plain; charset=UTF-8',
                'Cache-Control': 'no-store',
            },
        });
    }

    return null;
}
