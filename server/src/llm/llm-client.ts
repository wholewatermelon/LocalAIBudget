/** Abstraction over the local LLM so services never talk to Ollama directly (and tests can swap a fake). */
export const LLM_CLIENT = Symbol('LLM_CLIENT');

export type LlmTask = 'categorize' | 'extract' | 'csv-mapping' | 'insights';

export interface LlmJsonRequest {
  /** What the call is for — used for logging and by test fakes to route responses. */
  task: LlmTask;
  system?: string;
  prompt: string;
}

export interface LlmHealth {
  reachable: boolean;
  modelAvailable: boolean;
}

export interface LlmClient {
  readonly model: string;
  /** Sends the prompt with JSON output mode and returns the parsed JSON. Throws LlmUnavailableError if unreachable. */
  generateJson(req: LlmJsonRequest): Promise<unknown>;
  health(): Promise<LlmHealth>;
}

/** Ollama is down/unreachable or the model is missing: jobs fail, insights → 503. */
export class LlmUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmUnavailableError';
  }
}

/**
 * The call exceeded OLLAMA_TIMEOUT_MS (Ollama is up but slow / overloaded). Deliberately NOT an LlmUnavailableError:
 * processing retries the batch once and then leaves rows for review; insights → 504.
 */
export class LlmTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmTimeoutError';
  }
}

/** The model answered but not with parseable JSON. */
export class LlmResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmResponseError';
  }
}
