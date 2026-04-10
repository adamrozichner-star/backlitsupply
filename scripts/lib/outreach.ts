/**
 * Stage 7 — Outreach copy generation
 *
 * Uses Claude Haiku via LlmClient to generate personalized outreach email.
 * Subject <50 chars, body <75 words, references owner first name + business name
 * + /for/{slug} URL. No "hope this finds you well". Ends "worth a look?"
 *
 * copyAngle from niche config selects prompt variant.
 */

import type { OutreachDraft } from './types'
import type { LlmClient } from './llm'

const OUTREACH_TOOL = {
  name: 'draft_outreach',
  description: 'Generate a personalized cold outreach email for a business prospect.',
  input_schema: {
    type: 'object' as const,
    properties: {
      subject: {
        type: 'string',
        description: 'Email subject line, under 50 characters. No emoji.',
      },
      body: {
        type: 'string',
        description: 'Email body, under 75 words. Direct, personal, ends with "worth a look?"',
      },
    },
    required: ['subject', 'body'],
  },
}

const ANGLE_PROMPTS: Record<string, string> = {
  'luxury-aesthetic': `You write cold outreach emails for a premium backlit sign company.
Tone: confident, premium, not salesy. Think Apple Store meets boutique hotel.
The recipient is a med spa / aesthetics clinic owner who values design and luxury.
Reference that their space already looks beautiful — the sign would elevate it further.`,

  'warm-inviting': `You write cold outreach emails for a premium backlit sign company.
Tone: warm, friendly, not pushy. Think neighborhood restaurant welcome.
The recipient runs a restaurant or café and cares about ambiance and foot traffic.
Reference that a lit sign draws people in — especially at night.`,
}

const DEFAULT_ANGLE = `You write cold outreach emails for a premium backlit sign company.
Tone: direct, professional, brief. No fluff.`

export interface OutreachOptions {
  llm: LlmClient
  copyAngle: string
  prospect: {
    slug: string
    business_name: string
    owner_first_name?: string
    email: string
    city?: string
  }
}

export async function generateOutreach(opts: OutreachOptions): Promise<OutreachDraft> {
  const { llm, copyAngle, prospect } = opts
  const anglePrompt = ANGLE_PROMPTS[copyAngle] || DEFAULT_ANGLE
  const personalizedUrl = `https://backlitsupply.com/for/${prospect.slug}`
  const firstName = prospect.owner_first_name || 'there'

  const result = await llm.extract<{ subject: string; body: string }>({
    system: anglePrompt,
    prompt: `Write a cold outreach email to ${firstName} at ${prospect.business_name}${prospect.city ? ` in ${prospect.city}` : ''}.

Rules:
- Subject line under 50 characters, no emoji
- Body under 75 words
- Reference their business by name
- Use their first name "${firstName}"
- Include this exact URL (do not modify): ${personalizedUrl}
- Do NOT say "hope this finds you well" or any variant
- End the body with "worth a look?"
- Sign off as "— Adam, Backlit Supply"`,
    tools: [OUTREACH_TOOL],
    toolChoice: 'draft_outreach',
  })

  return {
    slug: prospect.slug,
    subject: result.input.subject,
    body: result.input.body,
    to_email: prospect.email,
    to_name: firstName,
    personalized_url: personalizedUrl,
  }
}

/**
 * Fixture outreach — deterministic, no LLM call.
 */
export function generateOutreachFixture(prospect: {
  slug: string
  business_name: string
  owner_first_name?: string
  email: string
}): OutreachDraft {
  const firstName = prospect.owner_first_name || 'there'
  return {
    slug: prospect.slug,
    subject: `${prospect.business_name} — quick mockup`,
    to_email: prospect.email,
    to_name: firstName,
    personalized_url: `https://backlitsupply.com/for/${prospect.slug}`,
    body: `Hi ${firstName},\n\nI put together a free mockup of a backlit sign for ${prospect.business_name}. No commitment — just thought it might spark some ideas.\n\nHere it is: https://backlitsupply.com/for/${prospect.slug}\n\nWorth a look?\n\n— Adam, Backlit Supply`,
  }
}
