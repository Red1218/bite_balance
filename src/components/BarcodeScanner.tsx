import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Scan, QrCode, AlertCircle } from 'lucide-react';
import { FoodResult } from '@/hooks/useFoodSearch';
import { Html5Qrcode } from 'html5-qrcode';

interface BarcodeScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScanSuccess: (food: FoodResult) => void;
}

const BarcodeScanner = ({ open, onOpenChange, onScanSuccess }: BarcodeScannerProps) => {
  const { toast } = useToast();
  const [barcode, setBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const lookupBarcode = async (barcodeVal: string) => {
    const trimmedBarcode = barcodeVal.trim();
    if (!trimmedBarcode) return;

    setLoading(true);
    try {
      // Fetch directly from OpenFoodFacts. Forbidden User-Agent header has been removed
      // to prevent CORS failures and browser security blocks.
      const response = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${trimmedBarcode}.json`
      );

      if (!response.ok) {
        throw new Error('API request failed');
      }

      const data = await response.json();

      if (data.status === 1 || data.status === 'found') {
        const product = data.product;
        const nutriments = product.nutriments || {};
        const energyKcal = Math.round(
          nutriments['energy-kcal_100g'] ||
          nutriments['energy-kcal'] ||
          nutriments['energy-kcal_serving'] ||
          (nutriments['energy_100g'] ? nutriments['energy_100g'] / 4.184 : 0) ||
          (nutriments['energy'] ? nutriments['energy'] / 4.184 : 0)
        );

        const foodResult: FoodResult = {
          id: product.code || crypto.randomUUID(),
          name: product.product_name || 'Unknown Product',
          brand: product.brands || '',
          calories: energyKcal,
          protein:
            Math.round(
              (nutriments.proteins_100g ||
                nutriments.proteins ||
                nutriments.proteins_serving ||
                nutriments.protein_100g ||
                nutriments.protein ||
                0) * 10
            ) / 10,
          carbs:
            Math.round(
              (nutriments.carbohydrates_100g ||
                nutriments.carbohydrates ||
                nutriments.carbohydrates_serving ||
                nutriments.carbs_100g ||
                nutriments.carbs ||
                0) * 10
            ) / 10,
          fat:
            Math.round(
              (nutriments.fat_100g ||
                nutriments.fat ||
                nutriments.fat_serving ||
                0) * 10
            ) / 10,
          fiber:
            Math.round(
              (nutriments.fiber_100g ||
                nutriments.fiber ||
                nutriments.fiber_serving ||
                0) * 10
            ) / 10,
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
          description: 'Would you like to add this food details manually?',
          variant: 'default',
        });
        
        // Pass a dummy/blank result with barcode to auto-fill the manual logger name
        const partialResult: FoodResult = {
          id: trimmedBarcode,
          name: `Unrecognized Barcode (${trimmedBarcode})`,
          brand: '',
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          fiber: 0,
          serving_size: '100g',
          barcode: trimmedBarcode,
          image_url: '',
        };
        onScanSuccess(partialResult);
        onOpenChange(false);
        setBarcode('');
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

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    lookupBarcode(barcode);
  };

  // Initialize and clean up the live camera scanner
  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;
    let isMounted = true;

    if (open) {
      setCameraError(null);
      setCameraActive(false);

      // Brief delay to ensure dialog container element is mounted in DOM
      const timer = setTimeout(() => {
        if (!isMounted) return;

        try {
          html5QrCode = new Html5Qrcode("scanner-reader");
          html5QrCode.start(
            { facingMode: "environment" },
            {
              fps: 10,
              qrbox: (width, height) => {
                // Optimal rectangle format for reading barcodes
                return { width: Math.round(width * 0.85), height: Math.round(height * 0.45) };
              }
            },
            async (decodedText) => {
              if (html5QrCode && html5QrCode.isScanning) {
                try {
                  await html5QrCode.stop();
                } catch (err) {
                  console.error('Error stopping scanner:', err);
                }
              }
              lookupBarcode(decodedText);
            },
            () => {
              // Ignore standard frame scan failures
            }
          )
          .then(() => {
            if (isMounted) setCameraActive(true);
          })
          .catch((err) => {
            console.error('Failed to start scanner:', err);
            if (isMounted) {
              setCameraError('Camera access not allowed or unavailable. Type barcode below.');
            }
          });
        } catch (e) {
          console.error('Scanner error:', e);
          if (isMounted) setCameraError('Could not initialize scanner.');
        }
      }, 400);

      return () => {
        isMounted = false;
        clearTimeout(timer);
        if (html5QrCode && html5QrCode.isScanning) {
          html5QrCode.stop().catch((err) => console.error('Error stopping scanner on cleanup:', err));
        }
      };
    }
  }, [open]);

  // Simulate scanning standard sample barcodes
  const handleSimulateScan = (sampleBarcode: string) => {
    setBarcode(sampleBarcode);
    lookupBarcode(sampleBarcode);
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

        {/* Viewfinder area */}
        <div className="relative w-full h-48 bg-black rounded-xl overflow-hidden border border-border/20 flex flex-col items-center justify-center p-4">
          <div id="scanner-reader" className="absolute inset-0 w-full h-full object-cover [&>video]:object-cover" />
          
          {/* Scanning line animation */}
          {cameraActive && !cameraError && (
            <div className="absolute left-0 right-0 h-[2px] bg-primary shadow-[0_0_8px_hsl(var(--primary))] top-1/2 -translate-y-1/2 animate-[pulse_1.5s_infinite] z-10 pointer-events-none" />
          )}

          {/* Fallback state when camera is loading or errors occur */}
          {!cameraActive && !cameraError && (
            <div className="z-10 flex flex-col items-center text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
              <p className="text-xs">Accessing camera stream...</p>
            </div>
          )}

          {cameraError && (
            <div className="z-10 flex flex-col items-center text-center max-w-[80%] text-muted-foreground p-2">
              <AlertCircle className="w-8 h-8 text-chart-carbs mb-2" />
              <p className="text-xs">{cameraError}</p>
            </div>
          )}
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
                className="bg-background/50 border-border text-foreground placeholder:text-muted-foreground rounded-xl h-12 font-mono tabular-nums focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary/50"
                disabled={loading}
              />
              <Button
                id="submit-barcode-btn"
                type="submit"
                disabled={loading || !barcode.trim()}
                className="h-12 px-6 rounded-xl"
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
