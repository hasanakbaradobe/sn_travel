import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Globe, Check, X, ChevronDown } from 'lucide-react';
import { Country } from '../types';

interface CountrySelectSearchProps {
  countries: Country[];
  selectedCountry: string;
  onSelectCountry: (countryName: string) => void;
  required?: boolean;
  label?: string;
  placeholder?: string;
}

export const CountrySelectSearch: React.FC<CountrySelectSearchProps> = ({
  countries,
  selectedCountry,
  onSelectCountry,
  required = false,
  label = 'Country / Nationality',
  placeholder = 'Search country by name (e.g. UAE, Pakistan, Russia)...',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Filter countries by name or code
  const filteredCountries = useMemo(() => {
    if (!searchTerm.trim()) {
      return countries.filter((c) => c.is_active === 1);
    }
    const q = searchTerm.toLowerCase().trim();
    return countries.filter(
      (c) =>
        c.is_active === 1 &&
        (c.name.toLowerCase().includes(q) || (c.code && c.code.toLowerCase().includes(q)))
    );
  }, [countries, searchTerm]);

  const handleOpenDropdown = () => {
    setIsOpen(true);
    setSearchTerm('');
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  };

  const handleSelect = (name: string) => {
    onSelectCountry(name);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div className="space-y-1 relative" ref={containerRef}>
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-slate-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        <span className="text-[10px] text-slate-400">Searchable dropdown</span>
      </div>

      {/* Trigger Button */}
      <button
        type="button"
        onClick={handleOpenDropdown}
        className="w-full text-left px-3 py-2 bg-white border border-slate-300 hover:border-sky-500 rounded-lg text-sm text-slate-900 flex items-center justify-between shadow-2xs transition focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600"
      >
        <div className="flex items-center gap-2 truncate">
          <Globe className="w-4 h-4 text-sky-600 shrink-0" />
          <span className={selectedCountry ? 'font-medium text-slate-900 truncate' : 'text-slate-400 truncate'}>
            {selectedCountry || 'Select or search country...'}
          </span>
        </div>
        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
      </button>

      {/* Dropdown Menu with Live Search Filter */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Search Box */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/80">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={placeholder}
                className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="text-[10px] text-slate-400 mt-1 px-1 flex items-center justify-between">
              <span>{filteredCountries.length} countries found</span>
              <span>Managed in Settings → Countries</span>
            </div>
          </div>

          {/* List of Countries */}
          <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
            {filteredCountries.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-500 space-y-2">
                <div>No country matching "{searchTerm}"</div>
                {searchTerm.trim() && (
                  <button
                    type="button"
                    onClick={() => handleSelect(searchTerm.trim())}
                    className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-800 text-[11px] font-semibold rounded border border-sky-200 transition"
                  >
                    Use "{searchTerm.trim()}" as custom country
                  </button>
                )}
              </div>
            ) : (
              filteredCountries.map((c) => {
                const isSelected = selectedCountry?.toLowerCase() === c.name.toLowerCase();
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelect(c.name)}
                    className={`w-full text-left px-3 py-2 text-xs transition flex items-center justify-between ${
                      isSelected
                        ? 'bg-sky-50 text-sky-900 font-semibold'
                        : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{c.name}</span>
                      {c.code && (
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1 py-0.2 rounded">
                          {c.code}
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-sky-700 shrink-0 ml-1" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
