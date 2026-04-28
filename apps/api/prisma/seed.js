import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const fabricProfiles = [
  "100% Cotton Jersey",
  "Cotton-Poly Twill",
  "Premium Vegan Leather",
  "Stretch Denim Blend",
  "Linen-Cotton Blend",
  "Brushed Fleece",
  "Breathable Knit Mesh",
  "Satin Viscose Blend",
  "Wool-Blend Melton",
  "Recycled Nylon",
];

const careVariants = [
  ["Machine wash cold", "Do not bleach", "Tumble dry low", "Warm iron if needed"],
  ["Hand wash recommended", "Wash with like colors", "Line dry in shade", "Do not wring"],
  ["Spot clean only", "Keep away from direct heat", "Store in dust bag", "Use leather conditioner monthly"],
  ["Gentle cycle wash", "Turn inside out before wash", "Do not tumble dry", "Iron on reverse side"],
  ["Dry clean preferred", "Steam to remove wrinkles", "Do not bleach", "Store on broad hanger"],
];

const shippingRegions = [
  ["Karachi", "Lahore", "Islamabad", "Rawalpindi"],
  ["Faisalabad", "Multan", "Peshawar", "Hyderabad"],
  ["Gujranwala", "Sialkot", "Quetta", "Sukkur"],
  ["Abbottabad", "Sargodha", "Bahawalpur", "Mardan"],
  ["Nationwide", "Northern Areas", "South Punjab", "Balochistan"],
];

function buildSizeGuide(sizes, index) {
  const normalized = index % 25;
  const baseCm = 58 + normalized * 2;
  return {
    imageUrl: `https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=1000&sig=size${index}`,
    entries: sizes.map((size, sizeIndex) => {
      const cm = baseCm + sizeIndex * 4;
      return {
        size,
        cm: `${cm}-${cm + 3}`,
        inches: `${(cm / 2.54).toFixed(1)}-${((cm + 3) / 2.54).toFixed(1)}`,
      };
    }),
  };
}

function buildDeliveriesReturns(index) {
  const dispatchWindow = 24 + (index % 4) * 12;
  const returnDays = 7 + (index % 4) * 2;
  const pickupDays = 2 + (index % 3);

  return {
    deliveryTime: `Dispatch in ${dispatchWindow}-${dispatchWindow + 12} hours. Delivery in ${2 + (index % 4)}-${4 + (index % 4)} business days.`,
    returnPolicy: `Returns accepted within ${returnDays} days for unused items with original tags and invoice.`,
    refundConditions: `Refund processed in ${pickupDays}-${pickupDays + 3} business days after quality check and warehouse receipt.`,
  };
}

function buildShippingDelivery(index) {
  const regionSet = shippingRegions[index % shippingRegions.length];
  const charge = 180 + (index % 5) * 40;

  return {
    regions: regionSet,
    estimatedDeliveryTime: `${2 + (index % 3)}-${5 + (index % 3)} business days`,
    charges: charge === 180 ? "Free above PKR 4,999, otherwise PKR 180" : `Free above PKR 6,999, otherwise PKR ${charge}`,
  };
}

function buildFabricCare(index) {
  return {
    fabricType: fabricProfiles[index % fabricProfiles.length],
    careInstructions: careVariants[index % careVariants.length],
  };
}

function stableIndexFromSlug(slug) {
  let hash = 0;
  for (let i = 0; i < slug.length; i += 1) {
    hash = (hash * 31 + slug.charCodeAt(i)) % 100000;
  }
  return hash;
}

