// components/SearchInput.tsx
import { useState, useEffect, useRef } from 'react';
import { Search, X, Package } from 'lucide-react';
import type { Product } from '@/types/inventory.types';
import { useCurrencyConfig } from '@/hooks/useCurrencyConfig';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (product: Product) => void;
  products: Product[];
  placeholder?: string;
  pharmacyId?: string;
}

export function SearchInput({ 
  value, 
  onChange, 
  onSelect, 
  products, 
  placeholder = "Rechercher...",
  pharmacyId
}: SearchInputProps) {
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { formatPrice } = useCurrencyConfig(pharmacyId);

  useEffect(() => {
    if (value.length >= 2) {
      const filtered = products
        .filter(p => 
          p.name.toLowerCase().includes(value.toLowerCase()) ||
          p.code?.toLowerCase().includes(value.toLowerCase()) ||
          p.barcode?.toLowerCase().includes(value.toLowerCase()) ||
          p.supplier?.toLowerCase().includes(value.toLowerCase())
        )
        .slice(0, 5);
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [value, products]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} className="relative flex-1">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => value.length >= 2 && setShowSuggestions(true)}
          placeholder={placeholder}
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-10 text-sm font-semibold text-slate-700 outline-none transition-all focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
          autoComplete="off"
        />
        {value && (
          <button
            onClick={() => onChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {showSuggestions && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden z-50">
          {suggestions.map(product => (
            <button
              key={product.id}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-sky-50 transition-colors text-left border-b border-slate-100 last:border-0"
              onClick={() => {
                onSelect?.(product);
                setShowSuggestions(false);
                onChange('');
              }}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                <Package size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">{product.name}</p>
                <p className="text-xs text-slate-500">
                  {product.code} • Stock: {product.quantity}
                </p>
              </div>
              <span className="text-sm font-bold text-sky-600">
                {formatPrice(product.selling_price)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}