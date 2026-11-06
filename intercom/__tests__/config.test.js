describe('config', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
    delete process.env.OC_ENABLED;
    delete process.env.OC_URL;
    delete process.env.OC_AUDIENCE;
    delete process.env.SOGO_ENABLED;
    delete process.env.SOGO_URL;
    delete process.env.SOGO_AUDIENCE;
    delete process.env.ILIAS_ENABLED;
    delete process.env.ILIAS_URL;
    delete process.env.ILIAS_AUDIENCE;
    delete process.env.XWIKI_ENABLED;
    delete process.env.XWIKI_URL;
    delete process.env.XWIKI_AUDIENCE;
    delete process.env.NC_ENABLED;
    delete process.env.NC_URL;
    delete process.env.NC_AUDIENCE;
    delete process.env.CLOUD_ENABLED;
    delete process.env.CLOUD_URL;
    delete process.env.CLOUD_AUDIENCE;
    delete process.env.CLOUD_BACKEND;
    delete process.env.ORIGIN_REGEX;
    delete process.env.LOG_LEVEL;
    delete process.env.ENABLE_SESSION_COOKIE;
    delete process.env.MATRIX_ENABLED;
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  describe('default values', () => {
    test('opencloud defaults to disabled when OC_ENABLED is not set', () => {
      process.env.ORIGIN_REGEX = '.*';
      const { opencloud } = require('../config');
      expect(opencloud.enabled).toBe(false);
    });

    test('opencloud.audience defaults to opendesk-opencloud', () => {
      process.env.ORIGIN_REGEX = '.*';
      const { opencloud } = require('../config');
      expect(opencloud.audience).toBe('opendesk-opencloud');
    });

    test('opencloud.url is undefined when not set', () => {
      process.env.ORIGIN_REGEX = '.*';
      const { opencloud } = require('../config');
      expect(opencloud.url).toBeUndefined();
    });

    test('sogo defaults to disabled when SOGO_ENABLED is not set', () => {
      process.env.ORIGIN_REGEX = '.*';
      const { sogo } = require('../config');
      expect(sogo.enabled).toBe(false);
    });

    test('sogo.audience defaults to opendesk-sogo', () => {
      process.env.ORIGIN_REGEX = '.*';
      const { sogo } = require('../config');
      expect(sogo.audience).toBe('opendesk-sogo');
    });

    test('ilias defaults to disabled when ILIAS_ENABLED is not set', () => {
      process.env.ORIGIN_REGEX = '.*';
      const { ilias } = require('../config');
      expect(ilias.enabled).toBe(false);
    });

    test('ilias.audience defaults to opendesk-ilias', () => {
      process.env.ORIGIN_REGEX = '.*';
      const { ilias } = require('../config');
      expect(ilias.audience).toBe('opendesk-ilias');
    });

    test('xwiki defaults to disabled when XWIKI_ENABLED is not set', () => {
      process.env.ORIGIN_REGEX = '.*';
      const { xwiki } = require('../config');
      expect(xwiki.enabled).toBe(false);
    });

    test('nextcloud defaults to disabled when NC_ENABLED is not set', () => {
      process.env.ORIGIN_REGEX = '.*';
      const { nextcloud } = require('../config');
      expect(nextcloud.enabled).toBe(false);
    });

    test('cloud defaults to disabled when CLOUD_ENABLED is not set', () => {
      process.env.ORIGIN_REGEX = '.*';
      const { cloud } = require('../config');
      expect(cloud.enabled).toBe(false);
    });

    test('cloud.audience defaults to openedusuite-opencloud', () => {
      process.env.ORIGIN_REGEX = '.*';
      const { cloud } = require('../config');
      expect(cloud.audience).toBe('openedusuite-opencloud');
    });

    test('cloud.backend defaults to opencloud', () => {
      process.env.ORIGIN_REGEX = '.*';
      const { cloud } = require('../config');
      expect(cloud.backend).toBe('opencloud');
    });

    test('cloud.url is undefined when not set', () => {
      process.env.ORIGIN_REGEX = '.*';
      const { cloud } = require('../config');
      expect(cloud.url).toBeUndefined();
    });

    test('matrix defaults to disabled when MATRIX_ENABLED is not set', () => {
      process.env.ORIGIN_REGEX = '.*';
      const { matrix } = require('../config');
      expect(matrix.enabled).toBe(false);
    });

    test('session storage keys are set correctly for all services', () => {
      process.env.ORIGIN_REGEX = '.*';
      const config = require('../config');
      expect(config.opencloud.session_storage_key).toBe('oc_access_token');
      expect(config.sogo.session_storage_key).toBe('sogo_access_token');
      expect(config.ilias.session_storage_key).toBe('ilias_access_token');
      expect(config.xwiki.session_storage_key).toBe('xwiki_access_token');
      expect(config.nextcloud.session_storage_key).toBe('nc_access_token');
      expect(config.cloud.session_storage_key).toBe('cloud_access_token');
      expect(config.matrix.session_storage_key).toBe('matrix_access_token');
    });
  });

  describe('env var mapping', () => {
    test('OC_ENABLED=true enables opencloud', () => {
      process.env.ORIGIN_REGEX = '.*';
      process.env.OC_ENABLED = 'true';
      process.env.OC_URL = 'https://opencloud.example.com';
      process.env.OC_AUDIENCE = 'custom-opencloud';
      const { opencloud } = require('../config');
      expect(opencloud.enabled).toBe(true);
      expect(opencloud.url).toBe('https://opencloud.example.com');
      expect(opencloud.audience).toBe('custom-opencloud');
    });

    test('SOGO_ENABLED=true enables sogo', () => {
      process.env.ORIGIN_REGEX = '.*';
      process.env.SOGO_ENABLED = 'true';
      process.env.SOGO_URL = 'https://sogo.example.com';
      process.env.SOGO_AUDIENCE = 'custom-sogo';
      const { sogo } = require('../config');
      expect(sogo.enabled).toBe(true);
      expect(sogo.url).toBe('https://sogo.example.com');
      expect(sogo.audience).toBe('custom-sogo');
    });

    test('ILIAS_ENABLED=true enables ilias', () => {
      process.env.ORIGIN_REGEX = '.*';
      process.env.ILIAS_ENABLED = 'true';
      process.env.ILIAS_URL = 'https://ilias.example.com';
      process.env.ILIAS_AUDIENCE = 'custom-ilias';
      const { ilias } = require('../config');
      expect(ilias.enabled).toBe(true);
      expect(ilias.url).toBe('https://ilias.example.com');
      expect(ilias.audience).toBe('custom-ilias');
    });

    test('XWIKI_ENABLED=true enables xwiki', () => {
      process.env.ORIGIN_REGEX = '.*';
      process.env.XWIKI_ENABLED = 'true';
      process.env.XWIKI_URL = 'https://xwiki.example.com';
      process.env.XWIKI_AUDIENCE = 'custom-xwiki';
      const { xwiki } = require('../config');
      expect(xwiki.enabled).toBe(true);
      expect(xwiki.url).toBe('https://xwiki.example.com');
      expect(xwiki.audience).toBe('custom-xwiki');
    });

    test('NC_ENABLED=true enables nextcloud (legacy compat)', () => {
      process.env.ORIGIN_REGEX = '.*';
      process.env.NC_ENABLED = 'true';
      process.env.NC_URL = 'https://nc.example.com';
      process.env.NC_AUDIENCE = 'custom-nc';
      const { nextcloud } = require('../config');
      expect(nextcloud.enabled).toBe(true);
      expect(nextcloud.url).toBe('https://nc.example.com');
      expect(nextcloud.audience).toBe('custom-nc');
    });

    test('CLOUD_ENABLED=true enables cloud storage', () => {
      process.env.ORIGIN_REGEX = '.*';
      process.env.CLOUD_ENABLED = 'true';
      process.env.CLOUD_URL = 'https://cloud.example.com';
      process.env.CLOUD_AUDIENCE = 'custom-cloud';
      process.env.CLOUD_BACKEND = 'nextcloud';
      const { cloud } = require('../config');
      expect(cloud.enabled).toBe(true);
      expect(cloud.url).toBe('https://cloud.example.com');
      expect(cloud.audience).toBe('custom-cloud');
      expect(cloud.backend).toBe('nextcloud');
    });

    test('MATRIX_ENABLED=true enables matrix', () => {
      process.env.ORIGIN_REGEX = '.*';
      process.env.MATRIX_ENABLED = 'true';
      process.env.MATRIX_URL = 'https://matrix.example.com';
      const { matrix } = require('../config');
      expect(matrix.enabled).toBe(true);
      expect(matrix.url).toBe('https://matrix.example.com');
    });
  });

  describe('intercom config', () => {
    test('reads intercom client credentials from env', () => {
      process.env.ORIGIN_REGEX = '.*';
      process.env.CLIENT_ID = 'my-client';
      process.env.CLIENT_SECRET = 'my-secret';
      process.env.SECRET = 'my-long-enough-secret-here!!!!';
      process.env.BASE_URL = 'https://ics.example.com';
      const { intercom } = require('../config');
      expect(intercom.clientId).toBe('my-client');
      expect(intercom.clientSecret).toBe('my-secret');
      expect(intercom.secret).toBe('my-long-enough-secret-here!!!!');
      expect(intercom.baseUrl).toBe('https://ics.example.com');
    });
  });

  describe('cors options', () => {
    test('corsOptions has credentials enabled', () => {
      process.env.ORIGIN_REGEX = '.*';
      const { corsOptions } = require('../config');
      expect(corsOptions.credentials).toBe(true);
    });
  });
});
