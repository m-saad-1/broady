
### **Critical Fix – Product Form, Filters, and Search System (End-to-End)**

---

### **1. Product Adding Form (Admin + Brand) – Update Required**

Add and fully support these fields in both Admin and Brand dashboards:

* **Color**
* **Type** (Top, Bottom, Footwear, Accessories)
* **Actual Price**
* **Sale Price**

  * Auto-calculated via **discount percentage input**

---

### **Optional Fields (Can Be Skipped)**

* Size Guide Library
* Deliveries & Returns
* Fabric & Care

These should:

* Exist in backend schema
* Be optional in UI

---

### **2. Backend Data Structure (Important)**

* All above fields must be:

  * Properly stored in DB
  * Available for filtering and search

* Even if some fields (like **Type**) are not shown on product cards:

  * They MUST exist in backend
  * Used in filters and search logic

---

### **3. Product Card Display Rule**

* Keep UI clean:

  * Do NOT display Type
  * Show only current visible fields

* But internally:

  * Type must drive filtering/search behavior

---

### **4. Filters System (CRITICAL – Must Be Perfect)**

#### **Core Requirement**

* Filters must return **ONLY relevant products**
* No leakage of unrelated items

---

#### **Filtering Logic**

**Example:**

* If user selects:

  * Gender = Women
  * Type = Top

Then:

* Subcategories must update to:

  * Shirts
  * Blouses
  * Jackets
  * etc.
* ❌ Do NOT show Bottom or unrelated items

---

#### **Strict Rules**

* Filters must be:

  * Fully wired with backend fields
  * Context-aware (Gender → Type → Subcategory → Size)
  * Real-time updating
  * Accurate with zero mismatch

---

### **5. Search System (CRITICAL – Meilisearch Must Be Fully Functional)**

---

### **Search Behavior Requirements**

#### **A. Accuracy**

* Search must return **only matching products**

Examples:

* “Jeans” → Only jeans (all genders if not specified)
* “Men Jackets” → Only men’s jackets
* ❌ No unrelated products

---

#### **B. Smart Matching**

Search should match against:

* Title
* Description
* Type
* Subcategory
* Category
* Gender
* Tags

---

#### **C. Typo Tolerance**

* Example:

  * “jakets” → Jackets
  * “shrit” → Shirt

---

#### **D. Autocomplete**

* Example:

  * “jacke” → Jackets suggestions

---

#### **E. Faceted Search**

* Filters must work on:

  * Search results
  * Catalogue page

---

### **6. Meilisearch Configuration (Must Be Properly Defined)**

#### **Searchable Fields**

* title
* description
* type
* subcategory
* gender
* brand
* tags

---

#### **Filterable Fields (CRITICAL)**

* gender
* type
* subcategory
* size
* brand
* price

---

#### **Ranking Priority**

1. Exact match (title)
2. Subcategory/type match
3. Description match
4. Popular/relevant products

---

### **7. Related Products (Product Details Page)**

* Must be **strictly relevant**

Example:

* If product = Skirt

  * Show only skirts (or very closely related items)
  * ❌ Do NOT show unrelated categories

---

### **8. System Integrity Requirement**

* Deeply integrate:

  * Product form → Backend → Filters → Search → UI

* Ensure:

  * No broken mapping
  * No inconsistent data
  * No irrelevant rendering

---

### **Expected Outcome**

* Fully structured product system
* Accurate and strict filtering
* Intelligent, typo-tolerant, and relevant search
* Clean UI with strong backend logic
* Production-level reliability across catalogue and product flows

---


## Critical Fix
* Fix the entire filter logic so it works in a fully connected and consistent flow. When a user selects Juniors, all junior products should display. If the user then selects a junior group (Junior Boys, Junior Girls, Toddler Boys, Toddler Girls), the results should narrow accordingly. After that, selecting a Type (e.g., Bottom) must filter only relevant junior bottom items, and selecting a Subcategory (e.g., Jeans) should further refine results to only junior bottom jeans. Every filter must stack correctly and progressively narrow results without showing unrelated products. Additionally, when the user switches from Juniors to Men (or Women), all junior-specific filters must reset automatically, and the system should display the correct products for the newly selected gender while keeping the filtering logic clean and consistent.
* When User Select from gender, I-e men, it provide accurate products, When switch to other gender, it dont update products and give 0 products at real time, but it give products when page refreshed, So please when switching from one gender to another, or in other filters, it should update products in real time without refreshing the page.