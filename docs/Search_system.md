🧱 PART 1 — INTERNAL SEARCH (PostgreSQL UPGRADE)
1️⃣ Improve Full-Text Search (You Already Have → Optimize)
Use:
to_tsvector
to_tsquery / plainto_tsquery
Improve Ranking:

Use:

ts_rank()

👉 Boost fields:

title (high weight)
brand (medium)
category (medium)
2️⃣ Add Fuzzy Search (Spelling Correction)
Use Extension:

👉 pg_trgm (VERY IMPORTANT)

Setup:
CREATE EXTENSION pg_trgm;
Use Cases:
🔹 Similarity Search
SELECT * FROM products
WHERE similarity(title, 'jeons') > 0.3;

👉 YES — this fixes:

"jeons" → "jeans" ✅
🔹 ILIKE + Trigram
WHERE title ILIKE '%jeons%'
trigram index = fast fuzzy match
3️⃣ Autocomplete (Prefix Search)
Method:
WHERE title ILIKE 'men pol%'
Improve with index:
CREATE INDEX idx_title_trgm
ON products USING gin (title gin_trgm_ops);

👉 This enables:

fast prefix search
autocomplete suggestions
4️⃣ Faceting (FILTERS)
You must support filters like:
brand
category
price range
Query Example:
SELECT * FROM products
WHERE category = 'men_shirts'
AND brand = 'Outfitters'
AND price BETWEEN 2000 AND 5000;

👉 This is strong in PostgreSQL



## Meilisearch

Canonical index schema, env keys, and sync: **`Meilisearch.md`**.

2️⃣ Start Server

4️⃣ Initialize Client

5️⃣ Create Index

6️⃣ Define Searchable Fields

7️⃣ Define Filterable Fields (IMPORTANT)

8️⃣ Push Data to Meilisearch

9️⃣ Search Query Example
query: "black polo shirt"
filters: brand = Outfitters AND price < 5000





### **Critical Fix – Product Data, Filters & Meilisearch Integration**

---

### **1. Product Data Correction (Mandatory)**

* Replace generic subcategories:

  * ❌ Clothing → ✔ Shirt / Polo / T-Shirt / Jacket (based on actual product)
  * ❌ Shoes → ✔ Trainers / Sneakers / Pumps / etc.
  * ❌ Accessories → ✔ Cap / Belt / etc.
  * ETC.

* Ensure **every product has a precise subcategory** (no generic labels)

---

### **2. Gender Structure Fix**

* Remove **“Kids”** completely

* Replace with:

  * Toddler Boys
  * Toddler Girls
  * Junior Boys
  * Junior Girls

* Ensure filters and product data are fully aligned with this structure

---

### **3. Filters System (Critical – Must Be Accurate)**

#### **Core Requirement**

* Filters must only return **relevant and matching products**

---

#### **Filtering Logic**

* **Gender filter** → filters products correctly

* **Type filter (Top, Bottom, Footwear, Accessories)**:

  * Dynamically updates **subcategories**
  * Example:

    * Top → Shirts, Polo, T-Shirts, Jackets
    * ❌ Do NOT include unrelated items

* **Subcategory filter**:

  * Shows only relevant items based on selected type

* **Size filter**:

  * Dynamically updates based on selected subcategory

---

#### **Important**

* Filters must be:

  * Fully connected
  * Real-time updating
  * Context-aware
  * No irrelevant results

---

### **4. Search System (Meilisearch – Critical Setup)**

Ensure **Meilisearch is fully configured and working properly**:

---

### **A. Search Capabilities (Must Have)**

* ✔ Full-text search
* ✔ Typo tolerance (spelling correction)
* ✔ Autocomplete suggestions
* ✔ Faceted search (filters integration)

---

### **B. Define Searchable Fields (IMPORTANT)**

Include:

* Product title
* Description
* Subcategory
* Category/Type
* Brand name
* Tags

---

### **C. Define Filterable Fields (CRITICAL)**

Must include:

* Gender
* Type (Top, Bottom, etc.)
* Subcategory
* Size
* Brand
* Price (range filtering if needed)

---

### **D. Ranking & Relevance**

* Prioritize:

  * Exact matches
  * Title matches over description
  * Popular/relevant products

---

### **E. Search Accuracy Rules**

* Search must:

  * Return only **relevant products**
  * Avoid unrelated category matches
  * Match:

    * Title
    * Subcategory
    * Tags
    * Type

---

### **5. Integration Requirements**

* Connect search with:

  * Catalogue page
  * Filters system
* Filters must work on **search results as well**

---

### **Expected Outcome**

* Clean and accurate product dataset
* Fully functional and intelligent filters
* Fast, typo-tolerant, and relevant search
* No irrelevant or mismatched results
* Production-ready Meilisearch integration

---





