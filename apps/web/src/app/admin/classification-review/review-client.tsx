'use client';

import { useState, useEffect } from 'react';
import type { ClassificationReview, TaxonomyEnums } from '@/types/taxonomy';
import { formatEnumForDisplay } from '@/types/taxonomy';

export function ClassificationReviewClient() {
  const [products, setProducts] = useState<ClassificationReview[]>([]);
  const [enums, setEnums] = useState<TaxonomyEnums | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<ClassificationReview | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<{
    gender: string;
    category: string;
    subcategory: string | null;
    reviewNote: string;
  }>({
    gender: '',
    category: '',
    subcategory: null,
    reviewNote: '',
  });

  const limit = 20;

  useEffect(() => {
    loadProducts();
    loadEnums();
  }, [page]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/products/taxonomy/classification-review?page=${page}&limit=${limit}`,
        {
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        }
      );
      const data = await response.json();

      if (data.success) {
        setProducts(data.data.products);
        setTotal(data.data.pagination.total);
      }
    } catch (error) {
      console.error('Failed to load products:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEnums = async () => {
    try {
      const response = await fetch('/api/products/taxonomy/enums');
      const data = await response.json();
      if (data.success) {
        setEnums(data.data);
      }
    } catch (error) {
      console.error('Failed to load enums:', error);
    }
  };

  const handleAction = async (
    productId: string,
    action: 'approve' | 'edit' | 'reject'
  ) => {
    try {
      const body: any = { action };

      if (action === 'edit') {
        body.gender = editData.gender;
        body.category = editData.category;
        body.subcategory = editData.subcategory || undefined;
        body.reviewNote = editData.reviewNote;
      } else if (action === 'reject') {
        body.reviewNote = editData.reviewNote;
      }

      const response = await fetch(
        `/api/products/taxonomy/classification-review/${productId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        }
      );

      const data = await response.json();

      if (data.success) {
        setSelectedProduct(null);
        setEditMode(false);
        loadProducts();
      } else {
        alert(data.message || 'Action failed');
      }
    } catch (error) {
      console.error('Action failed:', error);
      alert('Action failed');
    }
  };

  const openEditDialog = (product: ClassificationReview) => {
    setSelectedProduct(product);
    setEditMode(true);
    setEditData({
      gender: product.classification.gender,
      category: product.classification.category,
      subcategory: product.classification.subcategory,
      reviewNote: '',
    });
  };

  const totalPages = Math.ceil(total / limit);

  if (loading && products.length === 0) {
    return <div className="text-center py-12">Loading...</div>;
  }

  if (!loading && products.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-lg text-gray-600">
          No products need review! All classifications are confident.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Products Grid */}
      <div className="grid grid-cols-1 gap-6 mb-8">
        {products.map(product => (
          <div
            key={product.id}
            className="border rounded-lg p-6 hover:shadow-lg transition"
          >
            <div className="flex gap-6">
              {/* Product Image */}
              <div className="w-32 h-32 flex-shrink-0">
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-full object-cover rounded"
                />
              </div>

              {/* Product Info */}
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-2">{product.name}</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Brand: {product.brand.name}
                </p>

                {/* Classification */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase mb-1">
                      Suggested Classification
                    </p>
                    <div className="space-y-1 text-sm">
                      <p>
                        <span className="font-medium">Gender:</span>{' '}
                        {product.formattedClassification.gender}
                      </p>
                      <p>
                        <span className="font-medium">Department:</span>{' '}
                        {product.formattedClassification.department}
                      </p>
                      <p>
                        <span className="font-medium">Category:</span>{' '}
                        {product.formattedClassification.category}
                      </p>
                      {product.formattedClassification.subcategory && (
                        <p>
                          <span className="font-medium">Subcategory:</span>{' '}
                          {product.formattedClassification.subcategory}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 uppercase mb-1">
                      Brand Original
                    </p>
                    <div className="space-y-1 text-sm">
                      {product.brandCategoryRaw && (
                        <p>
                          <span className="font-medium">Category:</span>{' '}
                          {product.brandCategoryRaw}
                        </p>
                      )}
                      {product.brandSubcategoryRaw && (
                        <p>
                          <span className="font-medium">Subcategory:</span>{' '}
                          {product.brandSubcategoryRaw}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Confidence Score */}
                <div className="mb-4">
                  <p className="text-xs text-gray-500 uppercase mb-1">
                    Confidence Score
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-yellow-500 h-2 rounded-full"
                        style={{
                          width: `${(product.classification.confidence || 0) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium">
                      {((product.classification.confidence || 0) * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => handleAction(product.id, 'approve')}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => openEditDialog(product)}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                  >
                    Edit & Approve
                  </button>
                  <button
                    onClick={() => {
                      setSelectedProduct(product);
                      setEditMode(false);
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex justify-center items-center gap-4">
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          className="px-4 py-2 border rounded disabled:opacity-50"
        >
          Previous
        </button>
        <span className="text-sm">
          Page {page} of {totalPages} ({total} total)
        </span>
        <button
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
          className="px-4 py-2 border rounded disabled:opacity-50"
        >
          Next
        </button>
      </div>

      {/* Edit Dialog */}
      {selectedProduct && editMode && enums && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">
              Edit Classification: {selectedProduct.name}
            </h2>

            <div className="space-y-4">
              {/* Gender */}
              <div>
                <label className="block text-sm font-medium mb-2">Gender</label>
                <select
                  value={editData.gender}
                  onChange={e => setEditData({ ...editData, gender: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                >
                  {enums.genders.map(g => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium mb-2">Category</label>
                <select
                  value={editData.category}
                  onChange={e => setEditData({ ...editData, category: e.target.value, subcategory: null })}
                  className="w-full border rounded px-3 py-2"
                >
                  {enums.categories.map(c => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subcategory */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Subcategory (Optional)
                </label>
                <select
                  value={editData.subcategory || ''}
                  onChange={e =>
                    setEditData({ ...editData, subcategory: e.target.value || null })
                  }
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">None</option>
                  {enums.subcategories
                    .filter(s => {
                      // Filter subcategories by selected category
                      return true; // TODO: implement category filtering
                    })
                    .map(s => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                </select>
              </div>

              {/* Review Note */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Review Note
                </label>
                <textarea
                  value={editData.reviewNote}
                  onChange={e => setEditData({ ...editData, reviewNote: e.target.value })}
                  placeholder="Optional note about the classification"
                  className="w-full border rounded px-3 py-2"
                  rows={3}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setSelectedProduct(null);
                    setEditMode(false);
                  }}
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleAction(selectedProduct.id, 'edit')}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Save & Approve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Dialog */}
      {selectedProduct && !editMode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">
              Reject Classification
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to reject the classification for{' '}
              <strong>{selectedProduct.name}</strong>?
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Rejection Reason
              </label>
              <textarea
                value={editData.reviewNote}
                onChange={e => setEditData({ ...editData, reviewNote: e.target.value })}
                placeholder="Explain why this classification is incorrect"
                className="w-full border rounded px-3 py-2"
                rows={4}
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setSelectedProduct(null)}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAction(selectedProduct.id, 'reject')}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
