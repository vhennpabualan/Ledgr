import { useState } from 'react';

// ─── Known brand keyword → domain map ────────────────────────────────────────
// Maps common label keywords (lowercase) to their logo domain.
// Add more entries here as needed.

const BRAND_MAP: Record<string, string> = {
  // Philippine banks
  rcbc:         'rcbc.com',
  bdo:          'bdo.com.ph',
  bpi:          'bpi.com.ph',
  metrobank:    'metrobank.com.ph',
  pnb:          'pnb.com.ph',
  landbank:     'landbank.com',
  'land bank':  'landbank.com',
  unionbank:    'unionbankph.com',
  'union bank': 'unionbankph.com',
  eastwest:     'eastwestbanker.com',
  'east west':  'eastwestbanker.com',
  security:     'securitybank.com',
  'security bank': 'securitybank.com',
  chinabank:    'chinabank.ph',
  'china bank': 'chinabank.ph',
  psbank:       'psbank.com.ph',
  'ps bank':    'psbank.com.ph',
  maybank:      'maybank.com',
  citibank:     'citibank.com',
  hsbc:         'hsbc.com',

  // Digital banks / e-wallets (PH)
  gcash:        'gcash.com',
  maya:         'maya.ph',
  paymaya:      'maya.ph',
  maribank:     'maribank.com',
  tonik:        'tonikbank.com',
  seabank:      'seabank.ph',
  gotyme:       'gotyme.com',
  'go tyme':    'gotyme.com',
  uno:          'uno.digital',
  'uno digital':'uno.digital',

  // Global / common
  paypal:       'paypal.com',
  wise:         'wise.com',
  revolut:      'revolut.com',
  stripe:       'stripe.com',

  // Food delivery & dining
  grab:         'grab.com',
  grabfood:     'grab.com',
  'grab food':  'grab.com',
  grabpay:      'grab.com',
  'grab pay':   'grab.com',
  foodpanda:    'foodpanda.com',
  'food panda': 'foodpanda.com',
  mcdonalds:    'mcdonalds.com',
  "mcdonald's": 'mcdonalds.com',
  jollibee:     'jollibee.com.ph',
  kfc:          'kfc.com',
  starbucks:    'starbucks.com',
  'pizza hut':  'pizzahut.com',
  pizzahut:     'pizzahut.com',
  'burger king':'burgerking.com',
  burgerking:   'burgerking.com',
  subway:       'subway.com',
  'mang inasal':'manginasal.com',
  manginasal:   'manginasal.com',
  chowking:     'chowking.com',
  greenwich:    'greenwich.com.ph',
  'yellow cab': 'yellowcabpizza.com',
  yellowcab:    'yellowcabpizza.com',
  shakeys:      'shakeyspizza.ph',
  "shakey's":   'shakeyspizza.ph',

  // Ride-hailing & transport
  uber:         'uber.com',
  angkas:       'angkas.com',
  'move it':    'moveit.ph',
  moveit:       'moveit.ph',
  ltfrb:        'ltfrb.gov.ph',

  // Shopping & e-commerce
  shopee:       'shopee.ph',
  lazada:       'lazada.com.ph',
  zalora:       'zalora.com.ph',
  tiktok:       'tiktok.com',
  'tiktok shop':'tiktok.com',
  amazon:       'amazon.com',
  shein:        'shein.com',

  // Streaming & subscriptions
  netflix:      'netflix.com',
  spotify:      'spotify.com',
  youtube:      'youtube.com',
  disney:       'disneyplus.com',
  'disney+':    'disneyplus.com',
  'apple music':'apple.com',
  'apple tv':   'apple.com',
  icloud:       'apple.com',
  'i cloud':    'apple.com',
  'google one': 'one.google.com',
  'google play':'play.google.com',
  'youtube premium': 'youtube.com',
  canva:        'canva.com',
  notion:       'notion.so',
  chatgpt:      'openai.com',
  openai:       'openai.com',
  claude:       'anthropic.com',
  figma:        'figma.com',
  github:       'github.com',
  dropbox:      'dropbox.com',

  // Utilities & telco
  pldt:         'pldt.com.ph',
  globe:        'globe.com.ph',
  smart:        'smart.com.ph',
  dito:         'dito.ph',
  converge:     'convergeict.com',
  meralco:      'meralco.com.ph',
  maynilad:     'mayniladwater.com.ph',
  'manila water':'manilawater.com',

  // Freelance / work
  upwork:       'upwork.com',
  fiverr:       'fiverr.com',
  freelancer:   'freelancer.com',
  payoneer:     'payoneer.com',

  // Tech / employers
  google:       'google.com',
  apple:        'apple.com',
  microsoft:    'microsoft.com',
  meta:         'meta.com',
  facebook:     'facebook.com',
};

