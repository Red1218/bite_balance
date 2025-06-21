import { registerPlugin, WebPlugin } from '@capacitor/core';

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

class HealthConnectWeb extends WebPlugin implements HealthConnectPlugin {
  async isAvailable(): Promise<{ available: boolean; status: number }> {
    return { available: false, status: 0 };
  }

  async requestPermissions(): Promise<{ granted: boolean }> {
    return { granted: false };
  }

  async getTodaysSteps(): Promise<{ steps: number; date: string }> {
    return { 
      steps: 0, 
      date: new Date().toISOString().split('T')[0] 
    };
  }

  async getTodaysCalories(): Promise<{ 
    activeCalories: number; 
    totalCalories: number; 
    date: string; 
  }> {
    return { 
      activeCalories: 0, 
      totalCalories: 0, 
      date: new Date().toISOString().split('T')[0] 
    };
  }
}

const HealthConnect = registerPlugin<HealthConnectPlugin>('HealthConnect', {
  web: () => new HealthConnectWeb(),
});

export default HealthConnect;