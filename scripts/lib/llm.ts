/**
 * LLM client interface — all LLM calls go through this.
 * FixtureLlmClient for offline tests, ClaudeLlmClient for production.
 */

export interface LlmToolCall<T = Record<string, unknown>> {
  name: string
  input: T
}

export interface LlmClient {
  /**
   * Send a prompt with a tool schema and get back the structured tool call.
   * Uses Claude tool-use for structured output.
   */
  extract<T>(opts: {
    system?: string
    prompt: string
    tools: LlmToolDef[]
    toolChoice: string  // which tool to force
  }): Promise<LlmToolCall<T>>
}

export interface LlmToolDef {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

/**
 * Fixture LLM client — returns canned responses for offline testing.
 * Map of toolChoice → response.
 */
export class FixtureLlmClient implements LlmClient {
  private fixtures: Map<string, LlmToolCall>

  constructor(fixtures: Record<string, LlmToolCall>) {
    this.fixtures = new Map(Object.entries(fixtures))
  }

  async extract<T>(opts: { toolChoice: string }): Promise<LlmToolCall<T>> {
    const fixture = this.fixtures.get(opts.toolChoice)
    if (!fixture) {
      throw new Error(`[FixtureLlmClient] No fixture for tool "${opts.toolChoice}"`)
    }
    return fixture as LlmToolCall<T>
  }
}

/**
 * Claude Haiku client — uses Anthropic API with tool-use.
 * Stubbed until ANTHROPIC_API_KEY is available.
 */
export class ClaudeLlmClient implements LlmClient {
  private apiKey: string

  constructor() {
    const key = process.env.ANTHROPIC_API_KEY
    if (!key) throw new Error('[ClaudeLlmClient] Missing ANTHROPIC_API_KEY')
    this.apiKey = key
  }

  async extract<T>(opts: {
    system?: string
    prompt: string
    tools: LlmToolDef[]
    toolChoice: string
  }): Promise<LlmToolCall<T>> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: opts.system,
        messages: [{ role: 'user', content: opts.prompt }],
        tools: opts.tools.map(t => ({
          name: t.name,
          description: t.description,
          input_schema: t.input_schema,
        })),
        tool_choice: { type: 'tool', name: opts.toolChoice },
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`[ClaudeLlmClient] API error ${res.status}: ${body}`)
    }

    const data = await res.json()
    const toolUse = data.content?.find((b: { type: string }) => b.type === 'tool_use')
    if (!toolUse) throw new Error('[ClaudeLlmClient] No tool_use block in response')

    return { name: toolUse.name, input: toolUse.input as T }
  }
}

/**
 * Factory: returns FixtureLlmClient if no API key, ClaudeLlmClient otherwise.
 */
export function createLlmClient(fixtures?: Record<string, LlmToolCall>): LlmClient {
  if (fixtures) return new FixtureLlmClient(fixtures)
  if (process.env.ANTHROPIC_API_KEY) return new ClaudeLlmClient()
  throw new Error('[LLM] No ANTHROPIC_API_KEY and no fixtures provided')
}
