import { Router } from "express";
import { requireAdmin, requireAuth } from "../../middleware/auth.js";
import {
  createProduct,
  deleteProduct,
  getProductById,
  getProductBySlug,
  listProducts,
  updateProduct,
} from "./product.service.js";
import { productBaseSchema } from "./product.validation.js";

const router = Router();

function getParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

router.post("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const product = await createProduct(req.body, req.auth!.brandId as string);
    res.status(201).json({ data: product });
  } catch (error) {
    next(error);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const products = await listProducts(req.query);
    res.json({ data: products });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const idOrSlug = getParamValue(req.params.id);
    if (!idOrSlug) {
      return res.status(400).json({ message: "Product id or slug is required" });
    }

    let product = await getProductById(idOrSlug);
    if (!product) {
      product = await getProductBySlug(idOrSlug);
    }

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json({ data: product });
  } catch (error) {
    next(error);
  }
});

router.put("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const productId = getParamValue(req.params.id);
    if (!productId) {
      return res.status(400).json({ message: "Product id is required" });
    }

    const product = await updateProduct(productId, req.body);
    res.json({ data: product });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const productId = getParamValue(req.params.id);
    if (!productId) {
      return res.status(400).json({ message: "Product id is required" });
    }

    await deleteProduct(productId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
