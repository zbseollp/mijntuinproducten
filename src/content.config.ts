import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { coerceImageValue } from './lib/media';

/**
 * Payload may sync featuredImage as a string URL or a media object
 * `{ url, filename, alt }`. Extra CMS fields must never fail the collection.
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
  schema: z
    .object({
      title: z.any().optional(),
      description: z.any().optional(),
      excerpt: z.any().optional(),
      metaDescription: z.any().optional(),
      pubDate: z.any().optional(),
      date: z.any().optional(),
      updatedDate: z.any().optional(),
      author: z.any().optional(),
      categories: z.any().optional(),
      tags: z.any().optional(),
      draft: z.any().optional(),
      _spam: z.any().optional(),
      _unpublished: z.any().optional(),
      publishStatus: z.any().optional(),
      _status: z.any().optional(),
      status: z.any().optional(),
      slug: z.any().optional(),
      featuredImage: optionalImage,
      heroImage: optionalImage,
      image: optionalImage,
      thumbnail: optionalImage,
    })
    .passthrough()
    .transform((data) => {
      const asText = (value: unknown) =>
        typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
      const asList = (value: unknown): string[] => {
        if (!Array.isArray(value)) return [];
        return value
          .map((item) => {
            if (typeof item === 'string') return item.trim();
            if (item && typeof item === 'object') {
              const o = item as { name?: unknown; title?: unknown; label?: unknown; slug?: unknown };
              return asText(o.name ?? o.title ?? o.label ?? o.slug);
            }
            return '';
          })
          .filter(Boolean);
      };
      const title = asText(data.title);
      const description = asText(data.description) || asText(data.excerpt) || asText(data.metaDescription);
      const slug = asText(data.slug) || undefined;
      const pubDate = data.pubDate ?? data.date;
      return {
        ...data,
        title,
        description,
        slug,
        pubDate,
        categories: asList(data.categories),
        tags: asList(data.tags),
      };
    }),
});

export const collections = { blog };
