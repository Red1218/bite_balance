import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Activity, Footprints, Flame } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useHealthConnect } from '@/hooks/useHealthConnect';

const Steps = () => {
  const {
    isAvailable,
    isConnected,
    healthData,
    loading,
    requestPermissions,
    fetchHealthData,
  } = useHealthConnect();

  const handleConnect = async () => {
    await requestPermissions();
  };

  const handleRefresh = async () => {
    await fetchHealthData();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link to="/">
            <Button
              variant="ghost"
              size="icon"
              className="text-foreground hover:bg-accent"
            >
              <ArrowLeft className="w-6 h-6" />
            </Button>
          </Link>
          <h1 className="text-xl font-medium text-foreground">
            Health Connect
          </h1>
        </div>

        <div className="glass-card p-6 space-y-6">
          {!isAvailable ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-muted/30 rounded-full flex items-center justify-center mx-auto">
                <Activity className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-2">
                  Health Connect Not Available
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Health Connect is not available on this device. Please ensure
                  you have Android 14+ and Health Connect installed from Google
                  Play Store.
                </p>
              </div>
            </div>
          ) : !isConnected ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <Activity className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-2">
                  Connect to Health Connect
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Connect to Health Connect to automatically track your steps
                  and calories from all your fitness apps and devices in one
                  place.
                </p>
                <Button
                  onClick={handleConnect}
                  disabled={loading}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground transition-colors h-12 rounded-xl"
                >
                  {loading ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Connecting...</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <Activity className="w-5 h-5" />
                      <span>Connect Health Connect</span>
                    </div>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Connection Status */}
              <div className="flex items-center justify-center space-x-2 p-4 bg-green-500/20 rounded-xl border border-green-500/30">
                <Activity className="w-5 h-5 text-green-400" />
                <span className="text-green-300 font-medium">
                  Connected to Health Connect
                </span>
              </div>

              {/* Health Data */}
              {healthData && (
                <div className="space-y-4">
                  {/* Steps Card */}
                  <div className="p-4 bg-background/50 rounded-xl border border-border">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Footprints className="w-5 h-5 text-primary" />
                        <h3 className="font-semibold text-foreground">Steps</h3>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRefresh}
                        disabled={loading}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        Refresh
                      </Button>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-primary mb-2">
                        {healthData.steps.toLocaleString()}
                      </p>
                      <div className="w-full bg-muted/30 rounded-full h-3 mb-2">
                        <div
                          className="bg-primary h-3 rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min((healthData.steps / 10000) * 100, 100)}%`,
                          }}
                        />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {Math.round((healthData.steps / 10000) * 100)}% of
                        10,000 step goal
                      </p>
                    </div>
                  </div>

                  {/* Calories Cards */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-background/50 rounded-xl border border-border">
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <Flame className="w-4 h-4 text-orange-500" />
                          <h4 className="text-sm font-medium text-foreground">
                            Active Calories
                          </h4>
                        </div>
                        <p className="text-2xl font-bold text-orange-500">
                          {Math.round(healthData.activeCalories)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          kcal burned
                        </p>
                      </div>
                    </div>

                    <div className="p-4 bg-background/50 rounded-xl border border-border">
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <Flame className="w-4 h-4 text-red-500" />
                          <h4 className="text-sm font-medium text-foreground">
                            Total Calories
                          </h4>
                        </div>
                        <p className="text-2xl font-bold text-red-500">
                          {Math.round(healthData.totalCalories)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          kcal burned
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground text-center">
                    Last updated:{' '}
                    {new Date(healthData.lastUpdated).toLocaleTimeString()}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Steps;
