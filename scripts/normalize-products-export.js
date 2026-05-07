#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'docs', 'MEILISEARCH_PRODUCTS_EXPORT.json');
const outPath = path.join(process.cwd(), 'docs', 'MEILISEARCH_PRODUCTS_EXPORT.json');

function inferSubCategory(name, existing) {
  const n = name.toLowerCase();
  if (/polo|polo shirt/.test(n)) return 'Polo Shirts';
  if (/t-?shirt|tshirt|tee\b/.test(n)) return 'T-Shirts';
  if (/v-?neck/.test(n)) return 'V-Neck';
  if (/formal shirt|formal/.test(n)) return 'Formal Shirts';
  if (/hoodie|sweatshirt/.test(n)) return 'Hoodies';
  if (/jacket|puffer|bomber|trench|coat/.test(n)) return 'Jackets';
  if (/dress|skirt/.test(n)) return 'Dresses';
  if (/jean|denim/.test(n)) return 'Jeans';
  if (/trouser|trousers|pant|pants|chino/.test(n)) return 'Trousers';
  if (/jogger|joggers/.test(n)) return 'Joggers';
  if (/cargo/.test(n)) return 'Cargo Pants';
  if (/sneaker|trainer|sneakers|sneakers|running/.test(n)) return 'Sneakers';
  if (/boot|boots/.test(n)) return 'Boots';
  if (/sandals|flip/.test(n)) return 'Sandals';
  if (/derby|oxford|loafer|loafers/.test(n)) return 'Loafers';
  if (/belt\b/.test(n)) return 'Belts';
  if (/cap\b|hat\b/.test(n)) return 'Caps';
  if (/bag\b|backpack|tote/.test(n)) return 'Bags';
  if (/socks?\b/.test(n)) return 'Socks';
  // fallback to existing if it's already specific
  const generic = ['clothing','footwear','accessories','bottom','top','other'];
  if (existing && !generic.includes(existing.toLowerCase())) return existing;
  return existing || 'Other';
}

function inferTopCategory(product) {
  // If not Kids, keep as-is but normalize capitalization
  const top = (product.topCategory || '').trim();
  if (!top) return top;
  const t = top.toLowerCase();
  if (t === 'men' || t === 'women') return top.charAt(0).toUpperCase() + top.slice(1).toLowerCase();

  // For kids, try to infer by name tokens and sizes
  const name = (product.name || '').toLowerCase();
  const sizes = (product.sizes || []).map(String).map(s => s.toLowerCase());

  // if name contains boy/girl
  if (/\bboy\b|\bboys\b/.test(name) || sizes.some(s => s.endsWith('y') || /\d+y/.test(s))) {
    // decide toddler vs junior by size tokens
    if (sizes.some(s => /t$/.test(s) || /0|1|2|3T/.test(s))) return 'Toddler Boys';
    if (sizes.some(s => /2y|4y|6y|8y|10y|12y/.test(s) || /y$/.test(s))) return 'Junior Boys';
    // default to Junior Boys
    return 'Junior Boys';
  }

  if (/\bgirl\b|\bgirls\b/.test(name) || sizes.some(s => /girls|girl/.test(s))) {
    if (sizes.some(s => /t$/.test(s) || /0|1|2|3T/.test(s))) return 'Toddler Girls';
    if (sizes.some(s => /2y|4y|6y|8y|10y|12y/.test(s) || /y$/.test(s))) return 'Junior Girls';
    return 'Junior Girls';
  }

  // footwear with numeric sizes likely kids - treat as Junior Boys by default
  if (product.subCategory && /footwear/i.test(product.subCategory) && sizes.some(s => /^\d+$/.test(s))) return 'Junior Boys';

  // otherwise default to Junior Boys and mark for review via flag
  return 'Junior Boys';
}

function normalize() {
  if (!fs.existsSync(filePath)) {
    console.error('Export file not found:', filePath);
    process.exit(1);
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  let docs = JSON.parse(raw);
  let changed = 0;
  const needsReview = [];

  docs = docs.map((p) => {
    const origTop = p.topCategory;
    const origSub = p.subCategory;

    // Normalize subcategory if generic
    const newSub = inferSubCategory(p.name, origSub);
    if (newSub !== origSub) {
      p.subCategory = newSub;
      changed++;
    }

    // Replace Kids topCategory
    if ((origTop || '').toLowerCase() === 'kids') {
      const newTop = inferTopCategory(p);
      if (newTop !== origTop) {
        p.topCategory = newTop;
        changed++;
      }
      // mark for review if inference used default
      if (newTop === 'Junior Boys') {
        p.needsReview = true;
        needsReview.push({ id: p.id, reason: 'Top category inferred as Junior Boys - please verify' });
      }
    }

    // Normalize some generic subCategory names
    if (p.subCategory && ['clothing','bottom','footwear','accessories'].includes((p.subCategory||'').toLowerCase())) {
      const better = inferSubCategory(p.name, p.subCategory);
      if (better && better !== p.subCategory) {
        p.subCategory = better;
        changed++;
      }
    }

    return p;
  });

  fs.writeFileSync(outPath, JSON.stringify(docs, null, 2) + '\n');
  console.log(`Normalized export saved to ${outPath}. Changes: ${changed}. Needs review: ${needsReview.length}`);
  if (needsReview.length) console.log('Sample needsReview:', needsReview.slice(0,5));
}

normalize();
