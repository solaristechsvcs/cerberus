const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('node:http');
const { registerAuth, cookieValue } = require('../dist/dashboard/auth');

async function fixture(t, https = false, rows = new Map()) {
  const store = {
    async put(id, kind, data, expiresAt) { rows.set(id, { kind, data, expiresAt }); },
    async consumeState(id) { const row = rows.get(id); if (!row || row.kind !== 'state' || row.expiresAt <= Date.now()) return false; rows.delete(id); return true; },
    async getSession(id) { const row = rows.get(id); return row?.kind === 'session' && row.expiresAt > Date.now() ? row.data : null; },
    async remove(id) { rows.delete(id); }
  };
  let calls = 0;
  const app = express();
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const publicUrl = https ? 'https://dashboard.example.com' : base;
  registerAuth(app, { publicUrl, clientId: 'test', trustProxy: https ? 'loopback' : false }, store, async (_, callback) => {
    calls++; assert.equal(callback, `${publicUrl}/oauth/callback`);
    return { userId: 'test', username: 'test', guilds: [] };
  });
  app.get('/session', (_, res) => res.json(res.locals.dashboardSession || null));
  const request = (path, options = {}) => new Promise((resolve, reject) => {
    const req = http.request(base + path, options, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: {
        get: name => { const value = res.headers[name]; return Array.isArray(value) ? value.join(', ') : value ?? null; },
        getSetCookie: () => res.headers['set-cookie'] ?? []
      }, json: async () => JSON.parse(Buffer.concat(chunks).toString()) }));
    });
    req.on('error', reject); req.end();
  });
  return { request, rows, calls: () => calls };
}

test('HTTP login, hashed durable session, one-use state and logout', async t => {
  const f = await fixture(t);
  const login = await f.request('/login');
  const cookie = login.headers.get('set-cookie');
  assert(!cookie.includes('Secure')); assert(cookie.includes('HttpOnly')); assert(cookie.includes('SameSite=Lax'));
  const state = new URL(login.headers.get('location')).searchParams.get('state');
  assert(!f.rows.has(state));
  const headers = { cookie: cookie.split(';')[0] };
  const callback = await f.request(`/oauth/callback?code=test&state=${state}`, { headers });
  assert.equal(callback.status, 302);
  assert(callback.headers.getSetCookie().some(c => c.startsWith('cerberus_oauth_state=;')));
  const session = callback.headers.getSetCookie().find(c => c.startsWith('cerberus_session=')).split(';')[0];
  assert.equal((await f.request(`/oauth/callback?code=test&state=${state}`, { headers })).status, 400);
  assert.equal(f.calls(), 1);
  assert.equal((await (await f.request('/session', { headers: { cookie: session } })).json()).userId, 'test');
  const restarted = await fixture(t, false, f.rows);
  assert.equal((await (await restarted.request('/session', { headers: { cookie: session } })).json()).userId, 'test');
  await f.request('/logout', { method: 'POST', headers: { cookie: session } });
  assert.equal(await (await f.request('/session', { headers: { cookie: session } })).json(), null);
  assert.equal(await (await restarted.request('/session', { headers: { cookie: session } })).json(), null);
});

test('concurrent callback replay permits only one authentication', async t => {
  const f = await fixture(t);
  const login = await f.request('/login');
  const state = new URL(login.headers.get('location')).searchParams.get('state');
  const options = { headers: { cookie: login.headers.get('set-cookie').split(';')[0] } };
  const results = await Promise.all([f.request(`/oauth/callback?code=test&state=${state}`, options), f.request(`/oauth/callback?code=test&state=${state}`, options)]);
  assert.deepEqual(results.map(r => r.status).sort(), [302, 400]);
  assert.equal(f.calls(), 1);
});

test('HTTPS proxy uses Secure cookies and canonical origin', async t => {
  const f = await fixture(t, true);
  const wrong = await f.request('/login');
  assert.equal(wrong.headers.get('location'), 'https://dashboard.example.com/login');
  assert.equal(wrong.headers.get('set-cookie'), null);
  const login = await f.request('/login', { headers: { host: 'dashboard.example.com', 'x-forwarded-proto': 'https' } });
  assert(login.headers.get('set-cookie').includes('Secure'));
  assert.equal(new URL(login.headers.get('location')).searchParams.get('redirect_uri'), 'https://dashboard.example.com/oauth/callback');
});

test('missing, malformed, mismatched, expired state and cancellation fail closed', async t => {
  const f = await fixture(t);
  assert.equal((await f.request('/oauth/callback?code=test&state=bad')).status, 400);
  const login = await f.request('/login');
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const state = new URL(login.headers.get('location')).searchParams.get('state');
  assert.equal((await f.request('/oauth/callback?code=test&state=bad', { headers: { cookie } })).status, 400);
  for (const row of f.rows.values()) row.expiresAt = 0;
  assert.equal((await f.request(`/oauth/callback?code=test&state=${state}`, { headers: { cookie } })).status, 400);
  const next = await f.request('/login');
  const nextState = new URL(next.headers.get('location')).searchParams.get('state');
  assert.equal((await f.request(`/oauth/callback?error=access_denied&state=${nextState}`, { headers: { cookie: next.headers.get('set-cookie').split(';')[0] } })).status, 400);
  assert.equal(f.calls(), 0);
  assert.equal(cookieValue({ headers: { cookie: 'cerberus_oauth_state=%ZZ' } }, 'cerberus_oauth_state'), null);
  assert.equal(cookieValue({ headers: { cookie: 'a=one; a=two' } }, 'a'), null);
});
