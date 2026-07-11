const fs=require('fs');
let c=fs.readFileSync('D:/WEB DEVELOPMENT/broady/apps/web/src/app/page.tsx','utf8');

c = c.replace(
  'const juniorsProducts = products.filter((product) => ["Junior Boys", "Toddler Boys", "Junior Girls", "Toddler Girls"].includes(product.topCategory)).slice(0, 16);',
  'const boysProducts = products.filter((product) => ["Junior Boys", "Toddler Boys"].includes(product.topCategory)).slice(0, 16);\n  const girlsProducts = products.filter((product) => ["Junior Girls", "Toddler Girls"].includes(product.topCategory)).slice(0, 16);'
);

c = c.replace(
  '{ name: "Juniors", image: "https://images.unsplash.com/photo-1471286174890-9c112ffca5b4?w=1200", href: "/category/Juniors" },',
  '{ name: "Boys", image: "https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=1200", href: "/category/Boys" },\n    { name: "Girls", image: "https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=1200", href: "/category/Girls" },'
);

c = c.replace(
  '<div className="grid gap-4 md:grid-cols-3">',
  '<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">'
);

c = c.replace(
  '<GridSection title="Juniors" eyebrow="Category spotlight" href="/category/Juniors" ctaLabel="View Juniors">\n        <div className="min-w-0 overflow-x-hidden">\n          <RecommendedProductCarouselRow products={juniorsProducts} label="Juniors" topCategory="Juniors" source="home-juniors" />\n        </div>\n      </GridSection>',
  '<GridSection title="Boys" eyebrow="Category spotlight" href="/category/Boys" ctaLabel="View Boys">\n        <div className="min-w-0 overflow-x-hidden">\n          <RecommendedProductCarouselRow products={boysProducts} label="Boys" topCategory="Junior Boys" source="home-boys" />\n        </div>\n      </GridSection>\n\n      <GridSection title="Girls" eyebrow="Category spotlight" href="/category/Girls" ctaLabel="View Girls">\n        <div className="min-w-0 overflow-x-hidden">\n          <RecommendedProductCarouselRow products={girlsProducts} label="Girls" topCategory="Junior Girls" source="home-girls" />\n        </div>\n      </GridSection>'
);

fs.writeFileSync('D:/WEB DEVELOPMENT/broady/apps/web/src/app/page.tsx',c);
