import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n';
import NewsFeeds from './NewsFeeds';
import type { NewsFeed } from '../config';

/** Atom feed with entries carrying ISO 8601 published/updated timestamps. */
const ATOM_FEED = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>UB Termine</title>
  <entry>
    <title>Ausstellungseröffnung</title>
    <link href="https://example.org/de/ub/aktuelles/termine/1"/>
    <published>2026-11-15T12:00:00+02:00</published>
    <updated>2026-11-15T12:00:00+02:00</updated>
  </entry>
  <entry>
    <title>Führung durch die Magazine</title>
    <link href="https://example.org/de/ub/aktuelles/termine/2"/>
    <published>2026-11-22T12:00:00+02:00</published>
  </entry>
</feed>`;

/** RSS feed with an RFC 2822 pubDate. */
const RSS_FEED = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0">
  <channel>
    <title>UB News</title>
    <item>
      <title>Neue Datenbank</title>
      <link>https://example.org/de/ub/aktuelles/1</link>
      <pubDate>Tue, 20 Oct 2026 12:00:00 +0200</pubDate>
    </item>
  </channel>
</rss>`;

/** Kalender feed whose only entry has no parseable publication timestamp. */
const NO_DATE_FEED = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>UB Termine</title>
  <entry>
    <title>Termin ohne Datum</title>
    <link href="https://example.org/de/ub/aktuelles/termine/no-date"/>
  </entry>
</feed>`;

function feed(id: string, path: string): NewsFeed {
  return { id, title: `ui.${id}`, path };
}

function renderFeeds(feeds: NewsFeed[], xmlFor: Record<string, string>) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url: string) =>
      Promise.resolve({ ok: true, text: async () => xmlFor[url] ?? '' }),
    ),
  );
  return render(
    <I18nextProvider i18n={i18n}>
      <NewsFeeds feeds={feeds} />
    </I18nextProvider>,
  );
}

describe('NewsFeeds kalender date badges', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('de');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders a day+month date badge for the kalender feed (Atom published)', async () => {
    renderFeeds([feed('kalender', '/kalender')], { '/kalender': ATOM_FEED });

    const badge = await screen.findByTestId('date-kalender-0');
    const expected = new Intl.DateTimeFormat('de', { day: 'numeric', month: 'short' }).format(
      new Date('2026-11-15T12:00:00+02:00'),
    );
    // Locale-aware day + month label (e.g. de "15. Nov.").
    expect(badge.textContent?.trim()).toBe(expected);
    expect(expected).toMatch(/\d/);
    expect(expected.trim().length).toBeGreaterThan(2);

    // A second entry gets its own badge.
    expect(await screen.findByTestId('date-kalender-1')).toBeInTheDocument();
  });

  it('parses RSS pubDate (RFC 2822) into a badge for the kalender feed', async () => {
    renderFeeds([feed('kalender', '/kalender')], { '/kalender': RSS_FEED });

    const badge = await screen.findByTestId('date-kalender-0');
    const expected = new Intl.DateTimeFormat('de', { day: 'numeric', month: 'short' }).format(
      new Date('Tue, 20 Oct 2026 12:00:00 +0200'),
    );
    expect(badge.textContent?.trim()).toBe(expected);
  });

  it('formats the badge per the active i18n locale', async () => {
    await i18n.changeLanguage('en');
    renderFeeds([feed('kalender', '/kalender')], { '/kalender': ATOM_FEED });

    const badge = await screen.findByTestId('date-kalender-0');
    const expected = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' }).format(
      new Date('2026-11-15T12:00:00+02:00'),
    );
    expect(badge.textContent?.trim()).toBe(expected);
    expect(expected).toBe('Nov 15');
  });

  it('renders plain links without date badges for non-kalender feeds', async () => {
    renderFeeds(
      [feed('news', '/news'), feed('ub', '/ub')],
      { '/news': ATOM_FEED, '/ub': RSS_FEED },
    );

    await screen.findByTestId('feed-news');
    await screen.findByTestId('feed-ub');
    // Entries are still listed for the non-kalender feeds…
    expect(await screen.findByText('Ausstellungseröffnung')).toBeInTheDocument();
    expect(await screen.findByText('Neue Datenbank')).toBeInTheDocument();
    // …but never as date badges.
    expect(screen.queryByTestId('date-kalender-0')).not.toBeInTheDocument();
    expect(screen.queryByTestId(/^date-kalender-/)).not.toBeInTheDocument();
  });

  it('falls back to the plain list item when an entry has no parseable date', async () => {
    renderFeeds([feed('kalender', '/kalender')], { '/kalender': NO_DATE_FEED });

    expect(await screen.findByText('Termin ohne Datum')).toBeInTheDocument();
    expect(screen.queryByTestId('date-kalender-0')).not.toBeInTheDocument();
  });

  it('keeps a clickable link in the new tab for badged kalender entries', async () => {
    renderFeeds([feed('kalender', '/kalender')], { '/kalender': ATOM_FEED });

    const link = (await screen.findByText('Ausstellungseröffnung')).closest('a');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAttribute('href', 'https://example.org/de/ub/aktuelles/termine/1');
  });
});
