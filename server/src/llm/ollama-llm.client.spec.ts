import { LlmTimeoutError, LlmUnavailableError } from './llm-client';
import { OllamaLlmClient } from './ollama-llm.client';

const req = { task: 'categorize' as const, prompt: 'x' };

describe('OllamaLlmClient error mapping', () => {
  it('maps a slow response to LlmTimeoutError after OLLAMA_TIMEOUT_MS', async () => {
    // Never answers; only settles when the client's AbortSignal fires.
    const hang = ((_: unknown, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(init.signal!.reason as Error),
        );
      })) as typeof fetch;
    const client = new OllamaLlmClient(
      'http://127.0.0.1:1',
      'gemma4',
      50,
      hang,
    );
    const err = await client.generateJson(req).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LlmTimeoutError);
    expect(err).not.toBeInstanceOf(LlmUnavailableError);
    expect((err as Error).message).toMatch(/within 0s|OLLAMA_TIMEOUT_MS/);
  });

  it('maps connection refused to LlmUnavailableError', async () => {
    const refused = (() =>
      Promise.reject(
        new TypeError('fetch failed', {
          cause: new Error('connect ECONNREFUSED 127.0.0.1:11434'),
        }),
      )) as typeof fetch;
    const client = new OllamaLlmClient(
      'http://127.0.0.1:11434',
      'gemma4',
      1000,
      refused,
    );
    const err = await client.generateJson(req).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LlmUnavailableError);
    expect((err as Error).message).toMatch(/not reachable/);
  });

  it('parses a JSON answer', async () => {
    const ok = (() =>
      Promise.resolve(
        new Response(JSON.stringify({ response: '{"a":1}', done: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )) as typeof fetch;
    const client = new OllamaLlmClient(
      'http://127.0.0.1:11434',
      'gemma4',
      1000,
      ok,
    );
    await expect(client.generateJson(req)).resolves.toEqual({ a: 1 });
  });
});
