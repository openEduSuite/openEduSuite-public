FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# CI gate inside the image build: i18n completeness + config portability tests
# node:22 required — node:20/musl lacks zlib zstd, crashing undici 8 vitest workers
RUN npm test
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Server config as envsubst template — the nginx image substitutes it into
# /etc/nginx/conf.d at container start (see nginx.conf.template header).
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
# Deployment-specific defaults are placeholders; overlay
# /usr/share/nginx/html/config.json with real values (e.g. via a Kubernetes
# ConfigMap mount). The placeholder copy keeps the image working standalone.
COPY --from=build /app/src/config.default.json /usr/share/nginx/html/config.json
# Defaults for the same-origin feed proxies and the DNS resolver (override at
# runtime with `docker run -e ...` / pod env). 127.0.0.11 = Docker embedded DNS;
# in Kubernetes set DNS_RESOLVER to the cluster DNS service IP.
ENV DNS_RESOLVER=127.0.0.11 \
    FEED_NEWS_URL=https://example.org/feeds/news/atom.xml \
    FEED_EVENTS_URL=https://example.org/feeds/events/atom.xml \
    FEED_HRZ_URL=https://example.org/feeds/hrz/atom.xml \
    FEED_UB_URL=https://example.org/feeds/library/atom.xml \
    FEED_CAL_URL=https://example.org/feeds/calendar/atom.xml
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
