const fs = require('fs');
const path = require('path');

function inferSubCategoryFromName(name, existing) {
  const n = (name || '').toLowerCase();
  if (/polo|polo shirt/.test(n)) return 'Polo Shirts';
  if (/t-?shirt|tshirt|\btee\b/.test(n)) return 'T-Shirts';
  if (/v-?neck/.test(n)) return 'V-Neck';
  if (/formal shirt|formal/.test(n)) return 'Formal Shirts';
  if (/hoodie|sweatshirt/.test(n)) return 'Hoodies';
  if (/jacket|puffer|bomber|trench|coat/.test(n)) return 'Jackets';
  if (/dress|skirt/.test(n)) return 'Dresses';
  if (/jean|denim/.test(n)) return 'Jeans';
  if (/trouser|trousers|pant|pants|chino/.test(n)) return 'Trousers';
  if (/jogger|joggers/.test(n)) return 'Joggers';
  if (/cargo/.test(n)) return 'Cargo Pants';
  if (/sneaker|trainer|running/.test(n)) return 'Sneakers';
  if (/boot|boots/.test(n)) return 'Boots';
  if (/sandals|flip/.test(n)) return 'Sandals';
  if (/derby|oxford|loafer|loafers/.test(n)) return 'Loafers';
  if (/belt\b/.test(n)) return 'Belts';
  if (/cap\b|hat\b/.test(n)) return 'Caps';
  if (/bag\b|backpack|tote/.test(n)) return 'Bags';
  if (/socks?\b/.test(n)) return 'Socks';
  if (existing && !['clothing','footwear','accessories','bottom','top','other'].includes((existing||'').toLowerCase())) return existing;
  return existing || 'Other';
}

function normalizeCategory(doc) {
  const origTop = (doc.topCategory || '').trim();
  const origSub = (doc.subCategory || '').trim();
  let needsReview = false;

  if (origTop.toLowerCase() === 'kids') {
    const name = (doc.name || '').toLowerCase();
    const sizes = (doc.sizes || []).map(String).map(s => s.toLowerCase());

    if (/\bboy\b|\bboys\b/.test(name) || sizes.some(s => /\d+y|y$/.test(s) || /^\d+$/.test(s))) {
      if (sizes.some(s => /t$/.test(s) || /0|1|2|3t/.test(s))) {
        return { topCategory: 'Toddler Boys', subCategory: inferSubCategoryFromName(doc.name, origSub), needsReview };
      }
      if (sizes.some(s => /2y|4y|6y|8y|10y|12y/.test(s) || /y$/.test(s))) {
        return { topCategory: 'Junior Boys', subCategory: inferSubCategoryFromName(doc.name, origSub), needsReview };
      }
      needsReview = true;
      return { topCategory: 'Junior Boys', subCategory: inferSubCategoryFromName(doc.name, origSub), needsReview };
    }

    if (/\bgirl\b|\bgirls\b/.test(name) || sizes.some(s => /girls|girl/.test(s))) {
      if (sizes.some(s => /t$/.test(s) || /0|1|2|3t/.test(s))) {
        return { topCategory: 'Toddler Girls', subCategory: inferSubCategoryFromName(doc.name, origSub), needsReview };
      }
      if (sizes.some(s => /2y|4y|6y|8y|10y|12y/.test(s) || /y$/.test(s))) {
        return { topCategory: 'Junior Girls', subCategory: inferSubCategoryFromName(doc.name, origSub), needsReview };
      }
      needsReview = true;
      return { topCategory: 'Junior Girls', subCategory: inferSubCategoryFromName(doc.name, origSub), needsReview };
    }

    if (origSub && /footwear/i.test(origSub) && (doc.sizes || []).some(s => /^\d+$/.test(String(s)))) {
      return { topCategory: 'Junior Boys', subCategory: inferSubCategoryFromName(doc.name, origSub), needsReview };
    }

    needsReview = true;
    return { topCategory: 'Junior Boys', subCategory: inferSubCategoryFromName(doc.name, origSub), needsReview };
  }

  const topNorm = origTop ? origTop.charAt(0).toUpperCase() + origTop.slice(1).toLowerCase() : origTop;
  const subNorm = inferSubCategoryFromName(doc.name, origSub);
  return { topCategory: topNorm || origTop, subCategory: subNorm, needsReview };
}

(function main(){
  const filePath = path.join(process.cwd(),'docs','MEILISEARCH_PRODUCTS_EXPORT.json');
  if (!fs.existsSync(filePath)) {
    console.error('Export file not found at', filePath);
    process.exit(1);
  }
  const raw = fs.readFileSync(filePath,'utf8');
  let docs;
  try { docs = JSON.parse(raw); } catch(e){ console.error('Invalid JSON', e); process.exit(1);} 

  let changed = 0;
  docs = docs.map(d => {
    const normalized = normalizeCategory(d);
    if (normalized.topCategory !== d.topCategory || normalized.subCategory !== d.subCategory) {
      changed++;
      d.topCategory = normalized.topCategory;
      d.subCategory = normalized.subCategory;
      d.needsReview = !!normalized.needsReview;
    }
    return d;
  });

  fs.writeFileSync(filePath, JSON.stringify(docs,null,2),'utf8');
  console.log(`Normalized ${changed} documents and wrote ${filePath}`);
})();
