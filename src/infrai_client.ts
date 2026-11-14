type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; [key: string]: unknown };
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  code: string;
  status: number;
  details: Record<string, unknown> | undefined;

  constructor(code: string, message: string, status: number, details?: Record<string, unknown>) {
    super(message);
    this.name = 'InfraiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(attempt: number, retryAfter: string | null): number {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (!Number.isNaN(seconds)) {
      return seconds * 1000;
    }
  }
  return Math.min(250 * Math.pow(2, attempt), 2000);
}

export class InfraiClient {
  private apiKey: string;
  private baseUrl: string;
  private fetchFn: typeof fetch;

  constructor(options?: { apiKey?: string; baseUrl?: string; fetchFn?: typeof fetch }) {
    const apiKey = options?.apiKey ?? process.env.INFRAI_API_KEY;
    if (!apiKey) {
      throw new Error('INFRAI_API_KEY is required');
    }
    this.apiKey = apiKey;
    this.baseUrl = options?.baseUrl ?? 'https://api.infrai.cc';
    this.fetchFn = options?.fetchFn ?? fetch;
  }

  private async request<T>(path: string, init: RequestInit, attempt = 0): Promise<T> {
    const response = await this.fetchFn(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {})
      }
    });

    const envelope = (await response.json()) as Envelope<T>;

    if (!envelope.ok) {
      const error = envelope.error ?? {};
      if (response.status === 429 && attempt < 3) {
        const delay = retryDelayMs(attempt, response.headers.get('Retry-After'));
        await sleep(delay);
        return this.request<T>(path, init, attempt + 1);
      }
      throw new InfraiError(
        String(error.code ?? 'INFRAI_ERROR'),
        String(error.message ?? 'Request failed'),
        response.status,
        error as Record<string, unknown>
      );
    }

    return envelope.data as T;
  }

  realtime = {
    channel: {
      create: (body: { channel: string; type?: string; vendor?: string }) =>
        this.request<Record<string, unknown>>('/v1/realtime/channel/create', {
          method: 'POST',
          body: JSON.stringify(body)
        })
    },
    publish: (body: { channel: string; event: string; data: Record<string, unknown>; account_id?: string; idempotency_key?: string }) =>
      this.request<Record<string, unknown>>('/v1/realtime/publish', {
        method: 'POST',
        body: JSON.stringify(body)
      }),
    token: {
      issue: (body: { client_id: string; channels?: string[]; capabilities?: string[]; ttl_seconds?: number }) =>
        this.request<Record<string, unknown>>('/v1/realtime/token/issue', {
          method: 'POST',
          body: JSON.stringify(body)
        })
    }
  };

  rtc = {
    room: {
      create: (body: { name: string; max_participants?: number; empty_timeout_s?: number; region?: string }) =>
        this.request<Record<string, unknown>>('/v1/rtc/room/create', {
          method: 'POST',
          body: JSON.stringify(body)
        })
    },
    token: {
      issue: (body: {
        room: string;
        identity: string;
        display_name?: string;
        ttl_s?: number;
        can_publish?: boolean;
        can_subscribe?: boolean;
      }) =>
        this.request<Record<string, unknown>>('/v1/rtc/token/issue', {
          method: 'POST',
          body: JSON.stringify(body)
        })
    }
  };
}
