/**
 * Shared published-blog helpers — every listing and getStaticPaths must use
 * these so drafts / SEO spam never appear in one place and 404 in another.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { isSpamBlogPost } from './spam-blog';

export type Post = CollectionEntry<'blog'>;

function timestamp(post: Post): number {
  const value = post.data.pubDate;
  return value instanceof Date && !Number.isNaN(value.valueOf()) ? value.valueOf() : 0;
}

export function isPublished(post: Post): boolean {
  if (post.data.draft) return false;
  if (isSpamBlogPost(post.id, post.body ?? '', post.data.title ?? '')) return false;
  return true;
}

/** Newest-first published garden posts (spam / drafts excluded). */
export async function getAllPosts(): Promise<Post[]> {
  const posts = await getCollection('blog');
  return posts
    .filter(isPublished)
    .sort((a, b) => {
      const byDate = timestamp(b) - timestamp(a);
      if (byDate !== 0) return byDate;
      return a.id.localeCompare(b.id);
    });
}

export async function getRecentPosts(limit = 6): Promise<Post[]> {
  return (await getAllPosts()).slice(0, limit);
}