/**
 * Extracts a Clearbit logo URL from a label string.
 * Returns null if no known brand is matched.
 */
export function getDomainFromLabel(label: string): string | null {
  const lower = label.toLowerCase();
  for (const [keyword, domain] of Object.entries(BRAND_MAP)) {
    if (lower.includes(keyword)) {
      return domain;
    }
  }
  return null;
}

export function getLogoUrl(domain: string): string {
  // Google's favicon service is served from google.com — far less likely to be
  // blocked by ad blockers than logo.clearbit.com which is on many block lists.
  // sz=64 gives a crisp image at up to 32px display size.
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface BrandLogoProps {
  /** The income/expense label text — used to detect the brand */
  label: string;
  /** Size in pixels (renders as a square) */
  size?: number;
  className?: string;
}

/**
 * Renders a brand logo using Google's favicon service if the label matches a
 * known brand. Falls back to a deterministic colored initial avatar on error
 * or no match.
 *
 * Why Google favicons instead of Clearbit?
 * - logo.clearbit.com is on most ad-blocker block lists → ERR_BLOCKED_BY_CLIENT
 * - Google's s2/favicons endpoint is served from google.com, rarely blocked
 * - Quality is lower (favicon-sized) but reliable
 */
export function BrandLogo({ label, size = 32, className = '' }: BrandLogoProps) {
  const domain = getDomainFromLabel(label);
  const [imgError, setImgError] = useState(false);

  const initial = label.trim()[0]?.toUpperCase() ?? '?';

  // Deterministic hue from label string — same label always gets same color
  const hue = label.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  const bgColor = `hsl(${hue}, 55%, 88%)`;
  const textColor = `hsl(${hue}, 55%, 30%)`;

  const sizeStyle: React.CSSProperties = {
    width: size,
    height: size,
    minWidth: size,
    minHeight: size,
  };

  // No match or image failed → colored initial avatar (same squircle shape)
  if (!domain || imgError) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-xl text-xs font-bold select-none ${className}`}
        style={{ ...sizeStyle, backgroundColor: bgColor, color: textColor }}
        aria-hidden="true"
      >
        {initial}
      </span>
    );
  }

  // Brand logo — white squircle container with padding so the favicon
  // never bleeds to the edges, keeping all icons visually consistent.
  // overflow-hidden is intentionally omitted so the container shape
  // is defined by border-radius alone, not clipping.
  const imgSize = Math.round(size * 0.58);

  return (
    <span
      className={`inline-flex items-center justify-center rounded-xl bg-white dark:bg-white/90 border border-black/[0.07] dark:border-white/[0.10] shadow-sm shadow-black/[0.04] ${className}`}
      style={sizeStyle}
      aria-hidden="true"
    >
      <img
        src={getLogoUrl(domain)}
        alt=""
        width={imgSize}
        height={imgSize}
        style={{ width: imgSize, height: imgSize, objectFit: 'contain', display: 'block' }}
        onError={() => setImgError(true)}
        loading="lazy"
      />
    </span>
  );
}
