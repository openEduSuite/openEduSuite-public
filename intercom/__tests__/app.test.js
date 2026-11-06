const request = require('supertest');

describe('Express app', () => {
  let app;

  beforeAll(() => {
    jest.resetModules();
    process.env.ISSUER_BASE_URL = 'http://keycloak.test:8080/auth/realms/test';
    process.env.ORIGIN_REGEX = '.*';
    process.env.BASE_URL = 'http://ics.test:8080';
    process.env.CLIENT_ID = 'test-client';
    process.env.CLIENT_SECRET = 'test-secret';
    process.env.SECRET = 'a'.repeat(32);
    process.env.LOG_LEVEL = 'silent';
    process.env.ENABLE_SESSION_COOKIE = 'true';
    process.env.OC_ENABLED = 'true';
    process.env.OC_URL = 'https://opencloud.example.com';

    app = require('../app');
  });

  describe('public endpoints (no auth)', () => {
    test('GET / returns 200 with Hello', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.text).toContain('Hello');
    });

    test('GET /health returns 200 with status ok', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
    });
  });

  describe('protected endpoints reject unauthenticated requests', () => {
    test('GET /oc requires auth (returns non-200)', async () => {
      const res = await request(app).get('/oc');
      expect(res.status).not.toBe(200);
    });

    test('GET /sogo requires auth (returns non-200)', async () => {
      const res = await request(app).get('/sogo');
      expect(res.status).not.toBe(200);
    });

    test('GET /ilias requires auth (returns non-200)', async () => {
      const res = await request(app).get('/ilias');
      expect(res.status).not.toBe(200);
    });

    test('GET /wiki requires auth (returns non-200)', async () => {
      const res = await request(app).get('/wiki');
      expect(res.status).not.toBe(200);
    });

    test('GET /fs requires auth (returns non-200)', async () => {
      const res = await request(app).get('/fs');
      expect(res.status).not.toBe(200);
    });

    test('GET /uuid requires auth (returns non-200)', async () => {
      const res = await request(app).get('/uuid');
      expect(res.status).not.toBe(200);
    });

    test('GET /navigation.json requires auth (returns non-200)', async () => {
      const res = await request(app).get('/navigation.json');
      expect(res.status).not.toBe(200);
    });
  });
});
