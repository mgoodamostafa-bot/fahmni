import { useState, useMemo, useCallback, useEffect } from 'react';

export interface SearchableField {
  name: string;
  weight?: number;
}

export interface SearchOptions {
  debounceMs?: number;
  initialQuery?: string;
  normalizeArabic?: boolean;
}

export function useSearch<T extends Record<string, unknown>>(
  items: T[],
  fields: (keyof T | SearchableField)[],
  options?: SearchOptions
) {
  const [query, setQuery] = useState(options?.initialQuery || '');
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  // Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, options?.debounceMs || 200);
    return () => clearTimeout(timer);
  }, [query, options?.debounceMs]);

  const trimmed = debouncedQuery.trim().toLowerCase();

  // Normalize Arabic text (remove diacritics, normalize hamza, etc.)
  const normalizeText = useCallback(
    (text: string): string => {
      if (!options?.normalizeArabic) return text;
      return text
        .replace(/[\u0610-\u061A]/g, '') // Remove diacritics
        .replace(/[\u0621-\u0625]/g, 'ا') // Normalize hamza variants to alef
        .replace(/[\u0629]/g, 'ه') // Normalize ta marbuta to ha
        .replace(/[\u0649]/g, 'ي') // Normalize alef maqsura to ya
        .replace(/\s+/g, ' ') // Normalize spaces
        .trim();
    },
    [options?.normalizeArabic]
  );

  const filtered = useMemo(() => {
    if (!trimmed) return items;
    const fieldNames = fields.map((f) => (typeof f === 'string' ? f : (f as SearchableField).name));
    const searchQuery = normalizeText(trimmed);

    return items.filter((item) => {
      return fieldNames.some((fieldName) => {
        const value = item[fieldName];
        if (value == null) return false;
        const text = normalizeText(String(value).toLowerCase());
        return text.includes(searchQuery);
      });
    });
  }, [items, trimmed, fields, normalizeText]);

  const reset = useCallback(() => setQuery(''), []);

  return {
    query,
    setQuery,
    reset,
    filtered,
    totalCount: items.length,
    matchCount: filtered.length,
    hasQuery: trimmed.length > 0,
  };
}

// Highlight matching text utility
export function highlightMatch(text: string, query: string): string {
  if (!query) return text;
  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
  return text.replace(regex, '<mark class="bg-yellow-500/30 text-white rounded px-0.5">$1</mark>');
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
