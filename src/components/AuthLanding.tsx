import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff } from 'lucide-react';
import LogoMark from '@/components/LogoMark';

const AuthLanding = () => {
  const [activeTab, setActiveTab] = useState('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    age: '',
    weight: '',
    height: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (activeTab === 'signup') {
        const userData = {
          name: formData.name,
          age: parseInt(formData.age) || null,
          weight: parseFloat(formData.weight) || null,
          height: parseFloat(formData.height) || null,
        };
        const { error } = await signUp(formData.email, formData.password, userData);
        if (error) {
          toast({ title: 'Sign up failed', description: error.message, variant: 'destructive' });
        } else {
          toast({ title: 'Account created', description: 'Please sign in to continue.' });
          setFormData({ email: formData.email, password: '', name: '', age: '', weight: '', height: '' });
          setActiveTab('signin');
        }
      } else {
        const { error } = await signIn(formData.email, formData.password);
        if (error) {
          toast({ title: 'Sign in failed', description: error.message, variant: 'destructive' });
        } else {
          toast({ title: 'Welcome back', description: "You've been signed in successfully." });
        }
      }
    } catch {
      toast({ title: 'Error', description: 'Something went wrong. Please try again.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const inputClass =
    'h-12 rounded-xl bg-secondary/60 border-border focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary/50';

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div
        className="pointer-events-none absolute -left-16 -top-32 h-96 w-96 rounded-full"
        style={{ background: 'radial-gradient(circle, hsl(var(--primary) / 0.22), transparent 68%)' }}
      />
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-8 px-6 py-12">
        <div className="flex flex-col gap-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-[0_14px_32px_-12px_hsl(var(--primary)/0.95)]">
            <LogoMark size={32} />
          </div>
          <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight">
            Eat by the
            <br />
            numbers.
          </h1>
          <p className="max-w-[300px] text-base leading-relaxed text-muted-foreground">
            Track calories and macros for 1,200+ Indian foods — dosa to dal, in katoris and
            rotis, not grams you have to guess.
          </p>
          <div className="mt-1 flex gap-5">
            <div>
              <div className="font-mono text-2xl font-bold tabular-nums">
                1,200<span className="font-sans text-sm font-semibold text-primary">+</span>
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">Indian foods</div>
            </div>
            <div className="w-px bg-border" />
            <div>
              <div className="font-mono text-2xl font-bold tabular-nums">4</div>
              <div className="mt-1 text-[11px] text-muted-foreground">taps to log</div>
            </div>
            <div className="w-px bg-border" />
            <div>
              <div className="font-mono text-2xl font-bold tabular-nums">0</div>
              <div className="mt-1 text-[11px] text-muted-foreground">ads, ever</div>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 rounded-xl bg-secondary p-1">
            <TabsTrigger value="signin" className="rounded-lg">Sign in</TabsTrigger>
            <TabsTrigger value="signup" className="rounded-lg">Sign up</TabsTrigger>
          </TabsList>

          <TabsContent value="signin" className="mt-5">
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="signin-email">Email</Label>
                <Input
                  id="signin-email"
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="signin-password">Password</Label>
                <div className="relative">
                  <Input
                    id="signin-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    required
                    minLength={6}
                    className={inputClass}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1.5 top-1/2 h-8 w-8 -translate-y-1/2"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <Button type="submit" className="mt-2 h-[52px] rounded-xl text-base font-semibold" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup" className="mt-5">
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="signup-name">Name</Label>
                <Input
                  id="signup-name"
                  placeholder="Your full name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <div className="space-y-1.5">
                  <Label htmlFor="signup-age">Age</Label>
                  <Input
                    id="signup-age"
                    type="number"
                    placeholder="25"
                    value={formData.age}
                    onChange={(e) => handleInputChange('age', e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-weight">Weight (kg)</Label>
                  <Input
                    id="signup-weight"
                    type="number"
                    step="0.1"
                    placeholder="70"
                    value={formData.weight}
                    onChange={(e) => handleInputChange('weight', e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-height">Height (cm)</Label>
                  <Input
                    id="signup-height"
                    type="number"
                    placeholder="175"
                    value={formData.height}
                    onChange={(e) => handleInputChange('height', e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="signup-password">Password</Label>
                <div className="relative">
                  <Input
                    id="signup-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    required
                    minLength={6}
                    className={inputClass}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1.5 top-1/2 h-8 w-8 -translate-y-1/2"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <Button type="submit" className="mt-2 h-[52px] rounded-xl text-base font-semibold" disabled={loading}>
                {loading ? 'Creating account…' : 'Create free account'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <p className="text-center text-[11px] leading-relaxed text-faint">
          By continuing you agree to our Terms and Privacy Policy.
        </p>
      </div>
    </div>
  );
};

export default AuthLanding;
