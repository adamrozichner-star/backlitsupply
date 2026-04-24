// Centralized config — easy to update in one place

export const SITE_NAME = 'Backlit Supply'
export const SITE_DESCRIPTION = 'Custom backlit signs, made for your business.'
export const SITE_URL = 'https://backlitsupply.com'

export const CALENDLY_URL = '#' // TODO: Replace with real Calendly link

export const NAV_LINKS = [
  { href: '/work', label: 'Our Work' },
  { href: '/process', label: 'How It Works' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/factory', label: 'Our Factory' },
  { href: '/contact', label: 'Contact' },
] as const
