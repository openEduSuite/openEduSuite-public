import { useTranslation } from 'react-i18next';

/** Weather tile — iframe widget (wetteronline, as in the classic portal). */
export default function WeatherWidget({ src, title }: { src: string; title: string }) {
  const { t } = useTranslation();
  return (
    <section
      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 flex flex-col aspect-square min-w-0"
      data-testid="weather-widget"
    >
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">{t(title)}</h3>
      <div className="flex-1 min-h-0 rounded-lg overflow-hidden">
        <iframe
          src={src}
          title={t(title)}
          className="w-full h-full border-0"
          loading="lazy"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
    </section>
  );
}
