
export interface FoodNutrient {
  nutrientId: number;
  nutrientName: string;
  nutrientNumber: string;
  unitName: string;
  value: number;
}

export interface FoodItem {
  fdcId: number;
  description: string;
  dataType: string;
  brandOwner?: string;
  ingredients?: string;
  foodNutrients: FoodNutrient[];
}

export interface SearchResult {
  foods: FoodItem[];
  totalHits: number;
  currentPage: number;
  totalPages: number;
}

export interface NutrientValues {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}
