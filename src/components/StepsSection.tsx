
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Check, Footprints, Smartphone, Activity, Flame } from "lucide-react";
import { useHealthConnect } from '@/hooks/useHealthConnect';

const StepsSection = () => {
  const {
    isAvailable,
    isConnected,
    healthData,
    loading,
    requestPermissions,
    fetchHealthData
  } = useHealthConnect();
  
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleConnect = async () => {
    await requestPermissions();
  };

  const handleRefreshData = async () => {
    setIsRefreshing(true);
    await fetchHealthData();
    setIsRefreshing(false);
  };

  return (
    <Card className="metric-card">
      <CardHeader className="pb-3 sm:pb-4">
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
          <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          Health Connect
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isConnected ? (
          <div className="text-center space-y-4 py-4 sm:py-6">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-muted/30 rounded-full flex items-center justify-center mx-auto">
              <Activity className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground" />
            </div>
            <div>
              <p className="text-muted-foreground text-xs sm:text-sm mb-4 px-2">
                {!isAvailable 
                  ? "Health Connect is not available on this device."
                  : "Connect to Health Connect to track steps and calories."
                }
              </p>
              {isAvailable && (
                <Button
                  onClick={handleConnect}
                  disabled={loading}
                  className="primary-button w-full"
                >
                  {loading ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm sm:text-base">Connecting...</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <Activity className="w-4 h-4" />
                      <span className="text-sm sm:text-base">Connect Health Connect</span>
                    </div>
                  )}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-2 p-2 sm:p-3 bg-green-500/10 rounded-lg border border-green-500/20">
              <Check className="w-4 h-4 text-green-400" />
              <span className="text-xs sm:text-sm text-green-400 font-medium">Connected to Health Connect</span>
            </div>
            
            {healthData && (
              <div className="space-y-3">
                {/* Steps Section */}
                <div className="p-3 sm:p-4 bg-muted/20 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-left">
                      <h3 className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-1">
                        <Footprints className="w-3 h-3" />
                        Today's Steps
                      </h3>
                      <p className="text-xl sm:text-2xl font-bold text-primary">
                        {healthData.steps.toLocaleString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleRefreshData}
                      disabled={isRefreshing}
                      className="h-8 w-8 text-muted-foreground hover:text-primary hover:scale-110 transition-all duration-300"
                    >
                      <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                  
                  <div className="w-full bg-muted/30 rounded-full h-2 mt-3">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${Math.min((healthData.steps / 10000) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Goal: 10,000 steps</p>
                </div>

                {/* Calories Section */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-muted/20 rounded-lg">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Flame className="w-3 h-3 text-orange-500" />
                        <h4 className="text-xs font-medium text-muted-foreground">Active</h4>
                      </div>
                      <p className="text-lg font-bold text-orange-500">
                        {Math.round(healthData.activeCalories)}
                      </p>
                      <p className="text-xs text-muted-foreground">kcal</p>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-muted/20 rounded-lg">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Flame className="w-3 h-3 text-red-500" />
                        <h4 className="text-xs font-medium text-muted-foreground">Total</h4>
                      </div>
                      <p className="text-lg font-bold text-red-500">
                        {Math.round(healthData.totalCalories)}
                      </p>
                      <p className="text-xs text-muted-foreground">kcal</p>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  Last updated: {new Date(healthData.lastUpdated).toLocaleTimeString()}
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StepsSection;
