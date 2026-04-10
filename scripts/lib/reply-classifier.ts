/**
 * Stage 8 — Reply classification
 *
 * Classifies inbound email replies into categories for pipeline routing.
 * Uses Claude Haiku via LlmClient for semantic classification.
 */

import type { ReplyClass } from './types'
import type { LlmClient } from './llm'

export interface ReplyClassifier {
  classify(body: string): Promise<ReplyClass>
}

const CLASSIFY_TOOL = {
  name: 'classify_reply',
  description: 'Classify an inbound email reply into a category.',
  input_schema: {
    type: 'object' as const,
    properties: {
      classification: {
        type: 'string',
        enum: ['interested', 'objection', 'unsubscribe', 'ooo', 'other'],
        description: `Classify the reply:
- interested: wants to learn more, asks questions, requests pricing, says yes
- objection: pushback on price, timing, need, or competitor comparison
- unsubscribe: asks to stop emailing, remove from list, reports spam
- ooo: out of office auto-reply
- other: anything that doesn't fit above`,
      },
      confidence: {
        type: 'number',
        description: 'Confidence score 0–1',
      },
    },
    required: ['classification', 'confidence'],
  },
}

// ─── LLM-based classifier ───────────────────────────────

export class LlmReplyClassifier implements ReplyClassifier {
  constructor(private llm: LlmClient) {}

  async classify(body: string): Promise<ReplyClass> {
    const result = await this.llm.extract<{ classification: ReplyClass; confidence: number }>({
      system: 'You classify inbound email replies to cold outreach for a sign company.',
      prompt: `Classify this email reply:\n\n${body.slice(0, 2000)}`,
      tools: [CLASSIFY_TOOL],
      toolChoice: 'classify_reply',
    })

    return result.input.classification
  }
}

// ─── Fixture classifier ─────────────────────────────────

export class FixtureReplyClassifier implements ReplyClassifier {
  async classify(body: string): Promise<ReplyClass> {
    const lower = body.toLowerCase()
    if (/out of (the )?office|ooo|auto.?reply|away from/i.test(lower)) return 'ooo'
    if (/unsubscribe|stop|remove|spam|do not (contact|email)/i.test(lower)) return 'unsubscribe'
    if (/interested|tell me more|pricing|how much|sounds good|yes|love to/i.test(lower)) return 'interested'
    if (/not interested|no thanks|too expensive|already have|don't need/i.test(lower)) return 'objection'
    return 'other'
  }
}
