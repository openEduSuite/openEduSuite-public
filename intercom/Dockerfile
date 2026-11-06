# SPDX-License-Identifier: AGPL-3.0-only
# SPDX-FileCopyrightText: 2024-2025 Univention GmbH
# SPDX-FileCopyrightText: 2026 openEDU Team
#
# openEDU fork — standard Node.js base image (no Univention UCS dependency)

FROM node:20-alpine AS base

RUN apk add --no-cache curl

WORKDIR /app

# Copy package files first for better caching
COPY intercom/package.json intercom/yarn.lock /app/
RUN yarnpkg install --production

# Copy the rest of the app
COPY intercom/ /app/

###############################################################################
FROM base AS dev

EXPOSE 8008

ENV NODE_ENV=development
CMD ["node", "app.js"]

###############################################################################
FROM base AS final

RUN apk del curl && \
    rm -rf /var/cache/apk/* /tmp/*

EXPOSE 8008

RUN adduser -D app
USER app

HEALTHCHECK --interval=60s --timeout=10s --start-period=10s \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8008/health || exit 1

CMD ["node", "app.js"]
