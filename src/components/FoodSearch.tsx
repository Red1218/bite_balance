
import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Search, Loader2, X } from 'lucide-react';
import { useNutrientsApi } from '@/hooks/useNutrientsApi';
import { NutrientValues } from '@/types/nutrients';

interface FoodSearchProps {
  onFoodSelect: (nutrients: NutrientValues, foodName: string, baseNutrients: NutrientValues) => void;
}

const FoodSearch = ({ onFoodSelect }: FoodSearchProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showResults, setShowResults] = useState(false);
  const { isLoading, searchResults, searchFoods, getFoodDetails, clearSearch } = useNutrientsApi();

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm.length >= 2) {
        searchFoods(searchTerm);
        setShowResults(true);
      } else {
        clearSearch();
        setShowResults(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleFoodSelect = async (fdcId: number, description: string) => {
    const nutrients = await getFoodDetails(fdcId);
    if (nutrients) {
      // Pass the same nutrients as both display and base values
      onFoodSelect(nutrients, description, nutrients);
      setSearchTerm('');
      setShowResults(false);
      clearSearch();
    }
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setShowResults(false);
    clearSearch();
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="food-search" className="text-foreground text-base">Search Foods</Label>
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            id="food-search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search for foods (e.g., chicken breast, apple)"
            className="bg-background/50 border-border text-foreground placeholder:text-muted-foreground rounded-xl h-14 text-base backdrop-blur-sm pl-10 pr-10"
          />
          {searchTerm && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearSearch}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Search Results */}
        {showResults && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-xl shadow-lg max-h-64 overflow-y-auto backdrop-blur-xl">
            {isLoading ? (
              <div className="p-4 flex items-center justify-center">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                <span className="text-muted-foreground">Searching...</span>
              </div>
            ) : searchResults?.foods?.length ? (
              <div className="p-2">
                {searchResults.foods.slice(0, 10).map((food) => (
                  <button
                    key={food.fdcId}
                    onClick={() => handleFoodSelect(food.fdcId, food.description)}
                    className="w-full text-left p-3 hover:bg-accent rounded-lg transition-colors"
                  >
                    <div className="font-medium text-foreground text-sm">
                      {food.description}
                    </div>
                    {food.brandOwner && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {food.brandOwner}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">
                      {food.dataType}
                    </div>
                  </button>
                ))}
              </div>
            ) : searchTerm.length >= 2 ? (
              <div className="p-4 text-center text-muted-foreground">
                No foods found for "{searchTerm}"
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

export default FoodSearch;
