import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { getConfig } from '../config';

interface CatalogSize {
  cores: number;
  memoryGi: number;
  image: string;
}
interface CatalogProduct {
  displayName: string;
  priceEuro: number;
  manualProvision: boolean;
  sizes: Record<string, CatalogSize>;
}
interface Catalog {
  products: Record<string, CatalogProduct>;
}

/**
 * VM self-service form (openEduSuite vm-provisioning).
 * Purely static frontend: the catalog is served from a mounted ConfigMap
 * (/config/vm-catalog.json), the submit target is the same-origin nginx path
 * /api/vm-workflow-engine which proxies to the active engine (Operaton by
 * default, n8n after switching the vm-workflow-engine ConfigMap).
 */
function VmRequest() {
  const { t } = useTranslation();
  const vm = getConfig().vmRequest;
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [engine, setEngine] = useState<{ engine?: string } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [product, setProduct] = useState('');
  const [size, setSize] = useState('');
  const [durationMonths, setDurationMonths] = useState(12);
  const [purpose, setPurpose] = useState('');
  const [userId, setUserId] = useState('');
  const [requesterMail, setRequesterMail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [ref, setRef] = useState<string | null>(null);

  useEffect(() => {
    if (!vm?.enabled) return;
    let cancelled = false;
    (async () => {
      try {
        const [cr, er] = await Promise.all([
          fetch(vm.catalogUrl, { cache: 'no-store' }),
          fetch('/config/vm-workflow-engine.json', { cache: 'no-store' }).catch(() => null),
        ]);
        const cat = (await cr.json()) as Catalog;
        const eng = er ? ((await er.json().catch(() => null)) as { engine?: string } | null) : null;
        if (cancelled) return;
        setCatalog(cat);
        setEngine(eng);
        const products = Object.keys(cat.products ?? {});
        if (products.length > 0) {
          setProduct(products[0]);
          const sizes = Object.keys(cat.products[products[0]].sizes ?? {});
          if (sizes.length > 0) setSize(sizes[0]);
        }
      } catch {
        if (!cancelled) setLoadError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vm]);

  const products = catalog ? Object.entries(catalog.products) : [];
  const current = product ? catalog?.products?.[product] : null;
  const sizes = current ? Object.entries(current.sizes ?? {}) : [];

  // Keep the selected size valid when the product changes.
  useEffect(() => {
    if (sizes.length > 0 && !sizes.some(([k]) => k === size)) setSize(sizes[0][0]);
  }, [size, sizes]);

  if (!vm) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">{t('vmRequest.disabled')}</p>
      </div>
    );
  }
  if (!vm.enabled) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">{t('vmRequest.disabled')}</p>
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!current || !vm) return;
    setSubmitting(true);
    setSubmitError(null);
    setRef(null);
    const clientRef = `vm-request-${Date.now()}`;
    const payload = {
      product,
      size,
      durationMonths: Number(durationMonths),
      purpose,
      userId,
      requesterMail,
      groups: ['vm-self-service'],
      clientId: userId || '',
      clientRef,
    };
    try {
      const res = await fetch(vm.engineWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(String(res.status));
      setRef(clientRef);
    } catch {
      setSubmitError(t('vmRequest.submitFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls =
    'w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400';

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-16">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-2xl">🖥️</span>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('vmRequest.title')}</h1>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{t('vmRequest.subtitle')}</p>

      {loadError && (
        <p className="mb-4 text-sm text-red-600 dark:text-red-400" data-testid="vm-load-error">
          {t('vmRequest.loadFailed')}
        </p>
      )}

      {catalog && (
        <form onSubmit={handleSubmit} className="space-y-5" data-testid="vm-form">
          <label className="block" data-testid="vm-field-product">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('vmRequest.product')}</span>
            <select className={inputCls} value={product} onChange={(e) => setProduct(e.target.value)}>
              {products.map(([id, p]) => (
                <option key={id} value={id}>
                  {p.displayName} · €{p.priceEuro}/{t('vmRequest.perMonth')}
                  {p.manualProvision ? ` · ${t('vmRequest.manualProvision')}` : ''}
                </option>
              ))}
            </select>
          </label>

          <label className="block" data-testid="vm-field-size">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('vmRequest.size')}</span>
            <select className={inputCls} value={size} onChange={(e) => setSize(e.target.value)}>
              {sizes.map(([id, s]) => (
                <option key={id} value={id}>
                  {id} — {s.cores} vCPU / {s.memoryGi} GB RAM
                </option>
              ))}
            </select>
          </label>

          <label className="block" data-testid="vm-field-duration">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('vmRequest.duration')}</span>
            <select className={inputCls} value={durationMonths} onChange={(e) => setDurationMonths(Number(e.target.value))}>
              {[1, 3, 6, 12, 24, 36].map((m) => (
                <option key={m} value={m}>
                  {m} {m === 1 ? t('vmRequest.month') : t('vmRequest.months')}
                </option>
              ))}
            </select>
          </label>

          <label className="block" data-testid="vm-field-purpose">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('vmRequest.purpose')}</span>
            <textarea
              className={inputCls}
              rows={3}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder={t('vmRequest.purposePlaceholder')}
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block" data-testid="vm-field-user">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('vmRequest.userId')}</span>
              <input className={inputCls} value={userId} onChange={(e) => setUserId(e.target.value)} />
            </label>
            <label className="block" data-testid="vm-field-mail">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('vmRequest.mail')}</span>
              <input className={inputCls} type="email" value={requesterMail} onChange={(e) => setRequesterMail(e.target.value)} />
            </label>
          </div>

          {engine?.engine && (
            <p className="text-xs text-gray-400 dark:text-gray-500" data-testid="vm-engine">
              {t('vmRequest.engine', { engine: engine.engine })}
            </p>
          )}

          {submitError && (
            <p className="text-sm text-red-600 dark:text-red-400" data-testid="vm-submit-error">
              {submitError}
            </p>
          )}
          {ref && (
            <p className="text-sm text-green-700 dark:text-green-400" data-testid="vm-success">
              {t('vmRequest.submitted', { ref })}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || !current || sizes.length === 0}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
          >
            {submitting ? t('vmRequest.sending') : t('vmRequest.submit')}
          </button>
        </form>
      )}
    </div>
  );
}

export default VmRequest;
