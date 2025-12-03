import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/manualClient';

export interface FoodResult {
  id: string;
  name: string;
  brand: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  serving_size: string;
  barcode: string;
  image_url: string;
}

interface SearchResponse {
  foods: FoodResult[];
  total: number;
  page: number;
}

export const useFoodSearch = () => {
  const [results, setResults] = useState<FoodResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const searchFoods = useCallback(async (query: string, page = 1) => {
    if (!query || query.trim().length < 2) {
      setResults([]);
      setTotal(0);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke<SearchResponse>('search-food', {
        body: { query: query.trim(), page },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data) {
        setResults(data.foods || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error('Food search error:', err);
      setError(err instanceof Error ? err.message : 'Failed to search foods');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    setResults([]);
    setTotal(0);
    setError(null);
  }, []);

  return {
    results,
    loading,
    error,
    total,
    searchFoods,
    clearResults,
  };
};
