/**
 * Remove a leading markdown/HTML image that duplicates frontmatter
 * heroImage / featuredImage / image so the layout cover is the only one.
 *
 * Only strip when the frontmatter cover looks like a usable media URL.
 * Otherwise a rejected/broken featuredImage would remove the body image and
 * leave the post with no image at all (client: "featured image does not appear").
 */
export function remarkStripFeaturedDuplicate() {
  return (tree, file) => {
    const fm = file.data?.astro?.frontmatter || file.data?.frontmatter || {};
    const featured = String(fm.featuredImage || fm.heroImage || fm.image || '').trim();
    if (!featured || !isUsableCover(featured) || !tree.children?.length) return;

    const featuredCanon = canonicalFilename(featured);

    let i = 0;
    while (i < tree.children.length) {
      const node = tree.children[i];
      if (node.type === 'text' && !String(node.value || '').trim()) {
        i += 1;
        continue;
      }
      break;
    }
    if (i >= tree.children.length) return;

    // Also skip a leading H1 that duplicates the title, then check image.
    const title = normalizeTitle(fm.title || '');
    if (
      tree.children[i]?.type === 'heading' &&
      tree.children[i].depth === 1 &&
      title &&
      normalizeTitle(headingText(tree.children[i])) === title
    ) {
      tree.children.splice(i, 1);
      while (i < tree.children.length && isBlank(tree.children[i])) {
        tree.children.splice(i, 1);
      }
    }

    const limit = Math.min(tree.children.length, 10);
    for (let idx = 0; idx < limit; idx += 1) {
      const node = tree.children[idx];
      const src = nodeImageSrc(node);
      if (!src) continue;
      if (!isSameImage(src, featured, featuredCanon)) continue;
      if (!isImageOnlyBlock(node)) continue;
      tree.children.splice(idx, 1);
      break;
    }
  };
}

function canonicalFilename(src = '') {
  const file = String(src).split('?')[0].split('/').pop()?.toLowerCase() || '';
  return file.replace(/-\d+x\d+(?=\.[a-z0-9]+$)/i, '');
}

/** Mirror src/lib/media.ts — keep body image if cover would not render. */
function isUsableCover(src = '') {
  const trimmed = String(src).trim();
  if (!trimmed) return false;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const u = new URL(trimmed);
      const path = u.pathname.replace(/\/+$/, '') || '/';
      if (path === '/') return false;
      if (
        path.includes('/tenants/') ||
        path.includes('/api/media/') ||
        /\/media\/file\//i.test(path)
      ) {
        const leaf = path.split('/').pop() || '';
        return leaf.length > 0;
      }
      return /\.(jpe?g|png|webp|gif|avif|svg)(?:$|\?)/i.test(path);
    } catch {
      return false;
    }
  }
  return (
    /\.(jpe?g|png|webp|gif|avif|svg)(?:$|\?)/i.test(trimmed) ||
    trimmed.startsWith('/images/')
  );
}

function isSameImage(candidate, featured, featuredCanon) {
  if (!featured?.trim() || !candidate?.trim()) return false;
  if (candidate.trim() === featured.trim()) return true;
  return canonicalFilename(candidate) === (featuredCanon || canonicalFilename(featured));
}

function normalizeTitle(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function headingText(node) {
  if (!node?.children) return '';
  return node.children
    .map((c) => {
      if (c.type === 'text') return c.value || '';
      if (c.type === 'strong' || c.type === 'emphasis') return headingText(c);
      return '';
    })
    .join('')
    .trim();
}

function imgSrcFromHtml(value = '') {
  return value.match(/\bsrc=["']([^"']+)["']/i)?.[1] || '';
}

function nodeImageSrc(node) {
  if (!node) return '';
  if (node.type === 'image') return node.url || '';
  if (node.type === 'html') return imgSrcFromHtml(node.value || '');
  if (node.type === 'paragraph' && Array.isArray(node.children)) {
    if (node.children.length === 1 && node.children[0].type === 'image') {
      return node.children[0].url || '';
    }
    const html = node.children.find((c) => c.type === 'html');
    if (html) return imgSrcFromHtml(html.value || '');
  }
  return '';
}

function isBlank(node) {
  if (!node) return true;
  if (node.type === 'text') return !String(node.value || '').trim();
  if (node.type === 'paragraph') {
    const text = (node.children || [])
      .map((c) => (c.type === 'text' ? c.value : ''))
      .join('')
      .trim();
    return !text && !(node.children || []).some((c) => c.type === 'image' || c.type === 'html');
  }
  return false;
}

function isImageOnlyBlock(node) {
  if (!node) return false;
  if (node.type === 'image' || node.type === 'html') return Boolean(nodeImageSrc(node));
  if (node.type === 'paragraph') {
    const kids = node.children || [];
    if (!kids.length) return false;
    return kids.every(
      (c) => c.type === 'image' || c.type === 'html' || isBlank(c),
    );
  }
  return false;
}
