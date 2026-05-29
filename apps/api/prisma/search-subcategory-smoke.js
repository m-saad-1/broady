const API_BASE = process.env.API_BASE || "http://localhost:4000/api";

async function run() {
  const suggestRes = await fetch(`${API_BASE}/products/suggest?q=jack`);
  if (!suggestRes.ok) {
    throw new Error("Expected /products/suggest to be available");
  }

  const suggestJson = await suggestRes.json();
  if (!Array.isArray(suggestJson.data)) {
    throw new Error("Invalid suggest response");
  }

  const shortRes = await fetch(`${API_BASE}/products?q=ja`);
  const shortJson = await shortRes.json();
  if (!Array.isArray(shortJson.data)) {
    throw new Error("Invalid response for short query");
  }
  if (shortJson.data.length !== 0) {
    throw new Error("Expected no products for query length < 3");
  }

  const longQuery = "women jackets";
  const longRes = await fetch(`${API_BASE}/products?q=${encodeURIComponent(longQuery)}`);
  const longJson = await longRes.json();
  if (!Array.isArray(longJson.data)) {
    throw new Error("Invalid response for long query");
  }

  const tokens = longQuery.split(/\s+/).map((t) => t.toLowerCase());
  const validLong = longJson.data.every((p) => {
    const haystack = [
      p.name,
      p.description,
      p.subCategory,
      p.topCategory,
      p.gender,
      p.color,
      ...(Array.isArray(p.tags) ? p.tags : []),
      ...(Array.isArray(p.sizes) ? p.sizes : []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return tokens.every((token) => haystack.includes(token));
  });
  if (!validLong) {
    throw new Error("Expected long query results to strictly match query tokens");
  }

  console.log("api search smoke: PASS");
}

run().catch((error) => {
  console.error("api search smoke: FAIL", error.message);
  process.exit(1);
});
