const API_BASE = process.env.API_BASE || "http://localhost:4000/api";

async function run() {
  const shortRes = await fetch(`${API_BASE}/products?q=ja`);
  const shortJson = await shortRes.json();
  if (!Array.isArray(shortJson.data)) {
    throw new Error("Invalid response for short query");
  }
  if (shortJson.data.length !== 0) {
    throw new Error("Expected no products for query length < 3");
  }

  const longRes = await fetch(`${API_BASE}/products?q=jack`);
  const longJson = await longRes.json();
  if (!Array.isArray(longJson.data)) {
    throw new Error("Invalid response for long query");
  }

  const validLong = longJson.data.every(
    (p) =>
      p.subCategory?.toLowerCase().includes("jack") ||
      p.name?.toLowerCase().includes("jack"),
  );
  if (!validLong) {
    throw new Error("Expected long query results to include matching products");
  }

  console.log("api search smoke: PASS");
}

run().catch((error) => {
  console.error("api search smoke: FAIL", error.message);
  process.exit(1);
});
