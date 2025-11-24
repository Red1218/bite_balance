import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Heart } from 'lucide-react';
const motivationalQuotes = ["A healthier you starts today.", "Track what fuels you.", "Small habits, big change.", "Consistency over intensity.", "Every bite counts.", "Fuel better, live better."];
const AuthLanding = () => {
  const [activeTab, setActiveTab] = useState("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [currentQuote, setCurrentQuote] = useState(0);
  const [loading, setLoading] = useState(false);
  const {
    signIn,
    signUp
  } = useAuth();
  const {
    toast
  } = useToast();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    age: '',
    weight: '',
    height: ''
  });

  // Rotate quotes every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentQuote(prev => (prev + 1) % motivationalQuotes.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (activeTab === "signup") {
        const userData = {
          name: formData.name,
          age: parseInt(formData.age) || null,
          weight: parseFloat(formData.weight) || null,
          height: parseFloat(formData.height) || null
        };
        const {
          error
        } = await signUp(formData.email, formData.password, userData);
        if (error) {
          toast({
            title: "Sign Up Failed",
            description: error.message,
            variant: "destructive"
          });
        } else {
          toast({
            title: "Account created!",
            description: "Please sign in to continue."
          });
          // Reset form and switch to sign in
          setFormData({
            email: formData.email,
            // Keep email for convenience
            password: '',
            name: '',
            age: '',
            weight: '',
            height: ''
          });
          setActiveTab("signin");
        }
      } else {
        const {
          error
        } = await signIn(formData.email, formData.password);
        if (error) {
          toast({
            title: "Sign In Failed",
            description: error.message,
            variant: "destructive"
          });
        } else {
          toast({
            title: "Welcome back!",
            description: "You've been signed in successfully."
          });
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  return <div className="min-h-screen bg-gradient-to-br from-red-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-8 items-center">
        
        {/* Left side - Branding and Quote */}
        <div className="text-center md:text-left space-y-6">
          <div className="flex items-center justify-center md:justify-start space-x-3">
            <div className="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center">
              <Heart className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-red-700">BiteBalance</h1>
              <p className="text-gray-600">Fuel Better, Live Better</p>
            </div>
          </div>
          
          <div className="bg-white/60 backdrop-blur-sm rounded-lg p-6 border border-red-100">
            <div className="h-16 flex items-center justify-center">
              <p className="text-lg font-medium text-gray-700 text-center transition-all duration-500 transform">
                "{motivationalQuotes[currentQuote]}"
              </p>
            </div>
          </div>
        </div>

        {/* Right side - Auth Form */}
        <Card className="w-full max-w-md mx-auto shadow-xl border-red-100">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">
              Welcome to BiteBalance
            </CardTitle>
            <p className="text-center text-gray-600">
              Start your healthy journey today
            </p>
          </CardHeader>
          
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
              
              <TabsContent value="signin" className="space-y-4 mt-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input id="signin-email" type="email" placeholder="you@example.com" value={formData.email} onChange={e => handleInputChange('email', e.target.value)} required />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <div className="relative">
                      <Input id="signin-password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={formData.password} onChange={e => handleInputChange('password', e.target.value)} required minLength={6} />
                      <Button type="button" variant="ghost" size="sm" className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 p-0" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                  
                  <Button type="submit" className="w-full bg-red-500 hover:bg-red-600" disabled={loading}>
                    {loading ? 'Signing In...' : 'Sign In'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="space-y-4 mt-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Name</Label>
                    <Input id="signup-name" type="text" placeholder="Your full name" value={formData.name} onChange={e => handleInputChange('name', e.target.value)} required />
                  </div>
                  
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="signup-age">Age</Label>
                      <Input id="signup-age" type="number" placeholder="25" value={formData.age} onChange={e => handleInputChange('age', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-weight">Weight (kg)</Label>
                      <Input id="signup-weight" type="number" step="0.1" placeholder="70" value={formData.weight} onChange={e => handleInputChange('weight', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-height">Height (cm)</Label>
                      <Input id="signup-height" type="number" placeholder="175" value={formData.height} onChange={e => handleInputChange('height', e.target.value)} />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input id="signup-email" type="email" placeholder="you@example.com" value={formData.email} onChange={e => handleInputChange('email', e.target.value)} required />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <div className="relative">
                      <Input id="signup-password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={formData.password} onChange={e => handleInputChange('password', e.target.value)} required minLength={6} />
                      <Button type="button" variant="ghost" size="sm" className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 p-0" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                  
                  <Button type="submit" className="w-full bg-red-500 hover:bg-red-600" disabled={loading}>
                    {loading ? 'Creating Account...' : 'Create My Account'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>;
};
export default AuthLanding;