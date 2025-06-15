
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calculator, Scale } from "lucide-react";

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

interface PortionCalculatorProps {
  selectedFood: FoodItem | null;
  onCalculatedValues: (values: {
    calories: string;
    protein: string;
    carbs: string;
    fat: string;
    fiber: string;
  }) => void;
}

const PortionCalculator = ({ selectedFood, onCalculatedValues }: PortionCalculatorProps) => {
  const [portionSize, setPortionSize] = useState("");
  const [unit, setUnit] = useState<"grams" | "pounds">("grams");

  // Common portion presets in grams
  const portionPresets = [
    { label: "50g", value: 50 },
    { label: "100g", value: 100 },
    { label: "150g", value: 150 },
    { label: "200g", value: 200 },
    { label: "250g", value: 250 },
  ];

  // Indian-specific portion presets
  const indianPresets = [
    { label: "1 Chapati (~30g)", value: 30 },
    { label: "1 Cup Rice (~200g)", value: 200 },
    { label: "1 Bowl Dal (~150g)", value: 150 },
    { label: "1 Medium Paratha (~60g)", value: 60 },
    { label: "1 Piece Naan (~80g)", value: 80 },
  ];

  const calculateNutrients = (grams: number) => {
    if (!selectedFood || grams <= 0) {
      return {
        calories: "0",
        protein: "0",
        carbs: "0",
        fat: "0",
        fiber: "0"
      };
    }

    const multiplier = grams / 100; // Base values are per 100g

    return {
      calories: Math.round(selectedFood.calories * multiplier).toString(),
      protein: (selectedFood.protein * multiplier).toFixed(1),
      carbs: (selectedFood.carbs * multiplier).toFixed(1),
      fat: (selectedFood.fat * multiplier).toFixed(1),
      fiber: (selectedFood.fiber * multiplier).toFixed(1)
    };
  };

  const convertToGrams = (value: number): number => {
    return unit === "pounds" ? value * 453.592 : value;
  };

  useEffect(() => {
    if (portionSize && !isNaN(Number(portionSize))) {
      const grams = convertToGrams(Number(portionSize));
      const calculatedValues = calculateNutrients(grams);
      onCalculatedValues(calculatedValues);
    }
  }, [portionSize, unit, selectedFood]);

  const handlePresetClick = (grams: number) => {
    setPortionSize(grams.toString());
    setUnit("grams");
  };

  const getSourceBadgeColor = (source: string) => {
    switch (source) {
      case 'USDA':
        return 'bg-blue-100 text-blue-800';
      case 'INDIAN':
        return 'bg-orange-100 text-orange-800';
      case 'CUSTOM':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'USDA':
        return 'USDA Database';
      case 'INDIAN':
        return 'Indian Food DB';
      case 'CUSTOM':
        return 'Indian Cuisine';
      default:
        return source;
    }
  };

  if (!selectedFood) {
    return (
      <Card className="glass-card">
        <CardContent className="p-6 text-center">
          <Scale className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            Search and select a food item above to calculate portion-based nutrition
          </p>
        </CardContent>
      </Card>
    );
  }

  const grams = portionSize ? convertToGrams(Number(portionSize)) : 0;
  const calculatedValues = calculateNutrients(grams);
  const isIndianFood = selectedFood.source === 'CUSTOM' || selectedFood.source === 'INDIAN';

  return (
    <Card className="glass-card">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-primary" />
          <CardTitle className="text-lg text-foreground">Portion Calculator</CardTitle>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Selected Food Info */}
        <div className="bg-background/30 rounded-xl p-4">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h4 className="font-medium text-foreground">{selectedFood.name}</h4>
              {selectedFood.category && (
                <p className="text-sm text-muted-foreground">{selectedFood.category}</p>
              )}
            </div>
            <Badge className={`text-xs ${getSourceBadgeColor(selectedFood.source)}`}>
              {getSourceLabel(selectedFood.source)}
            </Badge>
          </div>
          
          <div className="grid grid-cols-5 gap-2 text-xs mt-3">
            <div className="text-center">
              <div className="font-medium text-foreground">{Math.round(selectedFood.calories)}</div>
              <div className="text-muted-foreground">cal/100g</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-foreground">{selectedFood.protein.toFixed(1)}</div>
              <div className="text-muted-foreground">protein</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-foreground">{selectedFood.carbs.toFixed(1)}</div>
              <div className="text-muted-foreground">carbs</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-foreground">{selectedFood.fat.toFixed(1)}</div>
              <div className="text-muted-foreground">fat</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-foreground">{selectedFood.fiber.toFixed(1)}</div>
              <div className="text-muted-foreground">fiber</div>
            </div>
          </div>
        </div>

        {/* Portion Size Input */}
        <div className="space-y-3">
          <Label className="text-foreground">Enter your portion size</Label>
          
          <div className="flex gap-2">
            <Input
              type="number"
              value={portionSize}
              onChange={(e) => setPortionSize(e.target.value)}
              placeholder="Enter amount"
              className="bg-background/50 border-border text-foreground rounded-xl h-12"
              min="0"
              step="0.1"
            />
            <div className="flex rounded-xl overflow-hidden border border-border">
              <Button
                type="button"
                variant={unit === "grams" ? "default" : "outline"}
                onClick={() => setUnit("grams")}
                className={`rounded-none h-12 ${unit === "grams" ? "primary-button" : "bg-background text-foreground"}`}
              >
                Grams
              </Button>
              <Button
                type="button"
                variant={unit === "pounds" ? "default" : "outline"}
                onClick={() => setUnit("pounds")}
                className={`rounded-none h-12 ${unit === "pounds" ? "primary-button" : "bg-background text-foreground"}`}
              >
                Pounds
              </Button>
            </div>
          </div>
        </div>

        {/* Portion Presets */}
        <div className="space-y-3">
          <Label className="text-foreground">Quick portions</Label>
          
          <div className="grid grid-cols-2 gap-2">
            {portionPresets.map((preset) => (
              <Button
                key={preset.label}
                type="button"
                variant="outline"
                onClick={() => handlePresetClick(preset.value)}
                className="h-10 text-sm bg-background/50 border-border text-foreground hover:bg-accent"
              >
                {preset.label}
              </Button>
            ))}
          </div>

          {isIndianFood && (
            <>
              <Label className="text-foreground text-sm mt-4">Indian portion sizes</Label>
              <div className="grid grid-cols-1 gap-2">
                {indianPresets.map((preset) => (
                  <Button
                    key={preset.label}
                    type="button"
                    variant="outline"
                    onClick={() => handlePresetClick(preset.value)}
                    className="h-10 text-sm bg-orange-50/10 border-orange-200/20 text-foreground hover:bg-orange-100/20"
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Calculated Values */}
        {portionSize && Number(portionSize) > 0 && (
          <div className="bg-primary/5 rounded-xl p-4">
            <h4 className="font-medium text-foreground mb-3">
              Nutrition for {portionSize} {unit} ({grams.toFixed(0)}g)
            </h4>
            
            <div className="grid grid-cols-5 gap-2 text-sm">
              <div className="text-center">
                <div className="font-semibold text-foreground text-lg">{calculatedValues.calories}</div>
                <div className="text-muted-foreground">calories</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-foreground text-lg">{calculatedValues.protein}g</div>
                <div className="text-muted-foreground">protein</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-foreground text-lg">{calculatedValues.carbs}g</div>
                <div className="text-muted-foreground">carbs</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-foreground text-lg">{calculatedValues.fat}g</div>
                <div className="text-muted-foreground">fat</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-foreground text-lg">{calculatedValues.fiber}g</div>
                <div className="text-muted-foreground">fiber</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PortionCalculator;
