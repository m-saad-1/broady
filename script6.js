const fs=require('fs');
let c=fs.readFileSync('D:/WEB DEVELOPMENT/broady/apps/web/src/app/category/[category]/category-collection-client.tsx','utf8');

c = c.replace(
  '  if (normalized === "juniors" || normalized === "kids") return "Juniors";',
  '  if (normalized === "boys") return "Boys";\n  if (normalized === "girls") return "Girls";\n  if (normalized === "juniors" || normalized === "kids") return "Juniors";'
);

c = c.replace(
  '    const categories = isMenSlug(slug)\n      ? Array.from(new Set([...MEN_PRESET_CATEGORIES, ...unique]))\n      : isWomenSlug(slug)\n        ? Array.from(new Set([...WOMEN_PRESET_CATEGORIES, ...unique]))\n        : unique;',
  '    const categories = isMenSlug(slug) || slugToLabel(slug).includes("Boy")\n      ? Array.from(new Set([...MEN_PRESET_CATEGORIES, ...unique]))\n      : isWomenSlug(slug) || slugToLabel(slug).includes("Girl")\n        ? Array.from(new Set([...WOMEN_PRESET_CATEGORIES, ...unique]))\n        : unique;'
);

c = c.replace(
  '    const imageMap = isMenSlug(slug)\n      ? MEN_CATEGORY_CARD_IMAGES\n      : isWomenSlug(slug)\n        ? WOMEN_CATEGORY_CARD_IMAGES\n        : {};',
  '    const imageMap = isMenSlug(slug) || slugToLabel(slug).includes("Boy")\n      ? MEN_CATEGORY_CARD_IMAGES\n      : isWomenSlug(slug) || slugToLabel(slug).includes("Girl")\n        ? WOMEN_CATEGORY_CARD_IMAGES\n        : {};'
);

c = c.replace(
  '              ? "https://images.unsplash.com/photo-1516826957135-700dedea698c?w=1800"\n              : isWomenSlug(slug)\n                ? "https://images.unsplash.com/photo-1485968579580-b6d095142e6e?w=1800"\n                : "https://images.unsplash.com/photo-1471286174890-9c112ffca5b4?w=1800"',
  '              ? "https://images.unsplash.com/photo-1516826957135-700dedea698c?w=1800"\n              : isWomenSlug(slug)\n                ? "https://images.unsplash.com/photo-1485968579580-b6d095142e6e?w=1800"\n                : slugToLabel(slug) === "Boys" ? "https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=1800"\n                : slugToLabel(slug) === "Girls" ? "https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=1800"\n                : "https://images.unsplash.com/photo-1471286174890-9c112ffca5b4?w=1800"'
);

c = c.replace(
  'Try Men, Women, Juniors, or junior subgroup pages.',
  'Try Men, Women, Boys, Girls, or subgroup pages.'
);

fs.writeFileSync('D:/WEB DEVELOPMENT/broady/apps/web/src/app/category/[category]/category-collection-client.tsx',c);
