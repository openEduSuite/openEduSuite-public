import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { NewsFeed } from '../config';

interface FeedItem {
  title: string;
  href?: string;
  /** Parsed publication date (Atom published/updated, RSS pubDate). */
  date?: Date;
}

interface FeedCardState {
  loading: boolean;
  error?: string;
  items: FeedItem[];
}

/** English-style month abbreviations used by the RFC 2822 date parser. */
const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/** Named time zones common in RSS pubDate values (RFC 2822 §5). */
const TZ_ABBR: Record<string, string> = {
  utc: '+00:00', gmt: '+00:00', z: '+00:00',
  est: '-05:00', edt: '-04:00',
  cst: '-06:00', cdt: '-05:00',
  mst: '-07:00', mdt: '-06:00',
  pst: '-08:00', pdt: '-07:00',
};

/**
 * Parse a feed timestamp into a Date. Handles ISO 8601 (Atom published /
 * updated, RSS <dc:date>) as well as RFC 2822 (RSS pubDate, e.g.
 * "Tue, 20 Oct 2026 09:00:00 +0200"). Returns undefined for unparseable
 * input so callers can fall back to the plain list rendering.
 */
function parseDate(value: string | undefined | null): Date | undefined {
  const s = value?.trim();
  if (!s) return undefined;

  // ISO 8601 (also accepts RFC 3339 timestamps from Atom).
  const iso = new Date(s);
  if (!Number.isNaN(iso.getTime())) return iso;

  // RFC 2822, e.g. "Tue, 20 Oct 2026 09:00:00 +0200" or "20 Oct 26 09:00 GMT".
  const m = s.match(
    /^(?:\w{3},\s*)?(\d{1,2})\s+(\w{3})\s+(\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(Z|[+-]\d{4}|[A-Za-z]{1,3}))?$/,
  );
  if (!m) return undefined;
  const [, day, mon, year, hh, min, sec, tz] = m;
  const month = MONTHS[mon.toLowerCase()];
  if (month === undefined) return undefined;
  const yy = year.length === 2 ? 2000 + Number(year) : Number(year);
  const tzOff = tz
    ? (TZ_ABBR[tz.toLowerCase()] ?? (tz[0] === '+' || tz[0] === '-' ? `${tz.slice(0, 3)}:${tz.slice(3)}` : '+00:00'))
    : '+00:00';
  const isoStr = `${String(yy).padStart(4, '0')}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hh).padStart(2, '0')}:${min}${sec ? `:${sec}` : ':00'}${tzOff}`;
  const d = new Date(isoStr);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Compact locale-aware "day + month" label, e.g. de "14. Nov.", en "Nov 14". */
function formatDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(date);
}

/** Read the publication timestamp from an Atom entry or RSS item. */
function entryDate(e: Element): Date | undefined {
  const raw =
    e.getElementsByTagName('published')[0]?.textContent?.trim()
    ?? e.getElementsByTagName('updated')[0]?.textContent?.trim()
    ?? e.getElementsByTagName('pubDate')[0]?.textContent?.trim()
    ?? e.getElementsByTagNameNS('*', 'date')[0]?.textContent?.trim()
    ?? undefined;
  return parseDate(raw);
}

/** Parse an Atom feed (or RSS) document into entries. */
function parseFeed(xml: string): FeedItem[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const entries = doc.querySelectorAll('entry, item');
  return Array.from(entries)
    .slice(0, 6)
    .map((e) => {
      const title = e.querySelector('title')?.textContent?.trim() ?? '';
      const link = e.getAttribute('href')
        ?? e.querySelector('link[href]')?.getAttribute('href')
        ?? e.querySelector('link')?.getAttribute('href')
        ?? e.querySelector('guid')?.textContent?.trim()
        ?? undefined;
      return { title, href: link, date: entryDate(e) };
    })
    .filter((i) => i.title.length > 0);
}

export default function NewsFeeds({ feeds }: { feeds: NewsFeed[] }) {
  const { t, i18n } = useTranslation();
  const [state, setState] = useState<Record<string, FeedCardState>>({});

  useEffect(() => {
    let cancelled = false;
    for (const feed of feeds) {
      setState((s) => ({ ...s, [feed.id]: { loading: true, items: [] } }));
      fetch(feed.path, { cache: 'no-store' })
        .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`${r.status}`))))
        .then((xml) => {
          if (!cancelled) setState((s) => ({ ...s, [feed.id]: { loading: false, items: parseFeed(xml) } }));
        })
        .catch((err) => {
          if (!cancelled) setState((s) => ({ ...s, [feed.id]: { loading: false, error: String(err.message ?? err).slice(0, 80), items: [] } }));
        });
    }
    return () => {
      cancelled = true;
    };
  }, [feeds]);

  return (
    <div className="contents">
      {feeds.map((feed) => {
        const st = state[feed.id] ?? { loading: true, items: [] };
        return (
          <section
            key={feed.id}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 h-full flex flex-col min-w-0"
            data-testid={`feed-${feed.id}`}
          >
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">{t(feed.title)}</h3>
            {st.loading && <p className="text-sm text-gray-400 dark:text-gray-500">{t('ui.newsLoading')}</p>}
            {!st.loading && st.error && <p className="text-sm text-amber-600 dark:text-amber-400">{t('ui.newsUnavailable')}</p>}
            {!st.loading && !st.error && (
              <ul className="space-y-2 flex-1">
                {st.items.map((it, i) => {
                  const badge =
                    feed.id === 'kalender' && it.date ? (
                      <span
                        data-testid={`date-kalender-${i}`}
                        className="inline-flex items-center justify-center shrink-0 h-9 w-14 rounded-md bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 text-xs font-semibold leading-tight"
                      >
                        {formatDate(it.date, i18n.language)}
                      </span>
                    ) : null;
                  return (
                    <li key={`${feed.id}-${i}`} className="text-sm leading-snug">
                      {it.href ? (
                        <a
                          href={it.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-start gap-2 text-blue-700 dark:text-blue-400 hover:underline"
                        >
                          {badge}
                          <span>{it.title}</span>
                        </a>
                      ) : (
                        <span className="flex items-start gap-2 text-gray-700 dark:text-gray-300">
                          {badge}
                          <span>{it.title}</span>
                        </span>
                      )}
                    </li>
                  );
                })}
                {st.items.length === 0 && <li className="text-sm text-gray-400 dark:text-gray-500">{t('ui.newsEmpty')}</li>}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
