export const MEN_CATEGORY_CARD_IMAGES: Record<string, string> = {
  Shirts: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=1200",
  "T-Shirts": "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=1200",
  Jackets: "https://images.unsplash.com/photo-1521223890158-f9f7c3d5d504?w=1200",
  Polo: "https://images.unsplash.com/photo-1586790170083-2f9ceadc732d?w=1200",
  "Polo Shirts": "https://images.unsplash.com/photo-1586790170083-2f9ceadc732d?w=1200",
  "Formal Shirts": "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=1200",
  Hoodies: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=1200",
  Jeans: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=1200",
  Trousers: "https://images.unsplash.com/photo-1506629905607-45f4ba5cfe0f?w=1200",
  Sneakers: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1200",
  Boots: "https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=1200",
  Belts: "https://images.unsplash.com/photo-1548883354-94bcfe321cbb?w=1200",
  Accessories: "https://images.unsplash.com/photo-1622560482379-6d7f18e28c25?w=1200",
};

export const WOMEN_CATEGORY_CARD_IMAGES: Record<string, string> = {
  Shirts: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1200",
  "T-Shirts": "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=1200",
  Jackets: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=1200",
  Polo: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1200",
  Dresses: "https://images.unsplash.com/photo-1495385794356-15371f348c31?w=1200",
  "V-Neck": "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=1200",
  "Formal Shirts": "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1200",
  Skirts: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1200",
  Jeans: "https://images.unsplash.com/photo-1542272604-787c3835535d?w=1200",
  Sneakers: "https://images.unsplash.com/photo-1552346154-21d32810aba3?w=1200",
  Sandals: "https://images.unsplash.com/photo-1514989940723-e8e51635b782?w=1200",
  Bags: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=1200",
  Jewelry: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=1200",
  Accessories: "https://images.unsplash.com/photo-1622560482379-6d7f18e28c25?w=1200",
};

export const FALLBACK_CATEGORY_IMAGE = "https://images.unsplash.com/photo-1445205170230-053b83016050?w=1200";

export const MEN_PRESET_CATEGORIES = [
  "Shirts",
  "T-Shirts",
  "Jackets",
  "Polo",
  "Jeans",
  "Sneakers",
  "Boots",
  "Accessories",
];

export const WOMEN_PRESET_CATEGORIES = [
  "Shirts",
  "T-Shirts",
  "Jackets",
  "Polo",
  "Dresses",
  "Jeans",
  "Skirts",
  "Accessories",
];

export const JUNIOR_GROUPS = ["Junior Boys", "Toddler Boys", "Junior Girls", "Toddler Girls"] as const;

export const JUNIOR_GROUP_IMAGES: Record<(typeof JUNIOR_GROUPS)[number], string> = {
  "Junior Boys": "https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=1200",
  "Toddler Boys": "https://images.unsplash.com/photo-1503919005314-30d93d07d823?w=1200",
  "Junior Girls": "https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=1200",
  "Toddler Girls": "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=1200",
};

export const JUNIORS_DEFAULT_SUBCATEGORIES = ["Hoodies", "Polo Shirts", "Joggers", "Slip Ons", "Caps"];

export const JUNIOR_SUBCATEGORIES: Record<string, string[]> = {
  "Junior Boys": JUNIORS_DEFAULT_SUBCATEGORIES,
  "Toddler Boys": JUNIORS_DEFAULT_SUBCATEGORIES,
  "Junior Girls": JUNIORS_DEFAULT_SUBCATEGORIES,
  "Toddler Girls": JUNIORS_DEFAULT_SUBCATEGORIES,
};
