
import { registerPlugin } from '@capacitor/core';

export interface HealthConnectPlugin {
  isAvailable(): Promise<{ available: boolean; status: number }>;
  requestPermissions(): Promise<{ granted: boolean }>;
  getTodaysSteps(): Promise<{ steps: number; date: string }>;
  getTodaysCalories(): Promise<{ 
    activeCalories: number; 
    totalCalories: number; 
    date: string; 
  }>;
}

const HealthConnect = registerPlugin<HealthConnectPlugin>('HealthConnect');

export default HealthConnect;
