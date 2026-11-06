const express = require('express');
const request = require('supertest');

function createAppForRoute(routePath, routeModule) {
  const app = express();
  app.use(routePath, routeModule);
  return app;
}

describe('route graceful disable', () => {
  describe('OpenCloud route (/oc)', () => {
    beforeEach(() => {
      jest.resetModules();
    });

    test('returns 404 with error when disabled', async () => {
      jest.doMock('../config', () => ({
        opencloud: { enabled: false, url: '' },
        corsOptions: { origin: '.*' },
        logLevel: 'silent',
      }));
      jest.doMock('../utils', () => ({
        stripIntercomCookies: jest.fn(),
        massageCors: jest.fn(),
        logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
      }));
      const oc = require('../routes/oc');
      const app = createAppForRoute('/oc', oc);
      const res = await request(app).get('/oc/');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'OpenCloud integration is not enabled' });
    });
  });

  describe('generic WebDAV route (/cloud/webdav)', () => {
    beforeEach(() => {
      jest.resetModules();
    });

    test('returns 404 with error when disabled', async () => {
      jest.doMock('../config', () => ({
        cloud: { enabled: false, url: '', backend: 'opencloud' },
        corsOptions: { origin: '.*' },
        logLevel: 'silent',
      }));
      jest.doMock('../utils', () => ({
        stripIntercomCookies: jest.fn(),
        massageCors: jest.fn(),
        logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
      }));
      const webdav = require('../routes/webdav');
      const app = createAppForRoute('/cloud/webdav', webdav);
      const res = await request(app).get('/cloud/webdav/');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Cloud storage integration is not enabled' });
    });

    test('proxies GET requests when enabled', async () => {
      const mockProxy = jest.fn((req, res) => res.status(200).json({ ok: true }));
      jest.doMock('http-proxy-middleware', () => ({
        createProxyMiddleware: jest.fn(() => mockProxy),
      }));
      jest.doMock('../config', () => ({
        cloud: { enabled: true, url: 'https://cloud.example.com', backend: 'opencloud', session_storage_key: 'cloud_access_token' },
        corsOptions: { origin: '.*' },
        logLevel: 'silent',
      }));
      jest.doMock('../utils', () => ({
        stripIntercomCookies: jest.fn(),
        massageCors: jest.fn(),
        logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
      }));
      const webdav = require('../routes/webdav');
      const app = createAppForRoute('/cloud/webdav', webdav);
      const res = await request(app).get('/cloud/webdav/dav/files/user');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
    });
  });

  describe('SOGo route (/sogo)', () => {
    beforeEach(() => {
      jest.resetModules();
    });

    test('returns 404 with error when disabled', async () => {
      jest.doMock('../config', () => ({
        sogo: { enabled: false, url: '' },
        corsOptions: { origin: '.*' },
        logLevel: 'silent',
      }));
      jest.doMock('../utils', () => ({
        stripIntercomCookies: jest.fn(),
        massageCors: jest.fn(),
        logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
      }));
      const sogo = require('../routes/sogo');
      const app = createAppForRoute('/sogo', sogo);
      const res = await request(app).get('/sogo/');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'SOGo integration is not enabled' });
    });
  });

  describe('ILIAS route (/ilias)', () => {
    beforeEach(() => {
      jest.resetModules();
    });

    test('returns 404 with error when disabled', async () => {
      jest.doMock('../config', () => ({
        ilias: { enabled: false, url: '' },
        corsOptions: { origin: '.*' },
        logLevel: 'silent',
      }));
      jest.doMock('../utils', () => ({
        stripIntercomCookies: jest.fn(),
        massageCors: jest.fn(),
        logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
      }));
      const ilias = require('../routes/ilias');
      const app = createAppForRoute('/ilias', ilias);
      const res = await request(app).get('/ilias/');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'ILIAS integration is not enabled' });
    });

    test('proxies GET requests when enabled', async () => {
      const mockProxy = jest.fn((req, res) => res.status(200).json({ ok: true }));
      jest.doMock('http-proxy-middleware', () => ({
        createProxyMiddleware: jest.fn(() => mockProxy),
      }));
      jest.doMock('../config', () => ({
        ilias: { enabled: true, url: 'https://ilias.example.com', session_storage_key: 'ilias_access_token' },
        corsOptions: { origin: '.*' },
        logLevel: 'silent',
      }));
      jest.doMock('../utils', () => ({
        stripIntercomCookies: jest.fn(),
        massageCors: jest.fn(),
        logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
      }));
      const ilias = require('../routes/ilias');
      const app = createAppForRoute('/ilias', ilias);
      const res = await request(app).get('/ilias/api{v1}');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
    });

    test('sets X-Remote-User header from decoded ID token claim (B1 SSO bridging)', () => {
      // ILIAS runs in Apache-auth mode; the bridging identity must reach it as
      // a trusted remote-user header derived from the user's Keycloak identity.
      const { setILIASRemoteUser } = require('../routes/ilias-remote-user');
      const proxyReq = { setHeader: jest.fn() };
      const req = { decodedIdToken: { email: 'user@example.org' } };
      setILIASRemoteUser(proxyReq, req, 'email');
      expect(proxyReq.setHeader).toHaveBeenCalledWith('X-Remote-User', 'user@example.org');
    });

    test('does not set X-Remote-User when the claim is missing', () => {
      const { setILIASRemoteUser } = require('../routes/ilias-remote-user');
      const proxyReq = { setHeader: jest.fn() };
      setILIASRemoteUser(proxyReq, {}, 'email');
      expect(proxyReq.setHeader).not.toHaveBeenCalledWith('X-Remote-User', expect.anything());
    });

    test('sets X-OpenDesk-Proxy-Secret when a secret is configured (anti-spoof)', () => {
      const { setILIASProxySecret } = require('../routes/ilias-remote-user');
      const proxyReq = { setHeader: jest.fn() };
      setILIASProxySecret(proxyReq, 's3cr3t');
      expect(proxyReq.setHeader).toHaveBeenCalledWith('X-OpenDesk-Proxy-Secret', 's3cr3t');
    });

    test('does not set the proxy secret when none is configured', () => {
      const { setILIASProxySecret } = require('../routes/ilias-remote-user');
      const proxyReq = { setHeader: jest.fn() };
      setILIASProxySecret(proxyReq, '');
      expect(proxyReq.setHeader).not.toHaveBeenCalled();
    });

    test('B1 route forwards the proxy secret to ILIAS when configured (anti-spoof)', async () => {
      const http = require('http');
      let seenSecret = null;
      const target = http.createServer((req, res) => {
        seenSecret = req.headers['x-opendesk-proxy-secret'] || null;
        res.statusCode = 200;
        res.end('ok');
      });
      await new Promise(r => target.listen(0, '127.0.0.1', r));
      const port = target.address().port;

      jest.dontMock('http-proxy-middleware');
      jest.resetModules();
      jest.doMock('../config', () => ({
        ilias: {
          enabled: true,
          url: `http://127.0.0.1:${port}`,
          session_storage_key: 'ilias_access_token',
          remote_user_claim: 'email',
          proxy_secret: 's3cr3t',
        },
        corsOptions: { origin: '.*' },
        logLevel: 'silent',
      }));
      jest.doMock('../utils', () => ({
        stripIntercomCookies: jest.fn(),
        massageCors: jest.fn(),
        logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
      }));
      const ilias = require('../routes/ilias');
      const app = express();
      app.use((req, res, next) => {
        req.decodedIdToken = { email: 'user@example.org' };
        req.appSession = { ilias_access_token: 'tok-123' };
        next();
      });
      app.use('/ilias', ilias);

      const res = await request(app).get('/ilias/');
      expect(res.status).toBe(200);
      expect(seenSecret).toBe('s3cr3t');
      target.closeAllConnections?.();
      await new Promise(r => target.close(r));
    });

    test('B1 end-to-end: proxied request carries X-Remote-User to ILIAS (real proxy)', async () => {
      // Real http-proxy-middleware + real target server: proves the identity
      // header reaches ILIAS, not just the helper function. Earlier tests in
      // this file mock http-proxy-middleware; undo that for this test.
      jest.dontMock('http-proxy-middleware');
      const http = require('http');
      let seen = null;
      const target = http.createServer((req, res) => {
        seen = { remote: req.headers['x-remote-user'], auth: req.headers['authorization'] };
        res.statusCode = 200;
        res.end('ok');
      });
      await new Promise(r => target.listen(0, '127.0.0.1', r));
      const port = target.address().port;

      jest.resetModules();
      jest.doMock('../config', () => ({
        ilias: {
          enabled: true,
          url: `http://127.0.0.1:${port}`,
          session_storage_key: 'ilias_access_token',
          remote_user_claim: 'email',
        },
        corsOptions: { origin: '.*' },
        logLevel: 'silent',
      }));
      jest.doMock('../utils', () => ({
        stripIntercomCookies: jest.fn(),
        massageCors: jest.fn(),
        logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
      }));
      const ilias = require('../routes/ilias');

      // Middleware chain must set identity BEFORE the proxy route runs, so
      // register the identity provider first, then the route.
      const app = express();
      app.use((req, res, next) => {
        req.decodedIdToken = { email: 'user@example.org' };
        req.appSession = { ilias_access_token: 'tok-123' };
        next();
      });
      app.use('/ilias', ilias);

      const res = await request(app).get('/ilias/');
      expect(res.status).toBe(200);
      expect(seen).not.toBeNull();
      expect(seen.remote).toBe('user@example.org');
      expect(seen.auth).toBe('Bearer tok-123');
      target.closeAllConnections?.();
      await new Promise(r => target.close(r));
    });

    test('supports upload passthrough (POST with body) when enabled', async () => {
      const mockProxy = jest.fn((req, res) => {
        // Verify request has body
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          res.status(201).json({ uploaded: true, data: body });
        });
      });
      jest.doMock('http-proxy-middleware', () => ({
        createProxyMiddleware: jest.fn(() => mockProxy),
      }));
      jest.doMock('../config', () => ({
        ilias: { enabled: true, url: 'https://ilias.example.com', session_storage_key: 'ilias_access_token' },
        corsOptions: { origin: '.*' },
        logLevel: 'silent',
      }));
      jest.doMock('../utils', () => ({
        stripIntercomCookies: jest.fn(),
        massageCors: jest.fn(),
        logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
      }));
      const ilias = require('../routes/ilias');
      const app = createAppForRoute('/ilias', ilias);
      const res = await request(app)
        .post('/ilias/upload')
        .send('test file content');
      expect(res.status).toBe(201);
      expect(res.body.uploaded).toBe(true);
    });
  });

  describe('Nextcloud route (/fs, legacy)', () => {
    beforeEach(() => {
      jest.resetModules();
    });

    test('returns 404 with error when disabled', async () => {
      jest.doMock('../config', () => ({
        nextcloud: { enabled: false, url: '' },
        corsOptions: { origin: '.*' },
        logLevel: 'silent',
      }));
      jest.doMock('../utils', () => ({
        stripIntercomCookies: jest.fn(),
        massageCors: jest.fn(),
        logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
      }));
      const fs = require('../routes/fs');
      const app = createAppForRoute('/fs', fs);
      const res = await request(app).get('/fs/');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Nextcloud integration is not enabled' });
    });
  });

  describe('wiki route (/wiki)', () => {
    beforeEach(() => {
      jest.resetModules();
    });

    test('returns 404 with error when disabled', async () => {
      jest.doMock('../config', () => ({
        xwiki: { enabled: false, url: '' },
        corsOptions: { origin: '.*' },
        logLevel: 'silent',
      }));
      jest.doMock('../utils', () => ({
        stripIntercomCookies: jest.fn(),
        massageCors: jest.fn(),
        logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
      }));
      const wiki = require('../routes/wiki');
      const app = createAppForRoute('/wiki', wiki);
      const res = await request(app).get('/wiki/');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'XWiki integration is not enabled' });
    });
  });

  describe('nob route (/nob)', () => {
    beforeEach(() => {
      jest.resetModules();
    });

    test('returns 404 with error when disabled', async () => {
      jest.doMock('../config', () => ({
        nordeck: { url: '' },
        corsOptions: { origin: '.*' },
        logLevel: 'silent',
      }));
      jest.doMock('../utils', () => ({
        stripIntercomCookies: jest.fn(),
        massageCors: jest.fn(),
        logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
      }));
      const nob = require('../routes/nob');
      const app = createAppForRoute('/nob', nob);
      const res = await request(app).get('/nob/');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Nordeck integration is not configured' });
    });
  });

  describe('navigation route (/navigation.json)', () => {
    beforeEach(() => {
      jest.resetModules();
    });

    test('returns 404 with error when portal url is not set', async () => {
      jest.doMock('../config', () => ({
        portal: { url: '' },
        corsOptions: { origin: '.*' },
        logLevel: 'silent',
      }));
      jest.doMock('../utils', () => ({
        stripIntercomCookies: jest.fn(),
        massageCors: jest.fn(),
        logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
      }));
      const navigation = require('../routes/navigation');
      const app = createAppForRoute('/navigation.json', navigation);
      const res = await request(app).get('/navigation.json');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Portal integration is not configured' });
    });
  });
});
