import { Logger } from '@nestjs/common';
import { Ollama } from 'ollama';
import {
  LlmClient,
  LlmHealth,
  LlmJsonRequest,
  LlmResponseError,
  LlmTimeoutError,
  LlmUnavailableError,
} from './llm-client';

export const DEFAULT_OLLAMA_TIMEOUT_MS = 180_000;
const HEALTH_TIMEOUT_MS = 5_000;

type FetchFn = typeof fetch;

export class OllamaLlmClient implements LlmClient {
  private readonly logger = new Logger(OllamaLlmClient.name);
  private readonly ollama: Ollama;
  private readonly healthClient: Ollama;

  /**
   * @param timeoutMs per-call timeout (OLLAMA_TIMEOUT_MS). Enforced with AbortSignal.timeout on every HTTP request.
   * @param baseFetch injectable for tests.
   */
  constructor(
    private readonly host: string,
    readonly model: string,
    private readonly timeoutMs = DEFAULT_OLLAMA_TIMEOUT_MS,
    baseFetch: FetchFn = fetch,
  ) {
    this.ollama = new Ollama({
      host,
      fetch: withTimeout(baseFetch, timeoutMs),
    });
    this.healthClient = new Ollama({
      host,
      fetch: withTimeout(baseFetch, Math.min(timeoutMs, HEALTH_TIMEOUT_MS)),
    });
  }

  async generateJson(req: LlmJsonRequest): Promise<unknown> {
    const started = Date.now();
    let text: string;
    try {
      const res = await this.ollama.generate({
        model: this.model,
        ...(req.system ? { system: req.system } : {}),
        prompt: req.prompt,
        format: 'json',
        think: false,
        stream: false,
        options: { temperature: 0 },
      });
      text = res.response ?? '';
    } catch (err) {
      throw this.wrap(err, req.task);
    }
    this.logger.debug(`${req.task}: ${Date.now() - started}ms`);
    try {
      return JSON.parse(text);
    } catch {
      throw new LlmResponseError(
        `Model returned invalid JSON for ${req.task}: ${text.slice(0, 200)}`,
      );
    }
  }

  async health(): Promise<LlmHealth> {
    try {
      const list = await this.healthClient.list();
      const names = list.models.map((m) => m.name);
      const modelAvailable = names.some(
        (n) =>
          n === this.model ||
          n === `${this.model}:latest` ||
          n.split(':')[0] === this.model,
      );
      return { reachable: true, modelAvailable };
    } catch {
      return { reachable: false, modelAvailable: false };
    }
  }

  /** Timeout → LlmTimeoutError; connection refused / DNS / missing model → LlmUnavailableError. */
  private wrap(err: unknown, task: string): Error {
    if (isTimeout(err)) {
      return new LlmTimeoutError(
        `Ollama did not answer the ${task} request within ${Math.round(this.timeoutMs / 1000)}s ` +
          `(model "${this.model}" may be slow or busy; raise OLLAMA_TIMEOUT_MS if this persists).`,
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    const cause =
      err instanceof Error && err.cause instanceof Error
        ? err.cause.message
        : '';
    if (
      /fetch failed|ECONNREFUSED|ENOTFOUND|ECONNRESET|EHOSTUNREACH|connect/i.test(
        `${msg} ${cause}`,
      )
    ) {
      return new LlmUnavailableError(
        `Ollama is not reachable at ${this.host} (${cause || msg}). Start Ollama and retry.`,
      );
    }
    if (/not found/i.test(msg)) {
      return new LlmUnavailableError(
        `Ollama model "${this.model}" not found. Run: ollama pull ${this.model}`,
      );
    }
    return new LlmUnavailableError(`Ollama request failed: ${msg}`);
  }
}

function withTimeout(base: FetchFn, ms: number): FetchFn {
  return (input, init) => {
    const timeout = AbortSignal.timeout(ms);
    const signal = init?.signal
      ? AbortSignal.any([init.signal, timeout])
      : timeout;
    return base(input, { ...init, signal });
  };
}

function isTimeout(err: unknown): boolean {
  const e = err as { name?: string; cause?: { name?: string } } | null;
  return (
    !!e &&
    (e.name === 'TimeoutError' ||
      e.cause?.name === 'TimeoutError' ||
      (e.name === 'AbortError' &&
        /timeout/i.test(String((err as Error).message))))
  );
}
