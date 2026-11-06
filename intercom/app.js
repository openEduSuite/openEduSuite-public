/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * SPDX-FileCopyrightText: 2024-2025 Univention GmbH
 * SPDX-FileCopyrightText: 2026 openEDU Team
 *
 * openEDU fork — extended with OpenCloud, SOGo, and ILIAS proxy routes.
 */

/*
 * Simple Backend for the Browser: OIDC Login, some Methods to call
 */
require("dotenv").config({ path: "./.env.prod" });
const express = require("express");
var app = express();
app.set("view engine", "ejs");
const {
  auth,
  requiresAuth,
  attemptSilentLogin,
} = require("express-openid-connect");
const csrfDSC = require("express-csrf-double-submit-cookie");
const cookieParser = require("cookie-parser");
const jose = require("jose");

var cors = require("cors");

const {
  corsOptions,
  issuerBaseUrl,
  sessionRollingDuration,
  enableSessionCookie,
  intercom,
  xwiki,
  nextcloud,
  opencloud,
  cloud,
  sogo,
  ilias,
  matrix,
  userUniqueMapper,
} = require("./config");

const {
  fetchMatrixToken,
  fetchOIDCToken,
  JWKS,
  redisStore,
  logger,
} = require("./utils");

const {
  backchannelLogout,
  fs,
  oc,
  wiki,
  nob,
  navigation,
  silent,
  uuid,
  sogo: sogoRoute,
  ilias: iliasRoute,
  nc: ncRoute,
  webdav,
} = require("./routes");

const {
  oidcVerifyDecodeAccessToken,
  oidcVerifyDecodeIdentityToken,
  refreshIntercomTokenIfNeeded,
  refreshOIDCTokenIfNeeded,
  updateSessionState,
  refreshMatrixTokenIfNeeded,
} = require("./middlewares");

const csrfProtection = csrfDSC({ cookie: { sameSite: "none", secure: true } });

app.use(express.urlencoded({ extended: true }));

app.use(
  auth({
    issuerBaseURL: issuerBaseUrl,
    baseURL: intercom.baseUrl,
    clientID: intercom.clientId,
    clientSecret: intercom.clientSecret,
    authRequired: false,
    secret: intercom.secret,
    idpLogout: true,
    authorizationParams: {
      response_type: "code",
      scope: "openid offline_access",
    },
    session: {
      store: redisStore,
      rollingDuration: sessionRollingDuration,
      cookie: {
        transient: enableSessionCookie,
      },
    },
    afterCallback: async (req, res, session, decodedState) => {
      try {
        var ret = {};

        // Token exchange for XWiki
        if (!(xwiki.session_storage_key in session) && xwiki.enabled) {
          ret[xwiki.session_storage_key] = await fetchOIDCToken(
            session.access_token,
            xwiki.audience,
          );
        }

        // Token exchange for Nextcloud (legacy)
        if (!(nextcloud.session_storage_key in session) && nextcloud.enabled) {
          ret[nextcloud.session_storage_key] = await fetchOIDCToken(
            session.access_token,
            nextcloud.audience,
          );
        }

        // Token exchange for OpenCloud
        if (!(opencloud.session_storage_key in session) && opencloud.enabled) {
          ret[opencloud.session_storage_key] = await fetchOIDCToken(
            session.access_token,
            opencloud.audience,
          );
        }

        // Token exchange for SOGo
        if (!(sogo.session_storage_key in session) && sogo.enabled) {
          ret[sogo.session_storage_key] = await fetchOIDCToken(
            session.access_token,
            sogo.audience,
          );
        }

        // Token exchange for ILIAS
        if (!(ilias.session_storage_key in session) && ilias.enabled) {
          ret[ilias.session_storage_key] = await fetchOIDCToken(
            session.access_token,
            ilias.audience,
          );
        }

        // Token exchange for generic cloud storage (WebDAV)
        if (!(cloud.session_storage_key in session) && cloud.enabled) {
          ret[cloud.session_storage_key] = await fetchOIDCToken(
            session.access_token,
            cloud.audience,
          );
        }

        const { payload } = await jose.jwtVerify(session.id_token, JWKS, {
          issuer: issuerBaseUrl,
        });
        let uid = payload[userUniqueMapper];

        if (!uid) {
          logger.warn(
            "Sorry can't find the preferred username/uuid, maybe the mapping is missing?",
          );
        }

        if (!(matrix.session_storage_key in session) && matrix.enabled) {
          logger.debug("Fetching Matrix access_token");
          ret[matrix.session_storage_key] = await fetchMatrixToken(uid);
        }
      } catch (error) {
        logger.error("Error fetching tokens: " + error);
      }
      return { ...session, ...ret };
    },
  }),
);

app.use(cors(corsOptions));
app.use(cookieParser());
app.use(csrfProtection);
app.use(updateSessionState);

/**
 * Just a simple Endpoint to check if the service is there and for CORS testing
 */
app.get("/", function (req, res) {
  res.send("<p>Hello</p>");
});

app.get("/health", function (req, res) {
  res.json({ status: "ok" });
});

/**
 * @name /backchannel-logout
 * @desc
 * OpenID Connect Backchannel Logout implementation to delete the session from the store
 */
app.use("/backchannel-logout", backchannelLogout);

/**
 * @name /nob/
 * @desc
 * Proxy for the Nordeck Bot (or just the plain Matrix UserInfo Service in testing).
 * Adds the proper Authorization Header
 */
