import { lazy, Suspense } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import AuthLanding from './components/AuthLanding';
import AppLayout from './components/AppLayout';
import { useNativeApp } from './hooks/useNativeApp';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const AddMeal = lazy(() => import('./pages/AddMeal'));
const SavedMeals = lazy(() => import('./pages/SavedMeals'));
const History = lazy(() => import('./pages/History'));
const Steps = lazy(() => import('./pages/Steps'));
const Profile = lazy(() => import('./pages/Profile'));

const RouteFallback = () => (
  <div className="flex min-h-[50vh] items-center justify-center">
    <div className="h-8 w-8 animate-pulse rounded-full bg-primary" />
  </div>
);

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { user, loading } = useAuth();
  useNativeApp();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-pulse rounded-full bg-primary" />
          <p className="text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthLanding />;
  }

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="/add-meal" element={<AddMeal />} />
          <Route path="/saved-meals" element={<SavedMeals />} />
          <Route path="/history" element={<History />} />
          <Route path="/steps" element={<Steps />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
