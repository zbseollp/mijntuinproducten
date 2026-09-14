/**
 * Spam / SEO-malware detector for mijntuinproducten blog content.
 *
 * Listings hide injected script/redirect payloads only. Gossip title
 * heuristics stay available for editors but must not drop published CMS posts.
 */

const INJECTION_PATTERNS: RegExp[] = [
  /document\s*\.\s*write\s*\(/i,
  /\beval\s*\(\s*atob\s*\(/i,
  /\bunescape\s*\(\s*["']%(?:3C|64)/i,
  /window\s*\.\s*location\s*(?:\.\s*(?:href|replace)\s*[=(]|\s*=)/i,
  /<meta[^>]+http-equiv=["']?refresh["']?[^>]*url=/i,
];

/** Celebrity / gossip SEO filler (Dutch) — hard spam on this garden site. */
const GOSSIP_TITLE_PATTERNS: RegExp[] = [
  /\bvriendin\b/i,
  /\bvriend van\b/i,
  /\bvriend\b/i,
  /\bgetrouwd\b/i,
  /\brelatiestatus\b/i,
  /\bex-partner\b/i,
  /\bzwanger\b/i,
  /\bgescheiden\b/i,
  /\bpartner\b/i,
  /\bleeftijd\b/i,
  /\b(?:vermogen|lengte) van\b/i,
  /\bmoeder\b/i,
  /\bvader\b/i,
  /\bdochter\b/i,
  /\bzoon van\b/i,
  /\bkinderen\b/i,
];

/** Slug/title shapes that are garden-on-topic even if a soft word appears. */
const GARDEN_ALLOW: RegExp =
  /\b(?:tuin|plant|bloem|gazon|border|potgrond|bestrating|heg|haag|moestuin|snoe|decoratie|hout|steiger|graszoden|kunstgras|vijver|loungeset|tuinmeubel)\b/i;

export function hasInjectedPayload(body: string): boolean {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(body));
}

function slugFromId(id: string): string {
  return id.replace(/\\/g, '/').split('/').pop()?.replace(/\.(md|mdx)$/i, '') ?? id;
}

export function isGossipSpamPost(id: string, title = ''): boolean {
  const slug = slugFromId(id);
  const haystack = `${slug.replace(/-/g, ' ')} ${title}`;
  if (GARDEN_ALLOW.test(haystack)) return false;
  return GOSSIP_TITLE_PATTERNS.some((pattern) => pattern.test(haystack));
}

/**
 * Hard spam only — injected script/redirect payloads.
 * Celebrity/gossip title heuristics must not hide published Payload posts.
 */
export function isSpamBlogPost(id: string, body = '', title = ''): boolean {
  return hasInjectedPayload(`${id}\n${title}\n${body}`);
}

export const SPAM_INJECTION_PATTERNS = INJECTION_PATTERNS;
export const SPAM_GOSSIP_TITLE_PATTERNS = GOSSIP_TITLE_PATTERNS;
