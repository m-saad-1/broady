/**
 * Admin Classification Review Page
 * Review and approve products with low classification confidence (< 0.7)
 */

import { Metadata } from 'next';
import { ClassificationReviewClient } from './review-client';

export const metadata: Metadata = {
  title: 'Product Classification Review | Admin',
  description: 'Review and approve product classifications',
};

export default function ClassificationReviewPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Product Classification Review</h1>
        <p className="text-gray-600 mt-2">
          Review products with low confidence scores and approve or correct their classifications
        </p>
      </div>

      <ClassificationReviewClient />
    </div>
  );
}
