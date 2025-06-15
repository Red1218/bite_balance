
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { NutrientsApiService } from '@/services/nutrientsApi';
import { SearchResult, FoodItem, NutrientValues } from '@/types/nutrients';

export const useNutrientsApi = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const { toast } = useToast();

  const searchFoods = async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setSearchResults(null);
      return;
    }

    setIsLoading(true);
    try {
      const results = await NutrientsApiService.searchFoods(searchTerm);
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: "Search Failed",
        description: "Failed to search for foods. Please try again.",
        variant: "destructive"
      });
      setSearchResults(null);
    } finally {
      setIsLoading(false);
    }
  };

  const getFoodDetails = async (fdcId: number): Promise<NutrientValues | null> => {
    setIsLoading(true);
    try {
      const foodDetails = await NutrientsApiService.getFoodDetails(fdcId);
      setSelectedFood(foodDetails);
      return NutrientsApiService.extractNutrients(foodDetails);
    } catch (error) {
      console.error('Food details error:', error);
      toast({
        title: "Failed to Load Food Details",
        description: "Could not load nutritional information for this food.",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const clearSearch = () => {
    setSearchResults(null);
    setSelectedFood(null);
  };

  return {
    isLoading,
    searchResults,
    selectedFood,
    searchFoods,
    getFoodDetails,
    clearSearch
  };
};
