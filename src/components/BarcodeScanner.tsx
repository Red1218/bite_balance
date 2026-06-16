import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Scan, QrCode } from 'lucide-react';
import { FoodResult } from '@/hooks/useFoodSearch';

interface BarcodeScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScanSuccess: (food: FoodResult) => void;
}

const BarcodeScanner = ({ open, onOpenChange, onScanSuccess }: BarcodeScannerProps) => {
  const { toast } = useToast();
  const [barcode, setBarcode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode.trim()) return;

    setLoading(true);
    try {
      const trimmedBarcode = barcode.trim();
      const response = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${trimmedBarcode}.json`,
        {
          headers: {
            'User-Agent': 'BiteBalance/1.0 (Calorie Tracker App)',
          },
        }
      );

      if (!response.ok) {
        throw new Error('API request failed');
      }

      const data = await response.json();

      if (data.status === 1 || data.status === 'found') {
        const product = data.product;
        const nutriments = product.nutriments || {};

        const foodResult: FoodResult = {
          id: product.code || crypto.randomUUID(),
          name: product.product_name || 'Unknown Product',
          brand: product.brands || '',
          calories: Math.round(
            nutriments['energy-kcal_100g'] || nutriments['energy-kcal'] || 0
          ),
          protein:
            Math.round(
              (nutriments.proteins_100g || nutriments.proteins || 0) * 10
            ) / 10,
          carbs:
            Math.round(
              (nutriments.carbohydrates_100g || nutriments.carbohydrates || 0) *
                10
            ) / 10,
          fat:
            Math.round((nutriments.fat_100g || nutriments.fat || 0) * 10) / 10,
          fiber:
            Math.round((nutriments.fiber_100g || nutriments.fiber || 0) * 10) /
            10,
          serving_size: product.serving_size || '100g',
          barcode: product.code || trimmedBarcode,
          image_url: product.image_small_url || '',
        };

        toast({
          title: 'Product Found!',
          description: `${foodResult.name} - ${foodResult.brand || 'Generic Brand'}`,
        });

        onScanSuccess(foodResult);
        onOpenChange(false);
        setBarcode('');
      } else {
        toast({
          title: 'Product Not Found',
          description: 'No matching food product was found for this barcode.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Barcode fetch error:', error);
      toast({
        title: 'Error',
        description: 'Failed to look up barcode. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Simulate scanning standard sample barcodes
  const handleSimulateScan = (sampleBarcode: string) => {
    setBarcode(sampleBarcode);
    // Submit in next tick
    setTimeout(() => {
      const button = document.getElementById('submit-barcode-btn');
      if (button) button.click();
    }, 100);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border backdrop-blur-xl [&>button]:text-muted-foreground">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <QrCode className="w-5 h-5 text-primary animate-pulse" />
            Barcode Scanner
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Search for packaged products by scanning or typing their barcode digits.
          </DialogDescription>
        </DialogHeader>

        {/* Viewfinder simulation */}
        <div className="relative w-full h-44 bg-black/60 rounded-xl overflow-hidden border border-border/20 flex flex-col items-center justify-center p-4">
          {/* Laser scanning line */}
          <div className="absolute left-0 right-0 h-[2px] bg-red-500 shadow-[0_0_8px_#ef4444] top-1/2 -translate-y-1/2 animate-[pulse_1.5s_infinite]" />
          
          <Scan className="w-12 h-12 text-primary/40 animate-pulse mb-2" />
          <p className="text-xs text-muted-foreground text-center">
            Position product barcode in the scan area
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleBarcodeSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="barcode" className="text-foreground">
              Barcode digits
            </Label>
            <div className="flex gap-2">
              <Input
                id="barcode"
                placeholder="e.g. 5449000131805"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                className="bg-background/50 border-border text-foreground placeholder:text-muted-foreground rounded-xl h-12"
                disabled={loading}
              />
              <Button
                id="submit-barcode-btn"
                type="submit"
                disabled={loading || !barcode.trim()}
                className="primary-button h-12 px-6"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Find'}
              </Button>
            </div>
          </div>
        </form>

        {/* Shortcuts for rapid demo verification */}
        <div className="pt-2 border-t border-border/40">
          <p className="text-xs font-semibold text-muted-foreground mb-2">
            Simulate scanning (Click to test standard barcodes):
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSimulateScan('5449000131805')}
              className="text-xs border-border/40 hover:bg-accent/40 text-foreground"
              disabled={loading}
            >
              🥤 Coca-Cola
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSimulateScan('3017620422003')}
              className="text-xs border-border/40 hover:bg-accent/40 text-foreground"
              disabled={loading}
            >
              🍫 Nutella
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSimulateScan('0021000612239')}
              className="text-xs border-border/40 hover:bg-accent/40 text-foreground"
              disabled={loading}
            >
              🧀 Kraft Mac
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BarcodeScanner;
