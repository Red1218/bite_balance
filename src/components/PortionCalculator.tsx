
import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calculator, Scale } from 'lucide-react';
import { NutrientValues } from '@/types/nutrients';

interface PortionCalculatorProps {
  baseNutrients: NutrientValues | null;
  foodName: string;
  onCalculatedNutrients: (nutrients: NutrientValues) => void;
}

const PortionCalculator = ({ baseNutrients, foodName, onCalculatedNutrients }: PortionCalculatorProps) => {
  const [portionSize, setPortionSize] = useState('100');
  const [unit, setUnit] = useState('grams');
  const [calculatedNutrients, setCalculatedNutrients] = useState<NutrientValues | null>(null);

  const portionPresets = [
    { label: '50g', value: '50', unit: 'grams' },
    { label: '100g', value: '100', unit: 'grams' },
    { label: '150g', value: '150', unit: 'grams' },
    { label: '200g', value: '200', unit: 'grams' },
    { label: '250g', value: '250', unit: 'grams' },
    { label: '1 cup (~240g)', value: '240', unit: 'grams' },
  ];

  const convertToGrams = (value: number, currentUnit: string): number => {
    if (currentUnit === 'pounds') {
      return value * 453.592; // 1 pound = 453.592 grams
    }
    return value;
  };

  const calculateNutrients = (portion: number, currentUnit: string) => {
    if (!baseNutrients || portion <= 0) {
      setCalculatedNutrients(null);
      return;
    }

    const portionInGrams = convertToGrams(portion, currentUnit);
    const multiplier = portionInGrams / 100; // Base nutrients are per 100g

    const calculated = {
      calories: Math.round(baseNutrients.calories * multiplier),
      protein: Math.round(baseNutrients.protein * multiplier * 10) / 10,
      carbs: Math.round(baseNutrients.carbs * multiplier * 10) / 10,
      fat: Math.round(baseNutrients.fat * multiplier * 10) / 10,
      fiber: Math.round(baseNutrients.fiber * multiplier * 10) / 10,
    };

    setCalculatedNutrients(calculated);
    onCalculatedNutrients(calculated);
  };

  useEffect(() => {
    const portion = parseFloat(portionSize);
    if (!isNaN(portion)) {
      calculateNutrients(portion, unit);
    }
  }, [portionSize, unit, baseNutrients]);

  const handlePresetClick = (preset: { value: string; unit: string }) => {
    setPortionSize(preset.value);
    setUnit(preset.unit);
  };

  if (!baseNutrients || !foodName) {
    return null;
  }

  return (
    <div className="space-y-4 p-4 bg-accent/30 rounded-xl border border-accent">
      <div className="flex items-center gap-2">
        <Scale className="w-5 h-5 text-primary" />
        <h3 className="text-foreground text-base font-medium">Portion Calculator</h3>
      </div>
      
      <div className="text-sm text-muted-foreground">
        <strong>{foodName}</strong> - Nutritional values per 100g
      </div>

      {/* Base nutrients display */}
      <div className="grid grid-cols-5 gap-2 text-xs">
        <div className="text-center p-2 bg-background/50 rounded">
          <div className="font-medium text-muted-foreground">Cal</div>
          <div className="text-foreground">{baseNutrients.calories}</div>
        </div>
        <div className="text-center p-2 bg-background/50 rounded">
          <div className="font-medium text-muted-foreground">Protein</div>
          <div className="text-foreground">{baseNutrients.protein}g</div>
        </div>
        <div className="text-center p-2 bg-background/50 rounded">
          <div className="font-medium text-muted-foreground">Carbs</div>
          <div className="text-foreground">{baseNutrients.carbs}g</div>
        </div>
        <div className="text-center p-2 bg-background/50 rounded">
          <div className="font-medium text-muted-foreground">Fat</div>
          <div className="text-foreground">{baseNutrients.fat}g</div>
        </div>
        <div className="text-center p-2 bg-background/50 rounded">
          <div className="font-medium text-muted-foreground">Fiber</div>
          <div className="text-foreground">{baseNutrients.fiber}g</div>
        </div>
      </div>

      {/* Portion input */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 space-y-2">
          <Label htmlFor="portion-size" className="text-muted-foreground text-sm">Your Portion</Label>
          <Input
            id="portion-size"
            type="number"
            step="0.1"
            min="1"
            max="2000"
            value={portionSize}
            onChange={(e) => setPortionSize(e.target.value)}
            placeholder="Enter amount"
            className="bg-background/50 border-border text-foreground rounded-xl h-12 backdrop-blur-sm"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-muted-foreground text-sm">Unit</Label>
          <Select value={unit} onValueChange={setUnit}>
            <SelectTrigger className="bg-background/50 border-border text-foreground rounded-xl h-12 backdrop-blur-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border backdrop-blur-xl">
              <SelectItem value="grams">Grams</SelectItem>
              <SelectItem value="pounds">Pounds</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Preset buttons */}
      <div>
        <Label className="text-muted-foreground text-sm">Quick Presets</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {portionPresets.map((preset) => (
            <Button
              key={preset.label}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handlePresetClick(preset)}
              className="text-xs"
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Calculated results */}
      {calculatedNutrients && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-primary" />
            <Label className="text-foreground text-sm font-medium">
              Calculated Nutrition ({portionSize} {unit})
            </Label>
          </div>
          <div className="grid grid-cols-5 gap-2 text-xs">
            <div className="text-center p-3 bg-primary/10 border border-primary/20 rounded">
              <div className="font-medium text-primary">Calories</div>
              <div className="text-foreground font-semibold">{calculatedNutrients.calories}</div>
            </div>
            <div className="text-center p-3 bg-primary/10 border border-primary/20 rounded">
              <div className="font-medium text-primary">Protein</div>
              <div className="text-foreground font-semibold">{calculatedNutrients.protein}g</div>
            </div>
            <div className="text-center p-3 bg-primary/10 border border-primary/20 rounded">
              <div className="font-medium text-primary">Carbs</div>
              <div className="text-foreground font-semibold">{calculatedNutrients.carbs}g</div>
            </div>
            <div className="text-center p-3 bg-primary/10 border border-primary/20 rounded">
              <div className="font-medium text-primary">Fat</div>
              <div className="text-foreground font-semibold">{calculatedNutrients.fat}g</div>
            </div>
            <div className="text-center p-3 bg-primary/10 border border-primary/20 rounded">
              <div className="font-medium text-primary">Fiber</div>
              <div className="text-foreground font-semibold">{calculatedNutrients.fiber}g</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PortionCalculator;
