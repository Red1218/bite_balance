import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Loader2, X } from 'lucide-react';
import { useFoodSearch, FoodResult } from '@/hooks/useFoodSearch';

interface FoodSearchProps {
  onSelect: (food: FoodResult) => void;
}

export const FoodSearch = ({ onSelect }: FoodSearchProps) => {
  const [query, setQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const { results, loading, error, searchFoods, clearResults } =
    useFoodSearch();
  const debounceRef = useRef<NodeJS.Timeout>();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.length >= 2) {
      debounceRef.current = setTimeout(() => {
        searchFoods(query);
        setShowResults(true);
      }, 400);
    } else {
      clearResults();
      setShowResults(false);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, searchFoods, clearResults]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (food: FoodResult) => {
    onSelect(food);
    setQuery('');
    setShowResults(false);
    clearResults();
  };

  const handleClear = () => {
    setQuery('');
    clearResults();
    setShowResults(false);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search foods (e.g., banana, chicken breast)..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setShowResults(true)}
          className="pl-10 pr-10"
        />
        {query && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={handleClear}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {showResults && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
          {loading && (
            <div className="flex items-center justify-center p-4 gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">
                Searching...
              </span>
            </div>
          )}

          {error && <div className="p-4 text-sm text-destructive">{error}</div>}

          {!loading && !error && results.length === 0 && query.length >= 2 && (
            <div className="p-4 text-sm text-muted-foreground text-center">
              No foods found. Try a different search term.
            </div>
          )}

          {!loading && results.length > 0 && (
            <ScrollArea className="max-h-[300px]">
              <div className="p-1">
                {results.map((food) => (
                  <button
                    key={food.id}
                    onClick={() => handleSelect(food)}
                    className="w-full flex items-start gap-3 p-3 rounded-md hover:bg-accent transition-colors text-left"
                  >
                    {food.image_url ? (
                      <img
                        src={food.image_url}
                        alt={food.name}
                        className="w-12 h-12 rounded object-cover bg-muted"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                        <Search className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {food.name}
                      </p>
                      {food.brand && (
                        <p className="text-xs text-muted-foreground truncate">
                          {food.brand}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {food.calories} kcal • P: {food.protein}g • C:{' '}
                        {food.carbs}g • F: {food.fat}g
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      )}
    </div>
  );
};
