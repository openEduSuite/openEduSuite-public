import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../i18n';
import VmRequest from './VmRequest';

const CATALOG = {
  products: {
    'VM-LINUX-MONTHLY': {
      displayName: 'Linux Server VM (Ubuntu 24.04)',
      priceEuro: 20,
      manualProvision: false,
      sizes: {
        small: { cores: 2, memoryGi: 4, image: 'img:v1' },
        medium: { cores: 4, memoryGi: 8, image: 'img:v1' },
      },
    },
    'VM-WIN-MONTHLY': {
      displayName: 'Windows Server 2025 VM',
      priceEuro: 50,
      manualProvision: true,
      sizes: {},
    },
  },
};

function jsonOk(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response;
}

function renderVm() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <VmRequest />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('VmRequest (portal self-service form)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    localStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/config/vm-catalog.json')) return jsonOk(CATALOG);
        if (url.endsWith('/config/vm-workflow-engine.json')) {
          return jsonOk({ engine: 'operaton', webhookUrl: '/api/vm-workflow-engine', messageName: 'vm-request' });
        }
        return jsonOk({});
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the product catalog from the mounted catalog config', async () => {
    renderVm();
    await waitFor(() => expect(screen.getByTestId('vm-form')).toBeInTheDocument());
    expect(screen.getByText(/Linux Server VM/i)).toBeInTheDocument();
    expect(screen.getByText(/Windows Server 2025/i)).toBeInTheDocument();
    // Windows is manual-provision: option text carries the hint.
    expect(screen.getByText(/manual approval required/i)).toBeInTheDocument();
  });

  it('shows the size options of the selected product', async () => {
    renderVm();
    await waitFor(() => expect(screen.getByTestId('vm-form')).toBeInTheDocument());
    fireEvent.change(screen.getByTestId('vm-field-size').querySelector('select')!, {
      target: { value: 'medium' },
    });
    expect(
      (screen.getByTestId('vm-field-size').querySelector('select') as HTMLSelectElement).value,
    ).toBe('medium');
  });

  it('posts the request payload to the engine webhook and shows the reference', async () => {
    const fetchMock = vi.mocked(fetch);
    renderVm();
    await waitFor(() => expect(screen.getByTestId('vm-form')).toBeInTheDocument());

    fireEvent.change(screen.getByTestId('vm-field-product').querySelector('select')!, {
      target: { value: 'VM-LINUX-MONTHLY' },
    });
    fireEvent.change(screen.getByTestId('vm-field-size').querySelector('select')!, {
      target: { value: 'small' },
    });
    fireEvent.change(screen.getByTestId('vm-field-duration').querySelector('select')!, {
      target: { value: '3' },
    });
    fireEvent.change(screen.getByTestId('vm-field-user').querySelector('input')!, {
      target: { value: 'mueller' },
    });
    fireEvent.change(screen.getByTestId('vm-field-mail').querySelector('input')!, {
      target: { value: 'mueller@example.org' },
    });
    fireEvent.change(screen.getByTestId('vm-field-purpose').querySelector('textarea')!, {
      target: { value: 'databases lab' },
    });

    fireEvent.click(screen.getByRole('button', { name: /send request/i }));

    await waitFor(() => expect(screen.getByTestId('vm-success')).toBeInTheDocument());

    const postCall = fetchMock.mock.calls.find(
      ([input, init]) => String(input).endsWith('/api/vm-workflow-engine') && (init as RequestInit)?.method === 'POST',
    );
    expect(postCall).toBeTruthy();
    const body = JSON.parse((postCall![1] as RequestInit).body as string);
    expect(body).toMatchObject({
      product: 'VM-LINUX-MONTHLY',
      size: 'small',
      durationMonths: 3,
      userId: 'mueller',
      requesterMail: 'mueller@example.org',
      purpose: 'databases lab',
      groups: ['vm-self-service'],
    });
    expect(body.clientRef).toMatch(/^vm-request-\d+$/);
  });

  it('shows a load error when the catalog cannot be fetched', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/config/vm-catalog.json')) throw new Error('network down');
        return jsonOk({});
      }),
    );
    renderVm();
    await waitFor(() => expect(screen.getByTestId('vm-load-error')).toBeInTheDocument());
    expect(screen.queryByTestId('vm-form')).not.toBeInTheDocument();
  });
});
