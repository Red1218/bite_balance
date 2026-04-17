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
      const result = await HealthConnect.isAvailable();
      setIsAvailable(result.available);
    } catch (error) {
      console.error('Error checking Health Connect availability:', error);
      setIsAvailable(false);
    }
  };

  const requestPermissions = async () => {
    if (!isAvailable) {
      toast({
        title: 'Health Connect Not Available',
        description: 'Please install Health Connect from Google Play Store',
        variant: 'destructive',
      });
      return false;
    }

    setLoading(true);
    try {
      const result = await HealthConnect.requestPermissions();
      setIsConnected(result.granted);

      if (result.granted) {
        toast({
          title: 'Connected Successfully',
          description: 'Health Connect permissions granted',
        });
        await fetchHealthData();
      } else {
        toast({
          title: 'Permissions Required',
          description: 'Please grant permissions to access health data',
          variant: 'destructive',
        });
      }

      return result.granted;
    } catch (error) {
      console.error('Error requesting permissions:', error);
      toast({
        title: 'Connection Failed',
        description: 'Failed to connect to Health Connect',
        variant: 'destructive',
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
      const [stepsResult, caloriesResult] = await Promise.all([
        HealthConnect.getTodaysSteps(),
        HealthConnect.getTodaysCalories(),
      ]);

      setHealthData({
        steps: stepsResult.steps,
        activeCalories: caloriesResult.activeCalories,
        totalCalories: caloriesResult.totalCalories,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error fetching health data:', error);
      toast({
        title: 'Data Fetch Failed',
        description: 'Failed to fetch health data from Health Connect',
        variant: 'destructive',
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
    fetchHealthData,
  };
};
