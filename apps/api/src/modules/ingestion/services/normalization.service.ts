import type { NormalizedProduct, NormalizedVariant, ParsedImportRecord } from "../ingestion.types.js";
import { createSlug, normalizePrice, normalizeText } from "../utils/ingestion.utils.js";

const colorKeys = ["color", "color_name", "clr", "shade", "colour"];
const TYPE_BY_PRODUCT_TYPE: Record<string, "Top" | "Bottom" | "Footwear" | "Accessories"> = {
  tees: "Top",
  "t-shirts": "Top",
  shirts: "Top",
  tops: "Top",
  jackets: "Top",
  hoodies: "Top",
  pants: "Bottom",
  trousers: "Bottom",
  jeans: "Bottom",
  skirts: "Bottom",
  shoes: "Footwear",
  footwear: "Footwear",
  sandals: "Footwear",
  sneakers: "Footwear",
  bags: "Accessories",
  belts: "Accessories",
  watches: "Accessories",
};

const KNOWN_SOURCE_KEYS = new Set(
  [
    "id",
    "title",
    "name",
    "body_html",
    "description",
    "vendor",
    "product_type",
    "type",
    "handle",
    "slug",
    "created_at",
    "updated_at",
    "published_at",
    "published_scope",
    "template_suffix",
    "tags",
    "options",
    "variants",
    "images",
    "image",
    "external_product_id",
    "external_source",
    "gender",
    "top_category",
    "subcategory",
    "sub_category",
    "category",
    "size",
    "sizes",
    "actual_price",
    "sale_price",
    "saleprice",
    "discount_price",
    "price",
    "compare_at_price",
    "stock",
    "quantity",
    "barcode",
    "season",
    "style",
    "size_guide",
    "sizeguide",
    "size_chart",
    "sizechart",
    "deliveries_returns",
    "delivery_returns",
    "shipping_delivery",
    "fabric_care",
    "fabric_composition",
    "composition",
    "care",
    "care_guide",
    "fit",
    "fit_type",
    "fitting",
    "fit_details",
    "model_details",
    "material_details",
    "origin",
    "package_includes",
    "disclaimer",
    "product_url",
    "url",
    "season",
    "collection",
    "label",
    "badge",
    "meta_title",
    "meta_description",
    "canonical_url",
    "og_image_url",
    "delivery_text",
    "shipping_fee",
    "return_window_days",
    "exchange_window_days",
  ].map((key) => normalizeKey(key)),
);

const SECTION_FIT = "fit";
const SECTION_FABRIC_CARE = "fabric_care";
const SECTION_DELIVERIES_RETURNS = "deliveries_returns";
const SECTION_SHIPPING_DELIVERY = "shipping_delivery";
const SECTION_SIZE_GUIDE = "size_guide";
const SECTION_OTHER = "other";

type HtmlSection = {
  headingRaw: string;
  headingType:
    | typeof SECTION_FIT
    | typeof SECTION_FABRIC_CARE
    | typeof SECTION_DELIVERIES_RETURNS
    | typeof SECTION_SHIPPING_DELIVERY
    | typeof SECTION_SIZE_GUIDE
    | typeof SECTION_OTHER;
  text: string;
};

function decodeHtmlEntities(value: string): string {
  const namedMap: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
  };

  return value
    .replace(/&#(\d+);/g, (_match, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&([a-zA-Z]+);/g, (match, named) => namedMap[named.toLowerCase()] ?? match);
}

