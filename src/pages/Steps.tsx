import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Activity, Footprints, Calendar as CalendarIcon, RefreshCw } from 'lucide-react';
import { useHealthConnect } from '@/hooks/useHealthConnect';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import ActivityCalendarDrawer from '@/components/ActivityCalendarDrawer';

const STEP_GOAL = 10000;

const glassTooltipStyle = {
  borderRadius: 12,
  border: '1px solid hsl(var(--border))',
  background: 'hsl(var(--card) / 0.85)',
  backdropFilter: 'blur(20px) saturate(1.4)',
  color: 'hsl(var(--foreground))',
  fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
  fontSize: 12,
  boxShadow: '0 1px 0 hsl(0 0% 100% / 0.07) inset, 0 24px 48px -20px hsl(0 0% 0% / 0.9)',
};

const Steps = () => {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
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

  const last7Steps = healthData?.history?.steps.slice(-7) ?? [];
  const goalDays = healthData?.history?.steps ?? [];
  const daysMet = goalDays.filter((d) => d.steps >= STEP_GOAL).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">Activity</h1>
        {isConnected && healthData && (
          <div className="flex-none rounded-full border border-border bg-card px-3 py-1.5 font-sans text-[11px] font-medium text-muted-foreground">
            Synced {new Date(healthData.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>

      {!isAvailable ? (
        <div className="elevation-card flex flex-col items-center gap-4 p-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Activity className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-foreground">Health Connect not available</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Health Connect is not available on this device. Please ensure you have Android 14+ and Health
              Connect installed from Google Play Store.
            </p>
          </div>
        </div>
      ) : !isConnected ? (
        <div className="elevation-card flex flex-col items-center gap-4 p-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/14 border border-primary/30">
            <Activity className="h-8 w-8 text-primary" />
          </div>
          <div className="w-full">
            <h2 className="font-display text-lg font-semibold text-foreground">Connect Health Connect</h2>
            <p className="mt-2 mb-4 text-sm text-muted-foreground">
              Connect to automatically track your steps and calories from all your fitness apps and devices in
              one place.
            </p>
            <Button
              onClick={handleConnect}
              disabled={loading}
              className="h-12 w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Connecting...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Connect Health Connect
                </span>
              )}
            </Button>
          </div>
        </div>
      ) : (
        healthData && (
          <div className="space-y-5">
            {/* Hero */}
            <div className="elevation-glass flex flex-col gap-[15px] rounded-[20px] p-[18px]">
              <div className="flex items-end justify-between">
                <div>
                  <div className="flex items-center gap-2 font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    <Footprints className="h-3.5 w-3.5" />
                    Steps today
                    <button
                      type="button"
                      onClick={handleRefresh}
                      disabled={loading}
                      aria-label="Refresh"
                      className="text-muted-foreground/70 transition-colors hover:text-foreground"
                    >
                      <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                  <div className="mt-2 font-mono text-[40px] font-bold leading-none tracking-[-0.04em] tabular-nums text-foreground">
                    {healthData.steps.toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-base font-semibold tabular-nums text-chart-steps">
                    {Math.round((healthData.steps / STEP_GOAL) * 100)}%
                  </div>
                  <div className="mt-1 font-sans text-[10px] text-muted-foreground">
                    of {STEP_GOAL.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-chart-steps transition-all duration-500"
                  style={{ width: `${Math.min((healthData.steps / STEP_GOAL) * 100, 100)}%` }}
                />
              </div>

              <div className="grid grid-cols-3 gap-3 border-t border-border pt-3.5">
                <div>
                  <div className="font-sans text-[10px] text-muted-foreground">Distance</div>
                  <div className="mt-1.5 font-mono text-base font-semibold tabular-nums text-foreground">
                    {/* ponytail: no GPS distance source, estimated from steps at ~0.78m stride */}
                    {(healthData.steps * 0.00078).toFixed(1)}
                    <span className="font-sans text-[10px] font-medium text-muted-foreground"> km</span>
                  </div>
                </div>
                <div>
                  <div className="font-sans text-[10px] text-muted-foreground">Burned</div>
                  <div className="mt-1.5 font-mono text-base font-semibold tabular-nums text-chart-steps">
                    {Math.round(healthData.activeCalories)}
                    <span className="font-sans text-[10px] font-medium text-muted-foreground"> kcal</span>
                  </div>
                </div>
                <div>
                  <div className="font-sans text-[10px] text-muted-foreground">Active</div>
                  <div className="mt-1.5 font-mono text-base font-semibold tabular-nums text-foreground">
                    {Math.round(healthData.totalCalories)}
                    <span className="font-sans text-[10px] font-medium text-muted-foreground"> kcal</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Last 7 days */}
            {last7Steps.length > 0 && (
              <div className="elevation-card flex flex-col gap-3.5 p-[15px]">
                <div className="flex items-baseline justify-between">
                  <div className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Last 7 days
                  </div>
                  <div className="font-mono text-[11px] tabular-nums text-muted-foreground">
                    avg{' '}
                    {Math.round(
                      last7Steps.reduce((sum, d) => sum + d.steps, 0) / last7Steps.length
                    ).toLocaleString()}
                  </div>
                </div>
                <div className="h-32 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={last7Steps.map((d) => ({ ...d, day: new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' }) }))}>
                      <XAxis
                        dataKey="day"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={10}
                        fontFamily='"IBM Plex Mono", ui-monospace, monospace'
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip cursor={{ fill: 'hsl(var(--muted) / 0.3)' }} contentStyle={glassTooltipStyle} />
                      <ReferenceLine y={STEP_GOAL} stroke="hsl(var(--chart-steps) / 0.5)" strokeDasharray="3 3" />
                      <Bar dataKey="steps" fill="hsl(var(--chart-steps))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Goal met heat grid */}
            {goalDays.length > 0 && (
              <button
                type="button"
                onClick={() => setIsCalendarOpen(true)}
                className="elevation-card flex w-full flex-col gap-3.5 p-[15px] text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    Goal met
                  </div>
                  <div className="font-mono text-[11px] tabular-nums text-chart-steps">
                    {daysMet} of {goalDays.length} days
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {goalDays.slice(-14).map((d) => {
                    const opacity = Math.max(0.14, Math.min(d.steps / STEP_GOAL, 1));
                    const isToday = new Date(d.date).toDateString() === new Date().toDateString();
                    return (
                      <div
                        key={d.date}
                        className="flex aspect-square items-center justify-center rounded-lg font-mono text-xs tabular-nums"
                        style={{
                          background: `hsl(var(--chart-steps) / ${opacity})`,
                          color: opacity > 0.55 ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
                          boxShadow: isToday ? '0 0 0 2px hsl(var(--foreground) / 0.5)' : undefined,
                        }}
                      >
                        {new Date(d.date).getDate()}
                      </div>
                    );
                  })}
                </div>
              </button>
            )}

            <p className="text-center text-xs text-muted-foreground">
              Last updated: {new Date(healthData.lastUpdated).toLocaleTimeString()}
            </p>
          </div>
        )
      )}

      <ActivityCalendarDrawer healthData={healthData} open={isCalendarOpen} onOpenChange={setIsCalendarOpen} />
    </div>
  );
};

export default Steps;
