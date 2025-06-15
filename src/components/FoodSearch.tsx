
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface FoodItem {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  source: 'USDA' | 'INDIAN' | 'CUSTOM';
  category?: string;
}

interface FoodSearchProps {
  onFoodSelect: (food: FoodItem) => void;
}

const FoodSearch = ({ onFoodSelect }: FoodSearchProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FoodItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('enhanced-food-search', {
        body: { query: searchQuery }
      });

      if (error) {
        console.error('Search error:', error);
        setSearchResults([]);
        return;
      }

      setSearchResults(data?.foods || []);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const getSourceBadgeColor = (source: string) => {
    switch (source) {
      case 'USDA':
        return 'bg-blue-100 text-blue-800 hover:bg-blue-200';
      case 'INDIAN':
        return 'bg-orange-100 text-orange-800 hover:bg-orange-200';
      case 'CUSTOM':
        return 'bg-green-100 text-green-800 hover:bg-green-200';
      default:
        return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
    }
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'USDA':
        return 'USDA';
      case 'INDIAN':
        return 'Indian DB';
      case 'CUSTOM':
        return 'Indian Cuisine';
      default:
        return source;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Search for food (e.g., 'chicken breast', 'dal moong', 'biryani')"
          className="bg-background/50 border-border text-foreground placeholder:text-muted-foreground rounded-xl h-12 backdrop-blur-sm"
        />
        <Button 
          onClick={handleSearch}
          disabled={isLoading || !searchQuery.trim()}
          className="primary-button h-12 px-6 rounded-xl"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
        </Button>
      </div>

      {searchResults.length > 0 && (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          <p className="text-sm text-muted-foreground">
            Found {searchResults.length} results from multiple sources
          </p>
          {searchResults.map((food) => (
            <Card 
              key={food.id} 
              className="glass-card hover:bg-accent/20 cursor-pointer transition-colors"
              onClick={() => onFoodSelect(food)}
            >
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <h4 className="font-medium text-foreground text-sm">{food.name}</h4>
                    {food.category && (
                      <p className="text-xs text-muted-foreground mt-1">{food.category}</p>
                    )}
                  </div>
                  <Badge className={`text-xs ${getSourceBadgeColor(food.source)}`}>
                    {getSourceLabel(food.source)}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-5 gap-2 text-xs">
                  <div className="text-center">
                    <div className="font-medium text-foreground">{Math.round(food.calories)}</div>
                    <div className="text-muted-foreground">cal</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-foreground">{food.protein?.toFixed(1) || '0.0'}</div>
                    <div className="text-muted-foreground">protein</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-foreground">{food.carbs?.toFixed(1) || '0.0'}</div>
                    <div className="text-muted-foreground">carbs</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-foreground">{food.fat?.toFixed(1) || '0.0'}</div>
                    <div className="text-muted-foreground">fat</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-foreground">{food.fiber?.toFixed(1) || '0.0'}</div>
                    <div className="text-muted-foreground">fiber</div>
                  </div>
                </div>
                
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Values per 100g • Click to use
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {searchQuery && !isLoading && searchResults.length === 0 && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">
            No foods found for "{searchQuery}"
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Try searching for Indian dishes like "dal", "biryani", or "chapati"
          </p>
        </div>
      )}
    </div>
  );
};

export default FoodSearch;