function stripHtml(input: string): string {
  const withLineBreaks = input
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  return decodeHtmlEntities(withLineBreaks)
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function cleanText(value: unknown): string {
  const raw = normalizeText(value, "");
  if (!raw) return "";
  return stripHtml(raw);
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function titleCaseKey(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function classifyHeading(heading: string): HtmlSection["headingType"] {
  const normalized = normalizeKey(heading);

  if (normalized.startsWith("fit")) return SECTION_FIT;
  if (
    normalized.includes("fabric") ||
    normalized.includes("composition") ||
    (normalized.includes("care") && !normalized.includes("delivery"))
  ) {
    return SECTION_FABRIC_CARE;
  }
  if (normalized.includes("deliver") || normalized.includes("return") || normalized.includes("refund")) {
    return SECTION_DELIVERIES_RETURNS;
  }
  if (normalized.includes("shipping")) {
    return SECTION_SHIPPING_DELIVERY;
  }
  if (normalized.includes("size") && (normalized.includes("guide") || normalized.includes("chart") || normalized.includes("measurement"))) {
    return SECTION_SIZE_GUIDE;
  }
  return SECTION_OTHER;
}

function parseHtmlSections(bodyHtml: string): { preface: string; sections: HtmlSection[] } {
  const strongTagRegex = /<strong[^>]*>\s*([^<]{2,120})\s*<\/strong>/gi;
  const matches = [...bodyHtml.matchAll(strongTagRegex)];
  if (!matches.length) {
    return { preface: stripHtml(bodyHtml), sections: [] };
  }

  const firstHeadingIndex = matches[0]?.index ?? 0;
  const preface = stripHtml(bodyHtml.slice(0, firstHeadingIndex));
  const sections: HtmlSection[] = [];

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    if (!match) continue;
    const currentEnd = (match.index ?? 0) + match[0].length;
    const next = matches[index + 1];
    const nextStart = next?.index ?? bodyHtml.length;
    const sectionHtml = bodyHtml.slice(currentEnd, nextStart);
    const sectionText = stripHtml(sectionHtml);

    if (!sectionText) continue;

    const headingRaw = decodeHtmlEntities(match[1] || "").replace(/\s+/g, " ").trim();
    sections.push({
      headingRaw,
      headingType: classifyHeading(headingRaw),
      text: sectionText,
    });
  }

  return { preface, sections };
}

function resolveSource(record: ParsedImportRecord): Record<string, unknown> {
  const raw = record.raw;
  if (raw && typeof raw.product === "object" && raw.product) {
    return raw.product as Record<string, unknown>;
  }
  return raw;
}

function inferType(source: Record<string, unknown>): "Top" | "Bottom" | "Footwear" | "Accessories" {
  const productTypeRaw = normalizeText(source.product_type ?? source.type, "Top").toLowerCase();
  for (const [key, mapped] of Object.entries(TYPE_BY_PRODUCT_TYPE)) {
    if (productTypeRaw.includes(key)) return mapped;
  }
  return "Top";
}

function inferTopCategory(source: Record<string, unknown>): string {
  const direct = normalizeText(source.gender ?? source.top_category);
  if (direct) return direct;
  const vendor = normalizeText(source.vendor).toLowerCase();
  if (/\bwomen\b/.test(vendor)) return "Women";
  if (/\bmen\b/.test(vendor)) return "Men";
  if (/\bjunior\b|\bkid\b|\btoddler\b/.test(vendor)) return "Juniors";
  return "Women";
}

function inferGender(source: Record<string, unknown>, topCategory: string): string {
  const direct = normalizeText(source.gender);
  if (direct) return direct;
  if (topCategory === "Men") return "Men";
  if (topCategory === "Juniors") return "Juniors";
  return "Women";
}

function extractVariants(source: Record<string, unknown>) {
  if (!Array.isArray(source.variants)) return [];
  return source.variants.map((variant) => (variant ?? {}) as Record<string, unknown>);
}

function extractImages(source: Record<string, unknown>) {
  if (Array.isArray(source.images)) {
    return source.images.map((image) => (image ?? {}) as Record<string, unknown>);
  }

  if (source.image && typeof source.image === "object") {
    return [source.image as Record<string, unknown>];
  }

  if (typeof source.image === "string") {
    return [{ src: source.image }];
  }

  return [];
}

function uniq(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

function parseTextList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return uniq(value.map((entry) => cleanText(entry)).filter(Boolean));
  }
  if (typeof value === "string") {
    return uniq(
      cleanText(value)
        .split(/\n|;|\|/)
        .map((entry) => entry.trim())
        .filter(Boolean),
    );
  }
  return [];
}

function parseOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(String(value).replace(/[^\d.-]+/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseBooleanish(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "yes", "y", "1", "available"].includes(normalized)) return true;
  if (["false", "no", "n", "0", "unavailable"].includes(normalized)) return false;
  return undefined;
}

function getSourceLookup(source: Record<string, unknown>) {
  const lookup = new Map<string, unknown>();
  for (const [key, value] of Object.entries(source)) {
    lookup.set(normalizeKey(key), value);
  }
  return lookup;
}

function getField(source: Record<string, unknown>, lookup: Map<string, unknown>, aliases: string[]): unknown {
  for (const alias of aliases) {
    const normalized = normalizeKey(alias);
    if (normalized in source) {
      return source[normalized as keyof typeof source];
    }
    if (lookup.has(normalized)) {
      return lookup.get(normalized);
    }
  }
  return undefined;
}

function parseSizeGuide(
  source: Record<string, unknown>,
  lookup: Map<string, unknown>,
  sections: HtmlSection[],
): NormalizedProduct["sizeGuide"] {
  const direct = getField(source, lookup, [
    "sizeGuide",
    "size_guide",
    "sizeguide",
    "sizeChart",
    "size_chart",
    "measurements",
  ]);
  const imageCandidate = cleanText(
    getField(source, lookup, ["sizeGuideImage", "size_guide_image", "sizeChartImage", "size_chart_image"]),
  );

  const entries: Array<{ size: string; cm: string; inches: string }> = [];
  const details: string[] = [];
  let imageUrl = imageCandidate && /^https?:\/\//i.test(imageCandidate) ? imageCandidate : undefined;

  const ingestGuideData = (value: unknown) => {
    if (!value) return;

    if (Array.isArray(value)) {
      for (const item of value) {
        if (!item || typeof item !== "object") {
          const line = cleanText(item);
          if (line) details.push(line);
          continue;
        }

        const record = item as Record<string, unknown>;
        const size = cleanText(record.size ?? record.label ?? record.name);
        const cm = cleanText(record.cm ?? record.centimeters ?? record.centimetres);
        const inches = cleanText(record.inches ?? record.inch ?? record.in);

        if (size && (cm || inches)) {
          entries.push({ size, cm: cm || "-", inches: inches || "-" });
          continue;
        }

        const freeText = cleanText(record.value ?? record.description ?? record.text);
        if (freeText) details.push(freeText);
      }
      return;
    }

    if (typeof value === "object") {
      const record = value as Record<string, unknown>;
      const nestedEntries = record.entries ?? record.rows ?? record.table ?? record.measurements;
      if (nestedEntries) ingestGuideData(nestedEntries);

      const nestedImage = cleanText(record.imageUrl ?? record.image_url ?? record.image);
      if (!imageUrl && nestedImage && /^https?:\/\//i.test(nestedImage)) {
        imageUrl = nestedImage;
      }

      const nestedText = parseTextList(record.details ?? record.notes ?? record.description ?? record.text);
      details.push(...nestedText);
      return;
    }

    const text = cleanText(value);
    if (!text) return;
    if (!imageUrl && /^https?:\/\//i.test(text)) {
      imageUrl = text;
      return;
    }
    details.push(...parseTextList(text));
  };

  ingestGuideData(direct);

  for (const section of sections) {
    if (section.headingType !== SECTION_SIZE_GUIDE) continue;
    details.push(...parseTextList(section.text));
  }

  const normalizedEntries = entries.filter((entry) => entry.size && (entry.cm || entry.inches));
  const normalizedDetails = uniq(details);

  if (!imageUrl && !normalizedEntries.length && !normalizedDetails.length) {
    return undefined;
  }

  return {
    imageUrl,
    entries: normalizedEntries.length ? normalizedEntries : undefined,
    details: normalizedDetails.length ? normalizedDetails : undefined,
  };
}

function parseFabricCare(
  source: Record<string, unknown>,
  lookup: Map<string, unknown>,
  sections: HtmlSection[],
): NormalizedProduct["fabricCare"] {
  const direct = getField(source, lookup, [
    "fabricCare",
    "fabric_care",
    "composition",
    "composition_care",
    "care",
    "careInstructions",
    "care_instructions",
  ]);

  const lines: string[] = [];
  let fabricType = "";
  const careInstructions: string[] = [];

  const ingestFabric = (value: unknown) => {
    if (!value) return;

    if (typeof value === "object" && !Array.isArray(value)) {
      const record = value as Record<string, unknown>;
      fabricType = fabricType || cleanText(record.fabricType ?? record.fabric_type ?? record.composition ?? record.material);
      careInstructions.push(...parseTextList(record.careInstructions ?? record.care_instructions ?? record.instructions ?? record.care));
      lines.push(...parseTextList(record.details ?? record.description ?? record.text));
      return;
    }

    lines.push(...parseTextList(value));
  };

  ingestFabric(direct);

  for (const section of sections) {
    if (section.headingType !== SECTION_FABRIC_CARE) continue;
    lines.push(...parseTextList(section.text));
  }

  const mergedLines = uniq(lines);
  if (!fabricType && mergedLines.length) {
    fabricType = mergedLines[0] || "";
  }

  for (const line of mergedLines) {
    if (!line) continue;
    if (line === fabricType) continue;
    careInstructions.push(line);
  }

  const normalizedCare = uniq(careInstructions).filter(Boolean);
  if (!fabricType && !normalizedCare.length) {
    return undefined;
  }

  return {
    fabricType: fabricType || "Not specified",
    careInstructions: normalizedCare.length ? normalizedCare : ["Not specified"],
  };
}

function parseDeliveriesReturns(
  source: Record<string, unknown>,
  lookup: Map<string, unknown>,
  sections: HtmlSection[],
): NormalizedProduct["deliveriesReturns"] {
  const direct = getField(source, lookup, [
    "deliveriesReturns",
    "deliveries_returns",
    "delivery_returns",
    "returns",
    "return_policy",
    "refund_policy",
  ]);

  let deliveryTime = "";
  let returnPolicy = "";
  let refundConditions = "";
  const lines: string[] = [];

  if (direct && typeof direct === "object" && !Array.isArray(direct)) {
    const record = direct as Record<string, unknown>;
    deliveryTime = cleanText(record.deliveryTime ?? record.delivery_time);
    returnPolicy = cleanText(record.returnPolicy ?? record.return_policy);
    refundConditions = cleanText(record.refundConditions ?? record.refund_conditions ?? record.refundPolicy ?? record.refund_policy);
    lines.push(...parseTextList(record.details ?? record.description ?? record.text));
  } else {
    lines.push(...parseTextList(direct));
  }

  for (const section of sections) {
    if (section.headingType !== SECTION_DELIVERIES_RETURNS) continue;
    lines.push(...parseTextList(section.text));
  }

  const fallbackLines = uniq(lines);
  deliveryTime = deliveryTime || fallbackLines[0] || "";
  returnPolicy = returnPolicy || fallbackLines[1] || "";
  refundConditions = refundConditions || fallbackLines[2] || "";

  if (!deliveryTime && !returnPolicy && !refundConditions) {
    return undefined;
  }

  return {
    deliveryTime: deliveryTime || "As per brand policy",
    returnPolicy: returnPolicy || "As per brand policy",
    refundConditions: refundConditions || "As per brand policy",
  };
}

function parseShippingDelivery(
  source: Record<string, unknown>,
  lookup: Map<string, unknown>,
  sections: HtmlSection[],
): NormalizedProduct["shippingDelivery"] {
  const direct = getField(source, lookup, [
    "shippingDelivery",
    "shipping_delivery",
    "shipping",
    "shipping_policy",
  ]);

  let regions: string[] = [];
  let estimatedDeliveryTime = "";
  let charges = "";
  const lines: string[] = [];

  if (direct && typeof direct === "object" && !Array.isArray(direct)) {
    const record = direct as Record<string, unknown>;
    regions = parseTextList(record.regions ?? record.shipping_regions ?? record.region);
    estimatedDeliveryTime = cleanText(record.estimatedDeliveryTime ?? record.estimated_delivery_time ?? record.deliveryTime ?? record.delivery_time);
    charges = cleanText(record.charges ?? record.shipping_charges);
    lines.push(...parseTextList(record.details ?? record.description ?? record.text));
  } else {
    lines.push(...parseTextList(direct));
  }

  estimatedDeliveryTime =
    estimatedDeliveryTime ||
    cleanText(getField(source, lookup, ["estimated_delivery_time", "delivery_time", "shipping_eta"]));
  const regionField = getField(source, lookup, ["shipping_regions", "regions", "region"]);
  if (!regions.length) {
    regions = parseTextList(regionField);
  }
  charges = charges || cleanText(getField(source, lookup, ["shipping_charges", "charges"]));

  for (const section of sections) {
    if (section.headingType !== SECTION_SHIPPING_DELIVERY) continue;
    lines.push(...parseTextList(section.text));
  }

  const fallbackLines = uniq(lines);
  if (!estimatedDeliveryTime) {
    estimatedDeliveryTime = fallbackLines[0] || "";
  }
  if (!regions.length && fallbackLines[1]) {
    regions = parseTextList(fallbackLines[1]);
  }
  if (!charges && fallbackLines[2]) {
    charges = fallbackLines[2];
  }

  if (!estimatedDeliveryTime && !regions.length && !charges) {
    return undefined;
  }

  return {
    regions: regions.length ? regions : ["Pakistan"],
    estimatedDeliveryTime: estimatedDeliveryTime || "As per brand policy",
    charges: charges || undefined,
  };
}

function parseFit(
  source: Record<string, unknown>,
  lookup: Map<string, unknown>,
  sections: HtmlSection[],
): { fit?: string; descriptiveText?: string } {
  const direct = cleanText(getField(source, lookup, ["fit", "fit_type", "fitting", "fit_details"]));
  if (direct) {
    return { fit: direct };
  }

  for (const section of sections) {
    if (section.headingType !== SECTION_FIT) continue;
    const lines = parseTextList(section.text);
    if (!lines.length) continue;
    const [primary, ...rest] = lines;
    return {
      fit: primary,
      descriptiveText: rest.length ? rest.join(" ") : undefined,
    };
  }

  const bodyHtml = normalizeText(source.body_html);
  if (bodyHtml) {
    const plain = stripHtml(bodyHtml);
    const regexMatch = plain.match(/\bfit\s*:?\s*([^\n]+)/i);
    if (regexMatch?.[1]) {
      return { fit: regexMatch[1].trim() };
    }
  }

  return {};
}

function parseAdditionalInfo(
  source: Record<string, unknown>,
  sections: HtmlSection[],
): Array<{ label: string; value: string }> {
  const additional: Array<{ label: string; value: string }> = [];

  const pushAdditional = (label: string, value: unknown) => {
    const text = cleanText(value);
    if (!text) return;
    additional.push({ label: label.trim(), value: text });
  };

  for (const [key, value] of Object.entries(source)) {
    const normalized = normalizeKey(key);
    if (KNOWN_SOURCE_KEYS.has(normalized)) continue;

    if (value == null) continue;

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      pushAdditional(titleCaseKey(key), value);
      continue;
    }

    if (Array.isArray(value)) {
      const textValues = value
        .filter((item) => typeof item === "string" || typeof item === "number" || typeof item === "boolean")
        .map((item) => cleanText(item))
        .filter(Boolean);
      if (textValues.length) {
        pushAdditional(titleCaseKey(key), textValues.join(", "));
      }
    }
  }

  for (const section of sections) {
    if (section.headingType !== SECTION_OTHER) continue;
    pushAdditional(section.headingRaw, section.text);
  }

  return uniq(additional.map((entry) => `${entry.label}::${entry.value}`)).map((combined) => {
    const [label, ...rest] = combined.split("::");
    return { label, value: rest.join("::") };
  });
}

