import { useTranslation } from 'react-i18next';
import type { PortalService } from '../config';

function ServiceCard({ service }: { service: PortalService }) {
  const { t } = useTranslation();
  const name = t(`services.${service.id}.name`);
  const description = t(`services.${service.id}.description`);
  return (
    <a
      href={service.launchUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group block bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-lg dark:hover:shadow-blue-900/20 transition-all duration-200"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl" role="img" aria-label={name}>
            {service.icon}
          </span>
          <div>
            <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {name}
            </h4>
          </div>
        </div>
        <svg
          className="w-5 h-5 text-gray-300 dark:text-gray-600 group-hover:text-blue-500 dark:group-hover:text-blue-400 group-hover:translate-x-1 transition-all"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{description}</p>
    </a>
  );
}

export default ServiceCard;
