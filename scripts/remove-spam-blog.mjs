#!/usr/bin/env node
/**
 * Mark SEO malware / celebrity-gossip posts as draft. Nothing is deleted —
 * files stay on disk; the shared loader hides them from the build.
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

const GOSSIP_TITLE_PATTERNS = [
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

const GARDEN_ALLOW =
  /\b(?:tuin|plant|bloem|gazon|border|potgrond|bestrating|heg|haag|moestuin|snoe|decoratie|hout|steiger|graszoden|kunstgras|vijver|loungeset|tuinmeubel)\b/i;

function listBlogFiles(dir = BLOG_DIR) {
  return readdirSync(dir)
    .filter((name) => /\.mdx?$/i.test(name))
    .map((name) => join(dir, name))
    .sort();
}

function readField(frontmatter, field) {
  const match = frontmatter.match(new RegExp(`^${field}:\\s*(.*)$`, 'm'));
  if (!match) return '';
  return match[1].trim().replace(/^["']|["']$/g, '');
}

function slugOf(path) {
  return path.replace(/\\/g, '/').split('/').pop().replace(/\.mdx?$/i, '');
}

function isSpam(path, frontmatter, body) {
  const title = readField(frontmatter, 'title');
  const slug = slugOf(path);
  const hay = `${slug}\n${title}\n${body}`;
  if (INJECTION_PATTERNS.some((p) => p.test(hay))) {
    return 'injected script/redirect payload';
  }
  const titleHay = `${slug.replace(/-/g, ' ')} ${title}`;
  if (!GARDEN_ALLOW.test(titleHay) && GOSSIP_TITLE_PATTERNS.some((p) => p.test(titleHay))) {
    return 'celebrity/gossip SEO spam';
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
  const reason = isSpam(path, frontmatter, body);
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
