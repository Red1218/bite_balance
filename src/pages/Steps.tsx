import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { RefreshCw, Check, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const Steps = () => {
  const [googleFitConnected, setGoogleFitConnected] = useState(false);
  const [onePlusConnected, setOnePlusConnected] = useState(false);
  const [googleFitLoading, setGoogleFitLoading] = useState(false);
  const [onePlusLoading, setOnePlusLoading] = useState(false);
  const [stepCount, setStepCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleGoogleFitConnect = async () => {
    setGoogleFitLoading(true);
    
    // Simulate OAuth process
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setGoogleFitConnected(true);
    setGoogleFitLoading(false);
    setStepCount(Math.floor(Math.random() * 5000) + 5000);
  };

  const handleOnePlusConnect = async () => {
    setOnePlusLoading(true);
    
    // Simulate OAuth process
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setOnePlusConnected(true);
    setOnePlusLoading(false);
    setStepCount(Math.floor(Math.random() * 5000) + 5000);
  };

  const handleRefreshSteps = async () => {
    setIsRefreshing(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const newSteps = Math.floor(Math.random() * 5000) + 5000;
    setStepCount(newSteps);
    setIsRefreshing(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link to="/">
            <Button variant="ghost" size="icon" className="text-foreground hover:bg-accent">
              <ArrowLeft className="w-6 h-6" />
            </Button>
          </Link>
          <h1 className="text-xl font-medium text-foreground">Track Your Steps</h1>
        </div>

        <div className="glass-card p-6 space-y-6">
          {/* Google Fit Connection */}
          <div className="space-y-3">
            {googleFitConnected ? (
              <div className="flex items-center justify-center space-x-2 p-4 bg-green-500/20 rounded-xl border border-green-500/30">
                <Check className="w-5 h-5 text-green-400" />
                <span className="text-green-300 font-medium">Connected to Google Fit</span>
              </div>
            ) : (
              <>
                <Button
                  onClick={handleGoogleFitConnect}
                  disabled={googleFitLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white transition-colors h-12 rounded-xl"
                >
                  {googleFitLoading ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Connecting...</span>
                    </div>
                  ) : (
                    "Connect to Google Fit"
                  )}
                </Button>
                <p className="text-xs text-muted-foreground text-center">Requires permission to access step data</p>
              </>
            )}
          </div>

          {/* OnePlus Health Connection */}
          <div className="space-y-3">
            {onePlusConnected ? (
              <div className="flex items-center justify-center space-x-2 p-4 bg-green-500/20 rounded-xl border border-green-500/30">
                <Check className="w-5 h-5 text-green-400" />
                <span className="text-green-300 font-medium">Connected to OnePlus Health</span>
              </div>
            ) : (
              <>
                <Button
                  onClick={handleOnePlusConnect}
                  disabled={onePlusLoading}
                  className="w-full bg-red-600 hover:bg-red-700 text-white transition-colors h-12 rounded-xl"
                >
                  {onePlusLoading ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Connecting...</span>
                    </div>
                  ) : (
                    "Connect to OnePlus Health"
                  )}
                </Button>
                <p className="text-xs text-muted-foreground text-center">Requires permission to access step data</p>
              </>
            )}
          </div>

          {/* Step Count Display */}
          {(googleFitConnected || onePlusConnected) && (
            <div className="mt-6 p-4 bg-background/50 rounded-xl border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Today's Steps</h3>
                  <p className="text-3xl font-bold text-primary">{stepCount.toLocaleString()}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRefreshSteps}
                  disabled={isRefreshing}
                  className="h-10 w-10 text-muted-foreground hover:text-foreground hover:scale-110 transition-all duration-300"
                >
                  <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Steps;