async function main() {
  const brands = [
    {
      name: "Outfitters",
      slug: "outfitters",
      logoUrl: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800",
      description: "Contemporary western streetwear with clean tailoring and urban utility pieces.",
      commissionRate: 12,
      contactEmail: "ops+outfitters@broady.local",
      whatsappNumber: "+923000000111",
    },
    {
      name: "Breakout",
      slug: "breakout",
      logoUrl: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800",
      description: "Modern casualwear balancing denim heritage, essentials, and bold seasonal statements.",
      commissionRate: 10,
      contactEmail: "ops+breakout@broady.local",
      whatsappNumber: "+923000000222",
    },
    {
      name: "Cougar",
      slug: "cougar",
      logoUrl: "https://images.unsplash.com/photo-1445205170230-053b83016050?w=800",
      description: "Refined outerwear, footwear, and premium textures for elevated everyday dressing.",
      commissionRate: 14,
      contactEmail: "ops+cougar@broady.local",
      whatsappNumber: "+923000000333",
    },
  ];

  for (const brand of brands) {
    await prisma.brand.upsert({
      where: { slug: brand.slug },
      update: {},
      create: brand,
    });
  }

  const outfitters = await prisma.brand.findUniqueOrThrow({ where: { slug: "outfitters" } });
  const breakout = await prisma.brand.findUniqueOrThrow({ where: { slug: "breakout" } });
  const cougar = await prisma.brand.findUniqueOrThrow({ where: { slug: "cougar" } });

  const products = [
    {
      name: "Structured Overshirt",
      slug: "structured-overshirt",
      description: "Crisp silhouette overshirt with premium cotton weave.",
      topCategory: "Men",
      subCategory: "Clothing",
      sizes: ["S", "M", "L", "XL"],
      pricePkr: 6990,
      imageUrl: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1400",
      stock: 18,
      brandId: outfitters.id,
    },
    {
      name: "Relaxed Utility Pants",
      slug: "relaxed-utility-pants",
      description: "Tapered utility pants with clean pockets and matte finish.",
      topCategory: "Men",
      subCategory: "Clothing",
      sizes: ["30", "32", "34", "36"],
      pricePkr: 5890,
      imageUrl: "https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=1400",
      stock: 21,
      brandId: outfitters.id,
    },
    {
      name: "Leather Court Sneakers",
      slug: "leather-court-sneakers",
      description: "Minimal low-top silhouette crafted for all-day comfort.",
      topCategory: "Men",
      subCategory: "Footwear",
      sizes: ["40", "41", "42", "43", "44"],
      pricePkr: 9490,
      imageUrl: "https://images.unsplash.com/photo-1515955656352-a1fa3ffcd111?w=1400",
      stock: 16,
      brandId: cougar.id,
    },
    {
      name: "Matte Buckle Belt",
      slug: "matte-buckle-belt",
      description: "Clean leather belt with understated monochrome buckle.",
      topCategory: "Men",
      subCategory: "Accessories",
      sizes: ["S", "M", "L"],
      pricePkr: 2990,
      imageUrl: "https://images.unsplash.com/photo-1611923134239-b9be5816f5af?w=1400",
      stock: 35,
      brandId: breakout.id,
    },
    {
      name: "Straight Fit Denim",
      slug: "straight-fit-denim",
      description: "High-rise, deep indigo denim with clean finishing.",
      topCategory: "Women",
      subCategory: "Clothing",
      sizes: ["28", "30", "32", "34"],
      pricePkr: 4990,
      imageUrl: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=1400",
      stock: 22,
      brandId: breakout.id,
    },
    {
      name: "Cropped Poplin Shirt",
      slug: "cropped-poplin-shirt",
      description: "Tailored poplin shirt with sharp hemline and crisp collar.",
      topCategory: "Women",
      subCategory: "Clothing",
      sizes: ["XS", "S", "M", "L"],
      pricePkr: 4590,
      imageUrl: "https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?w=1400",
      stock: 30,
      brandId: outfitters.id,
    },
    {
      name: "Minimal Wool Coat",
      slug: "minimal-wool-coat",
      description: "Tailored longline coat designed for metropolitan layering.",
      topCategory: "Women",
      subCategory: "Clothing",
      sizes: ["S", "M", "L"],
      pricePkr: 12490,
      imageUrl: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=1400",
      stock: 11,
      brandId: cougar.id,
    },
    {
      name: "Urban Chelsea Boots",
      slug: "urban-chelsea-boots",
      description: "Polished boots with sculpted sole and sleek elastic panel.",
      topCategory: "Women",
      subCategory: "Footwear",
      sizes: ["37", "38", "39", "40"],
      pricePkr: 10990,
      imageUrl: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=1400",
      stock: 13,
      brandId: cougar.id,
    },
    {
      name: "Crossbody Utility Bag",
      slug: "crossbody-utility-bag",
      description: "Compact structured bag in matte leather-inspired finish.",
      topCategory: "Women",
      subCategory: "Accessories",
      sizes: ["One Size"],
      pricePkr: 6790,
      imageUrl: "https://images.unsplash.com/photo-1591561954555-607968c989ab?w=1400",
      stock: 26,
      brandId: breakout.id,
    },
    {
      name: "Kids Graphic Hoodie",
      slug: "kids-graphic-hoodie",
      description: "Soft brushed-fleece hoodie with bold front print.",
      topCategory: "Kids",
      subCategory: "Clothing",
      sizes: ["4Y", "6Y", "8Y", "10Y"],
      pricePkr: 3290,
      imageUrl: "https://images.unsplash.com/photo-1503944583220-79d8926ad5e2?w=1400",
      stock: 41,
      brandId: outfitters.id,
    },
    {
      name: "Kids Cargo Joggers",
      slug: "kids-cargo-joggers",
      description: "Elastic-waist joggers with utility pockets and soft stretch.",
      topCategory: "Kids",
      subCategory: "Clothing",
      sizes: ["4Y", "6Y", "8Y", "10Y"],
      pricePkr: 2790,
      imageUrl: "https://images.unsplash.com/photo-1519238363430-6d56c844d0a5?w=1400",
      stock: 38,
      brandId: breakout.id,
    },
    {
      name: "Kids Slip-On Sneakers",
      slug: "kids-slip-on-sneakers",
      description: "Breathable knit upper with cushioned anti-slip sole.",
      topCategory: "Kids",
      subCategory: "Footwear",
      sizes: ["28", "30", "32", "34"],
      pricePkr: 3590,
      imageUrl: "https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=1400",
      stock: 29,
      brandId: cougar.id,
    },
    {
      name: "Kids Everyday Cap",
      slug: "kids-everyday-cap",
      description: "Adjustable structured cap in durable cotton twill.",
      topCategory: "Kids",
      subCategory: "Accessories",
      sizes: ["One Size"],
      pricePkr: 1490,
      imageUrl: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=1400",
      stock: 60,
      brandId: outfitters.id,
    },
    {
      name: "Textured Knit Polo",
      slug: "textured-knit-polo",
      description: "Monochrome knit polo with elevated drape and trim collar.",
      topCategory: "Men",
      subCategory: "Clothing",
      sizes: ["S", "M", "L", "XL"],
      pricePkr: 5190,
      imageUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=1400",
      stock: 19,
      brandId: breakout.id,
    },
    {
      name: "Panel Runner Shoes",
      slug: "panel-runner-shoes",
      description: "Dynamic runner profile in mixed monochrome textures.",
      topCategory: "Men",
      subCategory: "Footwear",
      sizes: ["40", "41", "42", "43"],
      pricePkr: 8890,
      imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1400",
      stock: 20,
      brandId: cougar.id,
    },
    {
      name: "Satin Midi Dress",
      slug: "satin-midi-dress",
      description: "Fluid satin dress with minimalist silhouette and clean seams.",
      topCategory: "Women",
      subCategory: "Clothing",
      sizes: ["XS", "S", "M", "L"],
      pricePkr: 7590,
      imageUrl: "https://images.unsplash.com/photo-1495385794356-15371f348c31?w=1400",
      stock: 17,
      brandId: outfitters.id,
    },
    {
      name: "Women Chunky Sneakers",
      slug: "women-chunky-sneakers",
      description: "Statement sole and breathable lining for daily styling.",
      topCategory: "Women",
      subCategory: "Footwear",
      sizes: ["37", "38", "39", "40"],
      pricePkr: 9390,
      imageUrl: "https://images.unsplash.com/photo-1608256246200-53e635b5b65f?w=1400",
      stock: 15,
      brandId: cougar.id,
    },
    {
      name: "Women Layered Necklace",
      slug: "women-layered-necklace",
      description: "Polished minimal accessory designed for evening transitions.",
      topCategory: "Women",
      subCategory: "Accessories",
      sizes: ["One Size"],
      pricePkr: 2390,
      imageUrl: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=1400",
      stock: 48,
      brandId: breakout.id,
    },
    {
      name: "Kids Retro Trainers",
      slug: "kids-retro-trainers",
      description: "Lightweight trainers inspired by retro track silhouettes.",
      topCategory: "Kids",
      subCategory: "Footwear",
      sizes: ["28", "30", "32", "34"],
      pricePkr: 3890,
      imageUrl: "https://images.unsplash.com/photo-1600185365926-3a2ce3cdb9eb?w=1400",
      stock: 33,
      brandId: cougar.id,
    },
    {
      name: "Classic Black Chinos",
      slug: "classic-black-chinos",
      description: "Premium cotton chinos with modern taper and clean finish.",
      topCategory: "Men",
      subCategory: "Bottom",
      sizes: ["30", "32", "34", "36"],
      pricePkr: 4290,
      imageUrl: "https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=1400",
      stock: 25,
      brandId: breakout.id,
    },
    {
      name: "White Slim Trousers",
      slug: "white-slim-trousers",
      description: "Tailored slim-fit trousers in crisp white cotton.",
      topCategory: "Men",
      subCategory: "Bottom",
      sizes: ["30", "32", "34", "36"],
      pricePkr: 4890,
      imageUrl: "https://images.unsplash.com/photo-1506629905607-45f4ba5cfe0f?w=1400",
      stock: 18,
      brandId: cougar.id,
    },
    {
      name: "Slate Grey Joggers",
      slug: "slate-grey-joggers",
      description: "Comfortable joggers in premium knit fabric.",
      topCategory: "Men",
      subCategory: "Bottom",
      sizes: ["S", "M", "L", "XL"],
      pricePkr: 3590,
      imageUrl: "https://images.unsplash.com/photo-1519238363430-6d56c844d0a5?w=1400",
      stock: 28,
      brandId: outfitters.id,
    },
    {
      name: "High Top Leather Boots",
      slug: "high-top-leather-boots",
      description: "Durable leather boots with reinforced lacing system.",
      topCategory: "Men",
      subCategory: "Footwear",
      sizes: ["40", "41", "42", "43", "44", "45"],
      pricePkr: 11990,
      imageUrl: "https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=1400",
      stock: 12,
      brandId: cougar.id,
    },
    {
      name: "Desert Canvas Loafers",
      slug: "desert-canvas-loafers",
      description: "Lightweight loafers in breathable canvas with crepe sole.",
      topCategory: "Men",
      subCategory: "Footwear",
      sizes: ["40", "41", "42", "43", "44"],
      pricePkr: 7490,
      imageUrl: "https://images.unsplash.com/photo-1533487449915-ab7de9b3049b?w=1400",
      stock: 22,
      brandId: breakout.id,
    },
    {
      name: "Monochrome Track Pants",
      slug: "monochrome-track-pants",
      description: "Elevated track pants in premium fleece-lined jersey.",
      topCategory: "Men",
      subCategory: "Bottom",
      sizes: ["S", "M", "L", "XL"],
      pricePkr: 5490,
      imageUrl: "https://images.unsplash.com/photo-1539533057440-7bf4e9251f79?w=1400",
      stock: 24,
      brandId: outfitters.id,
    },
    {
      name: "Wide Leg Linen Trousers",
      slug: "wide-leg-linen-trousers",
      description: "Breezy linen trousers with wide relaxed silhouette.",
      topCategory: "Women",
      subCategory: "Bottom",
      sizes: ["26", "28", "30", "32"],
      pricePkr: 5190,
      imageUrl: "https://images.unsplash.com/photo-1542272604-787c3835535d?w=1400",
      stock: 19,
      brandId: outfitters.id,
    },
    {
      name: "Black Leather Leggings",
      slug: "black-leather-leggings",
      description: "Sleek faux-leather leggings with high-waist fit.",
      topCategory: "Women",
      subCategory: "Bottom",
      sizes: ["XS", "S", "M", "L"],
      pricePkr: 3990,
      imageUrl: "https://images.unsplash.com/photo-1506629082632-42a63f45dc31?w=1400",
      stock: 32,
      brandId: breakout.id,
    },
    {
      name: "Midi Pleated Skirt",
      slug: "midi-pleated-skirt",
      description: "Sophisticated pleated skirt in premium fabric blend.",
      topCategory: "Women",
      subCategory: "Bottom",
      sizes: ["XS", "S", "M", "L"],
      pricePkr: 6290,
      imageUrl: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1400",
      stock: 16,
      brandId: cougar.id,
    },
    {
      name: "Premium Ankle Sneakers",
      slug: "premium-ankle-sneakers",
      description: "Classic low-profile sneakers with cushioned insole.",
      topCategory: "Women",
      subCategory: "Footwear",
      sizes: ["37", "38", "39", "40", "41"],
      pricePkr: 8890,
      imageUrl: "https://images.unsplash.com/photo-1552346154-21d32810aba3?w=1400",
      stock: 27,
      brandId: breakout.id,
    },
    {
      name: "Strappy Heeled Sandals",
      slug: "strappy-heeled-sandals",
      description: "Elegant sandals with sculptured heel and leather straps.",
      topCategory: "Women",
      subCategory: "Footwear",
      sizes: ["37", "38", "39", "40"],
      pricePkr: 7690,
      imageUrl: "https://images.unsplash.com/photo-1514989940723-e8e51635b782?w=1400",
      stock: 14,
      brandId: cougar.id,
    },
    {
      name: "Relaxed Fit Cropped Jeans",
      slug: "relaxed-fit-cropped-jeans",
      description: "Vintage-inspired cropped denim with distressed details.",
      topCategory: "Women",
      subCategory: "Bottom",
      sizes: ["26", "28", "30", "32"],
      pricePkr: 4790,
      imageUrl: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1400",
      stock: 21,
      brandId: outfitters.id,
    },
    {
      name: "Women Leather Loafers",
      slug: "women-leather-loafers",
      description: "Sophisticated leather loafers for everyday elegance.",
      topCategory: "Women",
      subCategory: "Footwear",
      sizes: ["37", "38", "39", "40", "41"],
      pricePkr: 8490,
      imageUrl: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=1400",
      stock: 18,
      brandId: cougar.id,
    },
    {
      name: "Kids Straight Leg Jeans",
      slug: "kids-straight-leg-jeans",
      description: "Durable jeans designed for growing kids with soft denim.",
      topCategory: "Kids",
      subCategory: "Clothing",
      sizes: ["4Y", "6Y", "8Y", "10Y", "12Y"],
      pricePkr: 2290,
      imageUrl: "https://images.unsplash.com/photo-1542272604-787c3835535d?w=1400",
      stock: 44,
      brandId: breakout.id,
    },
    {
      name: "Kids Colorblock Shorts",
      slug: "kids-colorblock-shorts",
      description: "Fun colorblock shorts in breathable cotton blend.",
      topCategory: "Kids",
      subCategory: "Clothing",
      sizes: ["4Y", "6Y", "8Y", "10Y", "12Y"],
      pricePkr: 1890,
      imageUrl: "https://images.unsplash.com/photo-1519238363430-6d56c844d0a5?w=1400",
      stock: 51,
      brandId: outfitters.id,
    },
    {
      name: "Kids High-Top Canvas",
      slug: "kids-high-top-canvas",
      description: "Classic high-top sneakers in sturdy canvas material.",
      topCategory: "Kids",
      subCategory: "Footwear",
      sizes: ["28", "30", "32", "34", "36"],
      pricePkr: 3190,
      imageUrl: "https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=1400",
      stock: 39,
      brandId: cougar.id,
    },
    {
      name: "Kids Sandal with Strap",
      slug: "kids-sandal-with-strap",
      description: "Comfortable sandals with secure strapping for active play.",
      topCategory: "Kids",
      subCategory: "Footwear",
      sizes: ["28", "30", "32", "34", "36"],
      pricePkr: 2490,
      imageUrl: "https://images.unsplash.com/photo-1544526122-92e8f3711ba5?w=1400",
      stock: 47,
      brandId: breakout.id,
    },
    {
      name: "Kids Knit Beanie",
      slug: "kids-knit-beanie",
      description: "Cozy knit beanie perfect for cool weather adventures.",
      topCategory: "Kids",
      subCategory: "Accessories",
      sizes: ["One Size"],
      pricePkr: 1290,
      imageUrl: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=1400",
      stock: 68,
      brandId: cougar.id,
    },
    {
      name: "Kids Colorful Socks Set",
      slug: "kids-colorful-socks-set",
      description: "Three-pack of colorful socks in soft cotton blend.",
      topCategory: "Kids",
      subCategory: "Accessories",
      sizes: ["One Size"],
      pricePkr: 890,
      imageUrl: "https://images.unsplash.com/photo-1516762689617-e1cffcef479d?w=1400",
      stock: 85,
      brandId: outfitters.id,
    },
    {
      name: "Kids Backpack",
      slug: "kids-backpack",
      description: "Durable backpack with multiple compartments for school.",
      topCategory: "Kids",
      subCategory: "Accessories",
      sizes: ["One Size"],
      pricePkr: 2590,
      imageUrl: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=1400",
      stock: 34,
      brandId: breakout.id,
    },
    {
      name: "Breakout Contrast Denim Jacket",
      slug: "breakout-contrast-denim-jacket",
      description: "Structured denim jacket with contrast stitching and utility pockets.",
      topCategory: "Men",
      subCategory: "Clothing",
      sizes: ["S", "M", "L", "XL"],
      pricePkr: 7990,
      imageUrl: "https://images.unsplash.com/photo-1516257984-b1b4d707412e?auto=format&fit=crop&w=1400&q=80",
      stock: 20,
      brandId: breakout.id,
    },
    {
      name: "Breakout Essential Zip Hoodie",
      slug: "breakout-essential-zip-hoodie",
      description: "Midweight fleece hoodie designed for everyday layering.",
      topCategory: "Men",
      subCategory: "Clothing",
      sizes: ["S", "M", "L", "XL"],
      pricePkr: 5290,
      imageUrl: "https://images.unsplash.com/photo-1578587018452-892bacefd3f2?auto=format&fit=crop&w=1400&q=80",
      stock: 29,
      brandId: breakout.id,
    },
    {
      name: "Breakout Washed Cargo Trousers",
      slug: "breakout-washed-cargo-trousers",
      description: "Relaxed cargo trousers with garment-washed finish and tapered ankle.",
      topCategory: "Men",
      subCategory: "Bottom",
      sizes: ["30", "32", "34", "36"],
      pricePkr: 6190,
      imageUrl: "https://images.unsplash.com/photo-1506629082955-511b1aa562c8?auto=format&fit=crop&w=1400&q=80",
      stock: 24,
      brandId: breakout.id,
    },
    {
      name: "Breakout Women Ribbed Knit Set",
      slug: "breakout-women-ribbed-knit-set",
      description: "Soft ribbed co-ord set with a clean premium silhouette.",
      topCategory: "Women",
      subCategory: "Clothing",
      sizes: ["XS", "S", "M", "L"],
      pricePkr: 6890,
      imageUrl: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1400&q=80",
      stock: 18,
      brandId: breakout.id,
    },
    {
      name: "Breakout Platform Street Sneakers",
      slug: "breakout-platform-street-sneakers",
      description: "Chunky platform sneakers with breathable mesh lining.",
      topCategory: "Women",
      subCategory: "Footwear",
      sizes: ["37", "38", "39", "40", "41"],
      pricePkr: 9590,
      imageUrl: "https://images.unsplash.com/photo-1560769629-975ec94e6a86?auto=format&fit=crop&w=1400&q=80",
      stock: 16,
      brandId: breakout.id,
    },
    {
      name: "Breakout Kids Printed Puffer",
      slug: "breakout-kids-printed-puffer",
      description: "Lightweight insulated puffer jacket with seasonal print accents.",
      topCategory: "Kids",
      subCategory: "Clothing",
      sizes: ["4Y", "6Y", "8Y", "10Y", "12Y"],
      pricePkr: 4790,
      imageUrl: "https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=1400&q=80",
      stock: 27,
      brandId: breakout.id,
    },
    {
      name: "Cougar Heritage Leather Derby",
      slug: "cougar-heritage-leather-derby",
      description: "Polished derby shoes crafted with supple full-grain leather.",
      topCategory: "Men",
      subCategory: "Footwear",
      sizes: ["40", "41", "42", "43", "44", "45"],
      pricePkr: 12490,
      imageUrl: "https://images.unsplash.com/photo-1531310197839-ccf54634509e?auto=format&fit=crop&w=1400&q=80",
      stock: 14,
      brandId: cougar.id,
    },
    {
      name: "Cougar Quilted Bomber Jacket",
      slug: "cougar-quilted-bomber-jacket",
      description: "Insulated bomber with matte shell and ribbed trims.",
      topCategory: "Men",
      subCategory: "Clothing",
      sizes: ["S", "M", "L", "XL"],
      pricePkr: 10990,
      imageUrl: "https://images.unsplash.com/photo-1588361861040-ac9b1018f6d5?auto=format&fit=crop&w=1400&q=80",
      stock: 13,
      brandId: cougar.id,
    },
    {
      name: "Cougar Tailored Wool Trousers",
      slug: "cougar-tailored-wool-trousers",
      description: "Refined tapered trousers in a breathable wool-blend weave.",
      topCategory: "Men",
      subCategory: "Bottom",
      sizes: ["30", "32", "34", "36"],
      pricePkr: 7390,
      imageUrl: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=1400&q=80",
      stock: 21,
      brandId: cougar.id,
    },
    {
      name: "Cougar Women Trench Coat",
      slug: "cougar-women-trench-coat",
      description: "Classic longline trench with storm flap and belt tie.",
      topCategory: "Women",
      subCategory: "Clothing",
      sizes: ["XS", "S", "M", "L"],
      pricePkr: 12990,
      imageUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1400&q=80",
      stock: 10,
      brandId: cougar.id,
    },
    {
      name: "Cougar Women Suede Ankle Boots",
      slug: "cougar-women-suede-ankle-boots",
      description: "Soft suede ankle boots with side zip and stacked heel.",
      topCategory: "Women",
      subCategory: "Footwear",
      sizes: ["37", "38", "39", "40"],
      pricePkr: 11590,
      imageUrl: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=1400&q=80",
      stock: 12,
      brandId: cougar.id,
    },
    {
      name: "Cougar Kids Trail Runner",
      slug: "cougar-kids-trail-runner",
      description: "Grip-focused trail runner shoes for active weekend play.",
      topCategory: "Kids",
      subCategory: "Footwear",
      sizes: ["28", "30", "32", "34", "36"],
      pricePkr: 4190,
      imageUrl: "https://images.unsplash.com/photo-1515347619252-60a4bf4fff4f?auto=format&fit=crop&w=1400&q=80",
      stock: 31,
      brandId: cougar.id,
    },
  ];

  for (const [index, product] of products.entries()) {
    const content = {
      sizeGuide: buildSizeGuide(product.sizes, index),
      deliveriesReturns: buildDeliveriesReturns(index),
      shippingDelivery: buildShippingDelivery(index),
      fabricCare: buildFabricCare(index),
    };

    await prisma.product.upsert({
      where: { slug: product.slug },
      update: {
        ...product,
        ...content,
      },
      create: {
        ...product,
        ...content,
      },
    });
  }

  const allProducts = await prisma.product.findMany({
    select: {
      id: true,
      slug: true,
      sizes: true,
    },
  });

  for (const product of allProducts) {
    const index = stableIndexFromSlug(product.slug);
    await prisma.product.update({
      where: { id: product.id },
      data: {
        sizeGuide: buildSizeGuide(product.sizes, index),
        deliveriesReturns: buildDeliveriesReturns(index),
        shippingDelivery: buildShippingDelivery(index),
        fabricCare: buildFabricCare(index),
      },
    });
  }

  const brandUsers = [
    {
      email: "brand.outfitters@broady.local",
      fullName: "Outfitters Team",
      password: "BrandUser123!",
      brandId: outfitters.id,
    },
    {
      email: "brand.breakout@broady.local",
      fullName: "Breakout Team",
      password: "BrandUser123!",
      brandId: breakout.id,
    },
    {
      email: "brand.cougar@broady.local",
      fullName: "Cougar Team",
      password: "BrandUser123!",
      brandId: cougar.id,
    },
  ];

  for (const account of brandUsers) {
    const hashed = await bcrypt.hash(account.password, 12);
    const user = await prisma.user.upsert({
      where: { email: account.email },
      update: {
        fullName: account.fullName,
        role: "BRAND",
        password: hashed,
      },
      create: {
        email: account.email,
        fullName: account.fullName,
        role: "BRAND",
        password: hashed,
        authProvider: "LOCAL",
      },
    });

    await prisma.brandMember.upsert({
      where: {
        userId_brandId: {
          userId: user.id,
          brandId: account.brandId,
        },
      },
      update: { canManageProducts: true },
      create: {
        userId: user.id,
        brandId: account.brandId,
        canManageProducts: true,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
