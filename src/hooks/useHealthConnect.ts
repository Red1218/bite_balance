
import { useState, useEffect } from 'react';
import HealthConnect from '@/plugins/healthConnect';
import { useToast } from '@/hooks/use-toast';

export interface HealthData {
  steps: number;
  activeCalories: number;
  totalCalories: number;
  lastUpdated: string;
}

export const useHealthConnect = () => {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkAvailability();
  }, []);

  const checkAvailability = async () => {
    try {
      console.log('Checking Health Connect availability...');
      const result = await HealthConnect.isAvailable();
      console.log('Availability result:', result);
      
      setIsAvailable(result.available);
      
      if (!result.available) {
        if (result.error) {
          console.error('Health Connect error:', result.error);
          toast({
            title: "Health Connect Error",
            description: result.error,
            variant: "destructive"
          });
        } else {
          toast({
            title: "Health Connect Not Available",
            description: `Please install Health Connect from Google Play Store (Status: ${result.status})`,
            variant: "destructive"
          });
        }
      }
    } catch (error) {
      console.error('Error checking Health Connect availability:', error);
      setIsAvailable(false);
      toast({
        title: "Error",
        description: "Failed to check Health Connect availability",
        variant: "destructive"
      });
    }
  };

  const requestPermissions = async () => {
    if (!isAvailable) {
      toast({
        title: "Health Connect Not Available",
        description: "Please install Health Connect from Google Play Store",
        variant: "destructive"
      });
      return false;
    }

    setLoading(true);
    try {
      console.log('Requesting Health Connect permissions...');
      const result = await HealthConnect.requestPermissions();
      console.log('Permission result:', result);
      
      setIsConnected(result.granted);
      
      if (result.granted) {
        toast({
          title: "Connected Successfully",
          description: "Health Connect permissions granted"
        });
        await fetchHealthData();
      } else {
        const errorMessage = result.error || "Please grant permissions to access health data";
        console.error('Permission denied:', errorMessage);
        toast({
          title: "Permissions Required",
          description: errorMessage,
          variant: "destructive"
        });
      }
      
      return result.granted;
    } catch (error) {
      console.error('Error requesting permissions:', error);
      toast({
        title: "Connection Failed",
        description: `Failed to connect to Health Connect: ${error}`,
        variant: "destructive"
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const fetchHealthData = async () => {
    if (!isConnected && !isAvailable) return;

    setLoading(true);
    try {
      console.log('Fetching health data...');
      const [stepsResult, caloriesResult] = await Promise.all([
        HealthConnect.getTodaysSteps(),
        HealthConnect.getTodaysCalories()
      ]);

      console.log('Steps result:', stepsResult);
      console.log('Calories result:', caloriesResult);

      setHealthData({
        steps: stepsResult.steps,
        activeCalories: caloriesResult.activeCalories,
        totalCalories: caloriesResult.totalCalories,
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error fetching health data:', error);
      toast({
        title: "Data Fetch Failed",
        description: `Failed to fetch health data: ${error}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    isAvailable,
    isConnected,
    healthData,
    loading,
    requestPermissions,
    fetchHealthData
  };
};
