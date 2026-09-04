/**
 * Blog cover resolution:
 * - Cards / OG: featuredImage → heroImage → image → slug fallback
 * - Detail hero: heroImage → featuredImage → image → slug fallback
 * - Bare R2 object keys → …/tenants/mijntuinproducten/<file>
 * - Payload often stores media without a file extension; those URLs are valid
 *   when they live under /tenants/<slug>/ or /api/media/ — never reject them
 *   or the selected featured image silently disappears and the body duplicate
 *   may already have been stripped.
 */
import { fallbackImage } from '../data/fallback-images';

/** Matches R2 object prefix used in synced Payload media. */
export const TENANT_SLUG = 'mijntuinproducten';

export type BlogImageFields = {
  featuredImage?: string | null;
  heroImage?: string | null;
  image?: string | null;
};

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif|svg)(?:$|\?)/i;

/**
 * Coerce Payload media shapes into a single URL/path string.
 * Accepts a plain string, `{ url }`, `{ filename }`, or nested media objects.
 */
export function coerceImageValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim().replace(/\s+$/g, '');
  if (typeof value !== 'object') return '';
  const obj = value as Record<string, unknown>;
  for (const key of ['url', 'src', 'pathname'] as const) {
    const raw = obj[key];
    if (typeof raw === 'string' && raw.trim()) return raw.trim();
  }
  // Payload media sometimes only carries filename (+ optional prefix).
  const filename = typeof obj.filename === 'string' ? obj.filename.trim() : '';
  if (!filename) return '';
  const prefix = typeof obj.prefix === 'string' ? obj.prefix.trim().replace(/^\/+|\/+$/g, '') : '';
  if (prefix) return `https://pub-d4024ad3e57841448e0ee58a19abe46b.r2.dev/${prefix}/${filename}`;
  if (/^https?:\/\//i.test(filename) || filename.startsWith('/')) return filename;
  return `https://pub-d4024ad3e57841448e0ee58a19abe46b.r2.dev/tenants/${TENANT_SLUG}/${filename}`;
}

/** Rewrite bare R2 object keys that 404 without the tenant prefix. */
export function repairTenantR2Url(
  url: string | undefined | null,
  tenantSlug: string = TENANT_SLUG,
): string {
  const trimmed = coerceImageValue(url);
  if (!trimmed) return '';
  const slug = tenantSlug.trim().replace(/^\/+|\/+$/g, '');
  if (!slug) return trimmed;
  if (!/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.includes(`/tenants/${slug}/`)) return trimmed;

  try {
    const u = new URL(trimmed);
    const host = u.hostname.toLowerCase();
    const isR2Like =
      host.endsWith('.r2.dev') || host.includes('r2.cloudflarestorage.com');
    if (!isR2Like) return trimmed;

    const path = u.pathname.replace(/^\/+/, '');
    // Bare bucket-root key: https://….r2.dev/filename (no directories)
    if (!path || path.includes('/')) return trimmed;
    u.pathname = `/tenants/${slug}/${path}`;
    return u.toString();
  } catch {
    return trimmed;
  }
}

/** True for Payload/R2 media that is an image even without a classic extension. */
function isPayloadMediaPath(path: string): boolean {
  return (
    path.includes('/tenants/') ||
    path.includes('/api/media/') ||
    /\/media\/file\//i.test(path)
  );
}

/** Reject non-image / placeholder / site-root "images". */
export function isUsableMediaUrl(src?: string | null): boolean {
  const trimmed = coerceImageValue(src);
  if (!trimmed) return false;

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const u = new URL(trimmed);
      const path = u.pathname.replace(/\/+$/, '') || '/';
      if (path === '/') return false;

      // Payload uploads often have no extension (…/hoevergroenjejouwborder).
      // Those still return image/* from R2 — treat them as usable.
      if (isPayloadMediaPath(path)) {
        const leaf = path.split('/').pop() || '';
        return leaf.length > 0 && leaf !== 'tenants' && leaf !== 'file';
      }

      if (!path.includes('.')) return false;
      return IMAGE_EXT.test(path);
    } catch {
      return false;
    }
  }

  return IMAGE_EXT.test(trimmed) || trimmed.startsWith('/images/');
}

function firstUsable(...candidates: Array<unknown>): string {
  for (const c of candidates) {
    const repaired = repairTenantR2Url(coerceImageValue(c));
    if (repaired && isUsableMediaUrl(repaired)) return repaired;
  }
  return '';
}

/** Listing / card image (featured preferred). */
export function getBlogCardImage(data: BlogImageFields, slug = ''): string {
  return (
    firstUsable(data.featuredImage, data.heroImage, data.image) ||
    fallbackImage(slug || 'blog')
  );
}

/** Detail hero image (featured preferred — matches what editors set in Payload). */
export function getBlogHeroImage(data: BlogImageFields, slug = ''): string {
  return (
    firstUsable(data.featuredImage, data.heroImage, data.image) ||
    fallbackImage(slug || 'blog')
  );
}

/** True when the post has a real selected cover (not a slug fallback). */
export function hasBlogCover(data: BlogImageFields): boolean {
  return Boolean(firstUsable(data.featuredImage, data.heroImage, data.image));
}
