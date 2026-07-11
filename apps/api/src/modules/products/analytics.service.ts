import { prisma } from '../../config/prisma.js';
import { ProductCategory, ProductSubcategory } from '@prisma/client';

export async function incrementProductViewAnalytics(category: ProductCategory, subcategory: ProductSubcategory | null) {
  try {
    // Increment Category views
    await prisma.categoryAnalytics.upsert({
      where: { category },
      update: { views: { increment: 1 } },
      create: { category, views: 1 },
    });

    // Increment Subcategory views if exists
    if (subcategory) {
      await prisma.subcategoryAnalytics.upsert({
        where: { subcategory },
        update: { views: { increment: 1 } },
        create: { category, subcategory, views: 1 },
      });
    }
  } catch (error) {
    console.error('[Analytics] Failed to increment product view', error);
  }
}

export async function incrementProductPurchaseAnalytics(
  category: ProductCategory,
  subcategory: ProductSubcategory | null,
  revenuePkr: number
) {
  try {
    // Increment Category purchases
    const catData = await prisma.categoryAnalytics.upsert({
      where: { category },
      update: { 
        purchases: { increment: 1 },
        revenuePkr: { increment: revenuePkr }
      },
      create: { 
        category, 
        purchases: 1,
        revenuePkr: revenuePkr 
      },
    });
    
    // Update conversion rate for Category (assume conversionRate = (purchases / views) * 100)
    const catViews = Math.max(catData.views, 1);
    await prisma.categoryAnalytics.update({
      where: { category },
      data: { conversionRate: (catData.purchases / catViews) * 100 }
    });

    // Increment Subcategory purchases if exists
    if (subcategory) {
      const subcatData = await prisma.subcategoryAnalytics.upsert({
        where: { subcategory },
        update: { 
          purchases: { increment: 1 },
          revenuePkr: { increment: revenuePkr }
        },
        create: { 
          category, 
          subcategory, 
          purchases: 1,
          revenuePkr: revenuePkr 
        },
      });
      
      const subcatViews = Math.max(subcatData.views, 1);
      await prisma.subcategoryAnalytics.update({
        where: { subcategory },
        data: { conversionRate: (subcatData.purchases / subcatViews) * 100 }
      });
    }
  } catch (error) {
    console.error('[Analytics] Failed to increment product purchase', error);
  }
}
