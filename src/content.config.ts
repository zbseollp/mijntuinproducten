import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { coerceImageValue } from './lib/media';

/**
 * Payload may sync featuredImage as a string URL or a media object
 * `{ url, filename, alt }`. Zod must accept both and normalise to a string —
 * rejecting the object drops the field and the selected cover never appears.
 */
const optionalImage = z.preprocess((value) => {
  const coerced = coerceImageValue(value);
  return coerced || undefined;
}, z.string().optional());

const blog = defineCollection({
  loader: glob({
    base: './src/content/blog',
    pattern: '**/*.{md,mdx}',
  }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    author: z.string().optional(),
    categories: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    /** SEO spam / unpublished — hidden by getAllPosts(). */
    draft: z.boolean().optional(),
    _spam: z.string().optional(),
    /** Cover images from Payload / WP migration / R2. */
    featuredImage: optionalImage,
    heroImage: optionalImage,
    image: optionalImage,
  }),
});

export const collections = { blog };
