#!/usr/bin/env node
/**
 * Mark injected script/redirect payloads as unpublished spam.
 * Do not hide published Payload posts via leftover draft or gossip heuristics.
 *
 *   node scripts/remove-spam-blog.mjs
 *   node scripts/remove-spam-blog.mjs --dry-run
 */
import { writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const BLOG_DIR = 'src/content/blog';

const INJECTION_PATTERNS = [
  /document\s*\.\s*write\s*\(/i,
  /\beval\s*\(\s*atob\s*\(/i,
  /\bunescape\s*\(\s*["']%(?:3C|64)/i,
  /window\s*\.\s*location\s*(?:\.\s*(?:href|replace)\s*[=(]|\s*=)/i,
  /<meta[^>]+http-equiv=["']?refresh["']?[^>]*url=/i,
];

function listBlogFiles(dir = BLOG_DIR) {
  return readdirSync(dir)
    .filter((name) => /\.mdx?$/i.test(name))
    .map((name) => join(dir, name))
    .sort();
}

function slugOf(path) {
  return path.replace(/\\/g, '/').split('/').pop().replace(/\.mdx?$/i, '');
}

function isInjection(path, frontmatter, body) {
  const hay = `${path}\n${frontmatter}\n${body}`;
  if (INJECTION_PATTERNS.some((p) => p.test(hay))) {
    return 'injected script/redirect payload';
  }
  const slug = slugOf(path);
  if (slug === 'hello-world' || slug === 'blog-template' || slug.startsWith('blog-template')) {
    return 'stub';
  }
  return null;
}

function markDraft(path, reason) {
  const raw = readFileSync(path, 'utf8');
  if (/^_spam:/m.test(raw) && /^draft:\s*true/m.test(raw)) return false;
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return false;
  let fm = m[1]
    .replace(/^draft:.*$/m, '')
    .replace(/^_spam:.*$/m, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
  fm += `\ndraft: true\n_spam: ${JSON.stringify(reason)}`;
  writeFileSync(path, raw.replace(m[0], `---\n${fm}\n---`));
  return true;
}

let marked = 0;
let found = 0;

for (const path of listBlogFiles()) {
  const raw = readFileSync(path, 'utf8');
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  const frontmatter = m?.[1] ?? '';
  const body = m ? raw.slice(m[0].length) : raw;
  const reason = isInjection(path, frontmatter, body);
  if (!reason) continue;
  found += 1;
  if (dryRun) {
    console.log(`[remove-spam-blog] would mark ${path} (${reason})`);
    continue;
  }
  if (markDraft(path, reason)) {
    marked += 1;
    console.log(`[remove-spam-blog] marked draft: ${path} (${reason})`);
  }
}

console.log(
  `[remove-spam-blog] ${found} spam post(s)${dryRun ? ' (dry run)' : `, marked ${marked} draft`}`,
);