export function normalizeRecord(record: ParsedImportRecord): NormalizedProduct {
  const source = resolveSource(record);
  const lookup = getSourceLookup(source);
  const variantsInput = extractVariants(source);
  const imagesInput = extractImages(source);
  const name = normalizeText(source.title ?? source.name, "Untitled Product");
  const firstVariant = variantsInput[0] || {};

  const sourceColors = colorKeys.map((key) => cleanText(getField(source, lookup, [key]))).filter(Boolean);
  const variantColors = variantsInput.map((variant) => cleanText(variant.option1 ?? variant.color)).filter(Boolean);
  const imageAltColors = imagesInput.map((image) => cleanText(image.alt)).filter(Boolean);
  const colors = uniq([...sourceColors, ...variantColors, ...imageAltColors]);
  const primaryColor = colors[0] || "default";

  const type = inferType(source);
  const subCategory = normalizeText(source.subcategory ?? source.sub_category ?? source.category ?? source.product_type, "Uncategorized");
  const topCategory = inferTopCategory(source);

  const actualPrice = normalizePrice(
    source.actual_price ?? source.price ?? source.compare_at_price ?? firstVariant.compare_at_price ?? firstVariant.price,
    0,
  );
  const candidateSalePrice = normalizePrice(source.sale_price ?? source.salePrice ?? source.discount_price ?? firstVariant.price, actualPrice);
  const hasDiscount = actualPrice > 0 && candidateSalePrice > 0 && candidateSalePrice < actualPrice;
  const salePrice = hasDiscount ? candidateSalePrice : undefined;
  const pricePkr = salePrice ?? actualPrice;
  const discountPercentage = hasDiscount ? Math.max(0, Math.round(((actualPrice - candidateSalePrice) / actualPrice) * 100)) : undefined;

  const sizeList = Array.isArray(source.sizes)
    ? source.sizes.map((item) => cleanText(item)).filter(Boolean)
    : variantsInput.length
      ? uniq(variantsInput.map((variant) => cleanText(variant.option2 ?? variant.size)).filter(Boolean))
      : cleanText(source.size)
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);

  const tags = Array.isArray(source.tags)
    ? source.tags.map((item) => cleanText(item)).filter(Boolean)
    : normalizeText(source.tags)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

  const images = imagesInput.length
    ? imagesInput
        .map((image, index) => {
          const url = cleanText(image.src ?? image.url ?? image.image);
          if (!url) return null;
          return {
            sourceUrl: url,
            url,
            cdnUrl: cleanText(image.cdn_url ?? image.cdnUrl) || undefined,
            altText: cleanText(image.alt ?? image.alt_text) || name,
            imageType: index === 0 ? ("main" as const) : ("gallery" as const),
            isPrimary: index === 0,
            sortOrder: index,
          };
        })
        .filter(Boolean) as NormalizedProduct["images"]
    : (() => {
        const fallback = cleanText(source.image_url ?? source.image ?? (source.image as Record<string, unknown> | undefined)?.src);
        if (!fallback) return [];
        return [{ sourceUrl: fallback, url: fallback, altText: name, imageType: "main" as const, isPrimary: true, sortOrder: 0 }];
      })();

  const bodyHtml = normalizeText(source.body_html);
  const parsedBody = bodyHtml ? parseHtmlSections(bodyHtml) : { preface: "", sections: [] as HtmlSection[] };
  const fitResult = parseFit(source, lookup, parsedBody.sections);
  const fabricCare = parseFabricCare(source, lookup, parsedBody.sections);
  const deliveriesReturns = parseDeliveriesReturns(source, lookup, parsedBody.sections);
  const shippingDelivery = parseShippingDelivery(source, lookup, parsedBody.sections);
  const sizeGuide = parseSizeGuide(source, lookup, parsedBody.sections);
  const additionalInfo = parseAdditionalInfo(source, parsedBody.sections);
  const productUrl = cleanText(getField(source, lookup, ["product_url", "url", "source_url", "handle_url"]));
  const season = cleanText(getField(source, lookup, ["season"]));
  const collection = cleanText(getField(source, lookup, ["collection", "collection_name"]));
  const label = cleanText(getField(source, lookup, ["label", "badge"]));
  const shortDescription = cleanText(getField(source, lookup, ["short_description", "summary", "subtitle"]));
  const detail = {
    fabricComposition: cleanText(getField(source, lookup, ["fabric_composition", "composition", "material"])) || fabricCare?.fabricType,
    careGuide: cleanText(getField(source, lookup, ["care_guide", "care", "care_instructions"])) || fabricCare?.careInstructions?.join("\n"),
    fitDetails: cleanText(getField(source, lookup, ["fit_details", "fit", "fitting"])) || fitResult.fit,
    modelDetails: cleanText(getField(source, lookup, ["model_details", "model_info", "model_wearing"])),
    sizeGuideText: cleanText(getField(source, lookup, ["size_guide_text", "size_chart_text"])) || sizeGuide?.details?.join("\n"),
    sizeGuideImageUrl: sizeGuide?.imageUrl,
    shippingDelivery: cleanText(getField(source, lookup, ["shipping_delivery_text", "delivery_text"])) || shippingDelivery?.estimatedDeliveryTime,
    returnExchangePolicy:
      cleanText(getField(source, lookup, ["return_exchange_policy", "return_policy", "exchange_policy"])) ||
      [deliveriesReturns?.returnPolicy, deliveriesReturns?.refundConditions].filter(Boolean).join("\n"),
    disclaimer: cleanText(getField(source, lookup, ["disclaimer", "note", "warning"])),
    materialDetails: cleanText(getField(source, lookup, ["material_details", "material"])),
    origin: cleanText(getField(source, lookup, ["origin", "made_in", "country_of_origin"])),
    packageIncludes: cleanText(getField(source, lookup, ["package_includes", "includes", "package_content"])),
  };
  const structuredShipping = {
    estimatedDeliveryMinDays: parseOptionalNumber(getField(source, lookup, ["estimated_delivery_min_days", "delivery_min_days"])),
    estimatedDeliveryMaxDays: parseOptionalNumber(getField(source, lookup, ["estimated_delivery_max_days", "delivery_max_days"])),
    deliveryText: cleanText(getField(source, lookup, ["delivery_text", "shipping_delivery", "estimated_delivery_time"])) || shippingDelivery?.estimatedDeliveryTime,
    shippingFee: parseOptionalNumber(getField(source, lookup, ["shipping_fee", "shipping_charges"])),
    freeShippingAvailable: parseBooleanish(getField(source, lookup, ["free_shipping_available", "free_shipping"])),
    codAvailable: parseBooleanish(getField(source, lookup, ["cod_available", "cash_on_delivery"])),
    returnAvailable: parseBooleanish(getField(source, lookup, ["return_available", "returns_available"])),
    exchangeAvailable: parseBooleanish(getField(source, lookup, ["exchange_available", "exchanges_available"])),
    returnWindowDays: parseOptionalNumber(getField(source, lookup, ["return_window_days", "return_days"])),
    exchangeWindowDays: parseOptionalNumber(getField(source, lookup, ["exchange_window_days", "exchange_days"])),
  };
  const seo = {
    metaTitle: cleanText(getField(source, lookup, ["meta_title", "seo_title"])) || name,
    metaDescription: cleanText(getField(source, lookup, ["meta_description", "seo_description"])) || shortDescription || undefined,
    canonicalUrl: cleanText(getField(source, lookup, ["canonical_url"])) || productUrl || undefined,
    ogImageUrl: cleanText(getField(source, lookup, ["og_image_url", "og_image"])) || undefined,
  };

  const rawDescription = cleanText(source.description);
  const descriptionCandidate = uniq([
    rawDescription,
    parsedBody.preface,
    fitResult.descriptiveText || "",
  ])
    .filter(Boolean)
    .join("\n\n")
    .trim();
  const description = descriptionCandidate || "No description available";

  const fallbackSkuBase = createSlug(name).toUpperCase();
  const variants = (variantsInput.length
    ? variantsInput
    : (sizeList.length ? sizeList : ["ONE SIZE"]).map((size, index) => ({
        sku: `${fallbackSkuBase}-${String(size).replace(/\s+/g, "-").toUpperCase()}-${index}`,
        option2: size,
        inventory_quantity: source.stock ?? source.quantity,
      }))) as Array<Record<string, unknown>>;

  const normalizedVariants = variants.map((variant, index) => {
    const sku = cleanText(variant.sku) || `${fallbackSkuBase}-${index}`;
    const quantity = normalizePrice(variant.inventory_quantity ?? variant.stock_quantity ?? source.stock ?? source.quantity, 0);
    const compareAtPrice = normalizePrice(variant.compare_at_price ?? variant.price, pricePkr);
    const variantSalePrice = normalizePrice(variant.price, salePrice ?? pricePkr);
    const stockStatus: NormalizedVariant["stockStatus"] = quantity <= 0 ? "out_of_stock" : quantity <= 5 ? "low_stock" : "in_stock";
    return {
      externalVariantId: cleanText(variant.external_variant_id ?? variant.id) || undefined,
      sku,
      barcode: cleanText(variant.barcode) || undefined,
      color: cleanText(variant.option1 ?? variant.color) || primaryColor,
      colorHex: cleanText(variant.color_hex ?? variant.hex) || undefined,
      size: cleanText(variant.option2 ?? variant.size) || undefined,
      fit: cleanText(variant.fit ?? fitResult.fit) || undefined,
      season: cleanText(variant.option3 ?? variant.season ?? source.season) || undefined,
      style: cleanText(variant.style ?? source.style) || undefined,
      pricePkr: compareAtPrice,
      salePricePkr: variantSalePrice < compareAtPrice ? variantSalePrice : undefined,
      compareAtPricePkr: compareAtPrice,
      stockStatus,
      lowStockThreshold: parseOptionalNumber(variant.low_stock_threshold) ?? 5,
      weight: parseOptionalNumber(variant.weight),
      quantity,
    };
  });

  const totalStock =
    normalizedVariants.reduce((sum, variant) => sum + (variant.quantity ?? 0), 0) || normalizePrice(source.stock ?? source.quantity, 0);

  const attributes: Array<{ key: string; value: string }> = [
    { key: "source_type", value: normalizeText(source.source_type, "ingested") },
    { key: "normalized_subcategory", value: subCategory },
    { key: "available_colors", value: colors.join(", ") || primaryColor },
  ];

  if (fitResult.fit) {
    attributes.push({ key: "fit", value: fitResult.fit });
  }

  for (const info of additionalInfo) {
    attributes.push({
      key: `extra_${normalizeKey(info.label)}`,
      value: info.value,
    });
  }

  const imageUrl = images[0]?.url || cleanText((source.image as Record<string, unknown> | undefined)?.src) || "";

  return {
    externalProductId: normalizeText(source.external_product_id ?? record.externalId) || undefined,
    externalSource: normalizeText(source.external_source, source.vendor ? "shopify" : "manual"),
    name,
    slug: createSlug(normalizeText(source.handle ?? source.slug, name)),
    shortDescription: shortDescription || undefined,
    description,
    gender: inferGender(source, topCategory),
    color: primaryColor,
    colors: colors.length ? colors : undefined,
    fit: fitResult.fit,
    season: season || undefined,
    collection: collection || undefined,
    productUrl: productUrl || undefined,
    visibility: "hidden",
    source: normalizeText(source.source_type, "json_import"),
    type,
    topCategory,
    subCategory,
    actualPrice,
    salePrice,
    discountPercentage,
    pricePkr,
    currency: "PKR",
    label: label || undefined,
    sizes: sizeList.length ? sizeList : ["ONE SIZE"],
    tags,
    imageUrl,
    sizeGuide,
    deliveriesReturns,
    shippingDelivery,
    fabricCare,
    additionalInfo: additionalInfo.length ? additionalInfo : undefined,
    detail,
    shipping: structuredShipping,
    seo,
    stock: totalStock,
    metadata: {
      raw: record.raw,
      colors,
      fit: fitResult.fit,
      additionalInfo,
      season,
      collection,
      productUrl,
      search: {
        normalizedTitle: name.toLowerCase(),
        colorFilters: colors.map((item) => item.toLowerCase()),
        sizeFilters: sizeList,
        styleTags: tags,
        seasonTags: season ? [season] : [],
      },
    },
    attributes,
    variants: normalizedVariants,
    images,
  };
}
