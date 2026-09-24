// Minimal OpenAI-compatible client (llama.cpp server, Ollama, vLLM, ...).
// Adapted in spirit from project-brain's openai-compat provider; uses Node's global fetch.

export class ChatClient {
  constructor({ endpoint, apiKey = '', model = null, timeoutMs = 180000, seed = 42, llamaCppExtras = true }) {
    if (!endpoint) throw new Error('endpoint is required (--endpoint or MODEL_EVAL_ENDPOINT)');
    this.endpoint = endpoint.replace(/\/+$/, '').replace(/\/v1$/, '');
    this.apiKey = apiKey;
    this.model = model;
    this.timeoutMs = timeoutMs;
    this.seed = seed;
    // llama.cpp's prompt cache makes temperature-0 output vary between runs, so by
    // default we send cache_prompt:false. Strict OpenAI servers may reject unknown
    // fields; pass llamaCppExtras:false (CLI --no-llamacpp-extras) for those.
    this.llamaCppExtras = llamaCppExtras;
  }

  headers() {
    const h = { 'Content-Type': 'application/json' };
    if (this.apiKey) h.Authorization = `Bearer ${this.apiKey}`;
    return h;
  }

  /** GET /v1/models. Returns the raw list of { id, ... } entries. */
  async listModels() {
    const res = await fetch(`${this.endpoint}/v1/models`, {
      headers: this.headers(),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`GET /v1/models ${res.status}: ${await res.text().catch(() => '')}`);
    const body = await res.json();
    return body.data ?? [];
  }

  /**
   * One non-streaming chat completion at temperature 0.
   * Never throws: failures come back as { error, timedOut }.
   */
  async chat(messages, { maxTokens = 512 } = {}) {
    const started = performance.now();
    const payload = {
      model: this.model ?? 'default',
      messages,
      temperature: 0,
      top_p: 1,
      seed: this.seed,
      max_tokens: maxTokens,
      stream: false,
    };
    if (this.llamaCppExtras) payload.cache_prompt = false;
    try {
      const res = await fetch(`${this.endpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      const latencyMs = Math.round(performance.now() - started);
      if (!res.ok) {
        const body = await res.text().catch(() => res.statusText);
        return { error: `HTTP ${res.status}: ${body.slice(0, 500)}`, timedOut: false, latencyMs };
      }
      const data = await res.json();
      const choice = data.choices?.[0] ?? {};
      return {
        text: choice.message?.content ?? '',
        finishReason: choice.finish_reason ?? null,
        usage: data.usage ?? null,
        timings: data.timings ?? null, // llama.cpp extension: prompt/predicted ms and tokens/s
        latencyMs,
      };
    } catch (err) {
      const latencyMs = Math.round(performance.now() - started);
      const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
      return {
        error: timedOut ? `timed out after ${this.timeoutMs} ms` : String(err?.cause?.message ?? err?.message ?? err),
        timedOut,
        latencyMs,
      };
    }
  }
}
