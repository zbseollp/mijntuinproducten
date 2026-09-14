/**
 * Shared published-blog helpers — every listing and getStaticPaths must use
 * these so the same posts appear on /blog/, homepage, footer, sitemap, and routes.
 *
 * Leftover `draft: true` from Payload sync is not unpublished. CMS
 * `publishStatus` / `_status` is the source of truth.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { hasInjectedPayload } from './spam-blog';

export type Post = CollectionEntry<'blog'>;

const STUB_SLUGS = new Set(['hello-world', 'blog-template']);
const UNPUBLISHED = new Set(['draft', 'unpublished', 'private', 'trash', 'archived']);
const PUBLISHED = new Set(['published', 'publish', 'live']);

function textFromUnknown(value: unknown): string {
  if (value == null || value === '') return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const text = String(value).trim();
    return text && text !== '[object Object]' ? text : '';
  }
  return '';
}

function slugFromId(id: string): string {
  return id.replace(/\\/g, '/').split('/').pop()?.replace(/\.(md|mdx)$/i, '') ?? id;
}

export function publicSlug(post: { id: string; data: { slug?: unknown } }): string {
  return (textFromUnknown(post.data.slug) || slugFromId(post.id)).replace(/^\/+|\/+$/g, '');
}

export function publicHref(post: { id: string; data: { slug?: unknown } }): string {
  return `/${publicSlug(post)}/`;
}

function statusOf(data: Post['data']): string {
  return textFromUnknown(
    (data as { publishStatus?: unknown; _status?: unknown; status?: unknown }).publishStatus ||
      (data as { _status?: unknown })._status ||
      (data as { status?: unknown }).status,
  ).toLowerCase();
}

export function isPublished(post: Post): boolean {
  const slug = publicSlug(post).toLowerCase();
  if (STUB_SLUGS.has(slug) || slug.startsWith('blog-template')) return false;
  if (hasInjectedPayload(`${post.id}\n${post.data.title ?? ''}\n${post.body ?? ''}`)) return false;

  const unpublished =
    Boolean((post.data as { _unpublished?: unknown })._unpublished) ||
    String((post.data as { _spam?: unknown })._spam ?? '').toLowerCase().includes('unpublished');
  if (unpublished) return false;

  const status = statusOf(post.data);
  if (PUBLISHED.has(status)) return true;
  if (UNPUBLISHED.has(status)) return false;
  // Leftover `draft: true` (including local gossip marks) is not unpublished.
  return true;
}

export function getPostDate(data: Post['data']): Date {
  const value =
    data.pubDate ??
    (data as { date?: unknown }).date ??
    data.updatedDate;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date(0);
}

export function formatPostDate(data: Post['data']): string {
  const date = getPostDate(data);
  if (!date.getTime()) return '';
  return date.toLocaleDateString('nl-NL', { year: 'numeric', month: 'long', day: 'numeric' });
}

function timestamp(post: Post): number {
  return getPostDate(post.data).getTime();
}

/** Newest-first published garden posts. */
export async function getAllPosts(): Promise<Post[]> {
  const posts = await getCollection('blog');
  return posts
    .filter(isPublished)
    .sort((a, b) => {
      const byDate = timestamp(b) - timestamp(a);
      if (byDate !== 0) return byDate;
      return publicSlug(a).localeCompare(publicSlug(b));
    });
}

export async function getRecentPosts(limit = 6): Promise<Post[]> {
  return (await getAllPosts()).slice(0, limit);
}
