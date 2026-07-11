'use client';

import { useState, useEffect } from 'react';
import type { ProductFilters, AvailableFilters } from '@/types/taxonomy';
import { formatEnumForDisplay, getSubcategoryLabel } from '@/types/taxonomy';

interface CatalogFiltersProps {
  filters: ProductFilters;
  onFiltersChange: (filters: ProductFilters) => void;
  availableFilters?: AvailableFilters;
  isLoading?: boolean;
}

export function CatalogFilters({
  filters,
  onFiltersChange,
  availableFilters,
  isLoading = false,
}: CatalogFiltersProps) {
  const [priceRange, setPriceRange] = useState<[number, number]>([
    filters.minPrice || 0,
    filters.maxPrice || 20000,
  ]);

  useEffect(() => {
    if (availableFilters?.priceRange) {
      setPriceRange([
        filters.minPrice || availableFilters.priceRange.min,
        filters.maxPrice || availableFilters.priceRange.max,
      ]);
    }
  }, [availableFilters, filters.minPrice, filters.maxPrice]);

  const updateFilter = (key: keyof ProductFilters, value: any) => {
    onFiltersChange({ ...filters, [key]: value, page: 1 });
  };

  const toggleArrayFilter = (key: keyof ProductFilters, value: string) => {
    const current = (filters[key] as string[]) || [];
    const updated = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    updateFilter(key, updated.length > 0 ? updated : undefined);
  };

  const clearFilters = () => {
    onFiltersChange({});
  };

  const hasActiveFilters = Object.keys(filters).some(
    key => key !== 'page' && key !== 'limit' && key !== 'sortBy'
  );

  // Show subcategory filter only when category is selected
  const showSubcategoryFilter =
    filters.category && filters.category.length > 0 && (availableFilters?.availableSubcategories?.length || 0) > 0;

  const subcategoryLabel = filters.category?.[0]
    ? getSubcategoryLabel(filters.category[0])
    : 'Type';

  return (
    <div className="w-full lg:w-64 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Filters</h2>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Clear all
          </button>
        )}
      </div>

      {isLoading && (
        <div className="text-sm text-gray-500">Updating filters...</div>
      )}

      {/* Gender Filter */}
      {availableFilters && availableFilters.availableGenders.length > 0 && (
        <FilterSection title="Gender">
          {availableFilters.availableGenders.map(option => (
            <FilterCheckbox
              key={option.value}
              label={option.label}
              count={option.count}
              checked={(filters.gender || []).includes(option.value)}
              onChange={() => toggleArrayFilter('gender', option.value)}
              disabled={isLoading}
            />
          ))}
        </FilterSection>
      )}

      {/* Department Filter */}
      {availableFilters && availableFilters.availableDepartments.length > 0 && (
        <FilterSection title="Department">
          {availableFilters.availableDepartments.map(option => (
            <FilterCheckbox
              key={option.value}
              label={option.label}
              count={option.count}
              checked={(filters.department || []).includes(option.value)}
              onChange={() => toggleArrayFilter('department', option.value)}
              disabled={isLoading}
            />
          ))}
        </FilterSection>
      )}

      {/* Category Filter */}
      {availableFilters && availableFilters.availableCategories.length > 0 && (
        <FilterSection title="Category">
          <div className="max-h-60 overflow-y-auto">
            {availableFilters.availableCategories.map(option => (
              <FilterCheckbox
                key={option.value}
                label={option.label}
                count={option.count}
                checked={(filters.category || []).includes(option.value)}
                onChange={() => toggleArrayFilter('category', option.value)}
                disabled={isLoading}
              />
            ))}
          </div>
        </FilterSection>
      )}

      {showSubcategoryFilter && (
        <FilterSection title={subcategoryLabel}>
          <div className="max-h-60 overflow-y-auto">
            {(availableFilters?.availableSubcategories || []).map(option => (
              <FilterCheckbox
                key={option.value}
                label={option.label}
                count={option.count}
                checked={(filters.subcategory || []).includes(option.value)}
                onChange={() => toggleArrayFilter('subcategory', option.value)}
                disabled={isLoading}
              />
            ))}
          </div>
        </FilterSection>
      )}

      {/* Brand Filter */}
      {availableFilters && availableFilters.availableBrands.length > 0 && (
        <FilterSection title="Brand">
          <div className="max-h-60 overflow-y-auto">
            {availableFilters.availableBrands.map(brand => (
              <FilterCheckbox
                key={brand.id}
                label={brand.name}
                count={brand.count}
                checked={(filters.brandId || []).includes(brand.id)}
                onChange={() => toggleArrayFilter('brandId', brand.id)}
                disabled={isLoading}
              />
            ))}
          </div>
        </FilterSection>
      )}

      {/* Size Filter */}
      {availableFilters && availableFilters.availableSizes.length > 0 && (
        <FilterSection title="Size">
          <div className="flex flex-wrap gap-2">
            {availableFilters.availableSizes.map(size => (
              <button
                key={size.value}
                onClick={() => toggleArrayFilter('sizes', size.value)}
                disabled={isLoading}
                className={`px-3 py-1.5 text-sm border rounded transition ${
                  (filters.sizes || []).includes(size.value)
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {size.value}
                <span className="ml-1 text-xs opacity-70">({size.count})</span>
              </button>
            ))}
          </div>
        </FilterSection>
      )}

      {/* Color Filter */}
      {availableFilters && availableFilters.availableColors.length > 0 && (
        <FilterSection title="Color">
          <div className="max-h-60 overflow-y-auto">
            {availableFilters.availableColors.map(color => (
              <FilterCheckbox
                key={color.value}
                label={color.value}
                count={color.count}
                checked={(filters.colors || []).includes(color.value)}
                onChange={() => toggleArrayFilter('colors', color.value)}
                disabled={isLoading}
              />
            ))}
          </div>
        </FilterSection>
      )}

      {/* Fit Filter */}
      {availableFilters && availableFilters.availableFits && availableFilters.availableFits.length > 0 && (
        <FilterSection title="Fit">
          <div className="max-h-60 overflow-y-auto">
            {availableFilters.availableFits.map(fit => (
              <FilterCheckbox
                key={fit.value}
                label={fit.value}
                count={fit.count}
                checked={(filters.fit || []).includes(fit.value)}
                onChange={() => toggleArrayFilter('fit', fit.value)}
                disabled={isLoading}
              />
            ))}
          </div>
        </FilterSection>
      )}

      {/* Material Filter */}
      {availableFilters && availableFilters.availableMaterials && availableFilters.availableMaterials.length > 0 && (
        <FilterSection title="Material">
          <div className="max-h-60 overflow-y-auto">
            {availableFilters.availableMaterials.map(material => (
              <FilterCheckbox
                key={material.value}
                label={material.value}
                count={material.count}
                checked={(filters.material || []).includes(material.value)}
                onChange={() => toggleArrayFilter('material', material.value)}
                disabled={isLoading}
              />
            ))}
          </div>
        </FilterSection>
      )}

      {/* Price Range Filter */}
      {availableFilters && availableFilters.priceRange && (
        <FilterSection title="Price Range">
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span>PKR {priceRange[0]}</span>
              <span>PKR {priceRange[1]}</span>
            </div>
            <input
              type="range"
              min={availableFilters.priceRange.min}
              max={availableFilters.priceRange.max}
              value={priceRange[1]}
              onChange={e => {
                const newMax = parseInt(e.target.value, 10);
                setPriceRange([priceRange[0], newMax]);
              }}
              onMouseUp={() => {
                updateFilter('minPrice', priceRange[0]);
                updateFilter('maxPrice', priceRange[1]);
              }}
              disabled={isLoading}
              className="w-full"
            />
            <div className="flex gap-2">
              <input
                type="number"
                value={priceRange[0]}
                onChange={e => setPriceRange([parseInt(e.target.value, 10), priceRange[1]])}
                onBlur={() => {
                  updateFilter('minPrice', priceRange[0]);
                  updateFilter('maxPrice', priceRange[1]);
                }}
                placeholder="Min"
                disabled={isLoading}
                className="w-full px-2 py-1 text-sm border rounded"
              />
              <input
                type="number"
                value={priceRange[1]}
                onChange={e => setPriceRange([priceRange[0], parseInt(e.target.value, 10)])}
                onBlur={() => {
                  updateFilter('minPrice', priceRange[0]);
                  updateFilter('maxPrice', priceRange[1]);
                }}
                placeholder="Max"
                disabled={isLoading}
                className="w-full px-2 py-1 text-sm border rounded"
              />
            </div>
          </div>
        </FilterSection>
      )}

      {/* Discount Filter */}
      <FilterSection title="Discount">
        <div className="space-y-2">
          {[
            { label: 'Any Discount', value: 1 },
            { label: '20% or more', value: 20 },
            { label: '50% or more', value: 50 },
            { label: '70% or more', value: 70 },
          ].map(option => (
            <label key={option.value} className="flex items-center space-x-2 cursor-pointer group">
              <input
                type="radio"
                name="discount"
                checked={filters.minDiscount === option.value}
                onChange={() => updateFilter('minDiscount', option.value)}
                disabled={isLoading}
                className="text-black focus:ring-black border-gray-300 disabled:opacity-50"
              />
              <span className="text-sm text-gray-700 group-hover:text-black">
                {option.label}
              </span>
            </label>
          ))}
          {filters.minDiscount && (
            <button
              onClick={() => updateFilter('minDiscount', undefined)}
              className="text-xs text-gray-500 hover:text-black mt-2 inline-block"
              disabled={isLoading}
            >
              Clear discount filter
            </button>
          )}
        </div>
      </FilterSection>

      {/* Availability Filter */}
      <FilterSection title="Availability">
        <FilterCheckbox
          label="In Stock"
          checked={
            (filters.availabilityStatus || []).includes('IN_STOCK')
          }
          onChange={() => toggleArrayFilter('availabilityStatus', 'IN_STOCK')}
          disabled={isLoading}
        />
        <FilterCheckbox
          label="Low Stock"
          checked={
            (filters.availabilityStatus || []).includes('LOW_STOCK')
          }
          onChange={() => toggleArrayFilter('availabilityStatus', 'LOW_STOCK')}
          disabled={isLoading}
        />
      </FilterSection>

      {/* Featured Products */}
      <FilterSection title="Special">
        <FilterCheckbox
          label="Featured Only"
          checked={filters.isFeatured === true}
          onChange={() => updateFilter('isFeatured', !filters.isFeatured)}
          disabled={isLoading}
        />
      </FilterSection>
    </div>
  );
}

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-gray-200 pb-4">
      <h3 className="text-sm font-medium text-gray-900 mb-3">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function FilterCheckbox({
  label,
  count,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  count?: number;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer group">
      <div className="flex items-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="w-4 h-4 text-black border-gray-300 rounded focus:ring-black disabled:opacity-50"
        />
        <span className="ml-2 text-sm text-gray-700 group-hover:text-black">
          {label}
        </span>
      </div>
      {count !== undefined && (
        <span className="text-xs text-gray-500">({count})</span>
      )}
    </label>
  );
}