app.use(
  "/nob",
  requiresAuth(),
  refreshIntercomTokenIfNeeded,
  csrfProtection.validate,
  oidcVerifyDecodeAccessToken(attemptSilentLogin),
  refreshMatrixTokenIfNeeded,
  nob,
);

/**
 * @name /fs/
 * @desc
 * Proxy for Nextcloud (legacy upstream).
 * Adds the proper Authorization Header
 * @example PROPFIND http://ics.domain.test/fs/remote.php/dav/files/usera1/Photos
 */
app.use(
  "/fs",
  requiresAuth(),
  refreshIntercomTokenIfNeeded,
  oidcVerifyDecodeAccessToken(attemptSilentLogin),
  refreshOIDCTokenIfNeeded(nextcloud),
  fs,
);

/**
 * @name /oc/
 * @desc
 * Proxy for OpenCloud (openEDU primary file service).
 * Adds the proper Authorization Header via OIDC token exchange.
 * @example PROPFIND http://ics.domain.test/oc/dav/files/usera1/Photos
 */
app.use(
  "/oc",
  requiresAuth(),
  refreshIntercomTokenIfNeeded,
  oidcVerifyDecodeAccessToken(attemptSilentLogin),
  refreshOIDCTokenIfNeeded(opencloud),
  oc,
);

/**
 * @name /wiki/
 * @desc
 * Proxy for XWiki.
 * Adds the proper Authorization Header
 */
app.use(
  "/wiki",
  requiresAuth(),
  refreshIntercomTokenIfNeeded,
  refreshOIDCTokenIfNeeded(xwiki),
  wiki,
);

/**
 * @name /sogo/
 * @desc
 * Proxy for SOGo Groupware (CalDAV, CardDAV, mail).
 * Adds the proper Authorization Header via OIDC token exchange.
 */
app.use(
  "/sogo",
  requiresAuth(),
  refreshIntercomTokenIfNeeded,
  oidcVerifyDecodeAccessToken(attemptSilentLogin),
  refreshOIDCTokenIfNeeded(sogo),
  sogoRoute,
);

/**
 * @name /ilias/
 * @desc
 * Proxy for ILIAS LMS (REST API, file upload/download).
 * Adds the proper Authorization Header via OIDC token exchange.
 */
app.use(
  "/ilias",
  requiresAuth(),
  refreshIntercomTokenIfNeeded,
  oidcVerifyDecodeAccessToken(attemptSilentLogin),
  // B1 SSO bridge: decode ID token so the route can derive the remote-user
  // identity (X-Remote-User) for ILIAS Apache-auth.
  oidcVerifyDecodeIdentityToken(attemptSilentLogin),
  refreshOIDCTokenIfNeeded(ilias),
  iliasRoute,
);

/**
 * @name /nextcloud/
 * @desc
 * Proxy for Nextcloud (openEDU file service).
 * Adds the proper Authorization Header via OIDC token exchange.
 */
app.use(
  "/nextcloud",
  requiresAuth(),
  refreshIntercomTokenIfNeeded,
  oidcVerifyDecodeAccessToken(attemptSilentLogin),
  refreshOIDCTokenIfNeeded(nextcloud),
  ncRoute,
);

/**
 * @name /oc/
 * @desc
 * Proxy for OpenCloud (openEDU primary file service).
 * Adds the proper Authorization Header via OIDC token exchange.
 */
app.use(
  "/oc",
  requiresAuth(),
  refreshIntercomTokenIfNeeded,
  oidcVerifyDecodeAccessToken(attemptSilentLogin),
  refreshOIDCTokenIfNeeded(opencloud),
  oc,
);

/**
 * @name /cloud/webdav/
 * @desc
 * Generic cloud-storage WebDAV proxy (openEDU file service).
 * Backend is switchable via CLOUD_BACKEND ('opencloud' | 'nextcloud').
 * Adds the proper Authorization Header via OIDC token exchange.
 * @example PROPFIND http://ics.domain.test/cloud/webdav/dav/files/usera1/Photos
 */
app.use(
  "/cloud/webdav",
  requiresAuth(),
  refreshIntercomTokenIfNeeded,
  oidcVerifyDecodeAccessToken(attemptSilentLogin),
  refreshOIDCTokenIfNeeded(cloud),
  webdav,
);

/**
 * @name /navigation.json
 * @desc
 * Proxy to the portal for global Navigation Data.
 * Adds the proper Authorization Header
 */
app.use(
  "/navigation.json",
  requiresAuth(),
  refreshIntercomTokenIfNeeded,
  oidcVerifyDecodeAccessToken(attemptSilentLogin),
  oidcVerifyDecodeIdentityToken(attemptSilentLogin),
  navigation,
);

/**
 * @name /silent
 * @desc
 * Performs a "silent login", eg logs the user into the intercom service without interaction
 * if the user is already logged in to keycloak.
 */
app.use(
  "/silent",
  attemptSilentLogin(),
  oidcVerifyDecodeAccessToken(attemptSilentLogin),
  silent,
);

/**
 * @name /uuid
 * @desc returns the unique identifier claim of the logged in user
 */
app.use(
  "/uuid",
  requiresAuth(),
  refreshIntercomTokenIfNeeded,
  oidcVerifyDecodeIdentityToken(attemptSilentLogin),
  uuid,
);

module.exports = app;

var server = app.listen(process.env.PORT, function () {
  var host = server.address().address;
  var port = server.address().port;
  logger.info(`Intercom app listening at http://${host}:${port}`);
});
