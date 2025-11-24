import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Calculator, Save, User, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/manualClient";
import { Link } from "react-router-dom";

const Profile = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [profile, setProfile] = useState({
    name: "",
    age: "",
    weight: "",
    height: "",
    activityLevel: "active",
    gender: "male",
    goal: "maintain"
  });

  const [calculatedGoal, setCalculatedGoal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // Load profile data
  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (data) {
        setProfile({
          name: data.name || "",
          age: data.age?.toString() || "",
          weight: data.weight?.toString() || "",
          height: data.height?.toString() || "",
          activityLevel: "active",
          gender: "male",
          goal: "maintain"
        });
      }
    };

    loadProfile();
  }, [user]);

  const calculateCalorieGoal = () => {
    const weight = parseFloat(profile.weight);
    const height = parseFloat(profile.height);
    const age = parseInt(profile.age);

    if (!weight || !height || !age) {
      toast({
        title: "Invalid Input",
        description: "Please fill in all fields with valid numbers.",
        variant: "destructive"
      });
      return;
    }

    // Mifflin-St Jeor Equation
    let bmr;
    if (profile.gender === "male") {
      bmr = 10 * weight + 6.25 * height - 5 * age + 5;
    } else {
      bmr = 10 * weight + 6.25 * height - 5 * age - 161;
    }

    // Activity multipliers
    const activityMultipliers = {
      sedentary: 1.2,
      active: 1.55,
      very_active: 1.725
    };

    const tdee = bmr * activityMultipliers[profile.activityLevel as keyof typeof activityMultipliers];

    // Goal adjustments
    let goalCalories = tdee;
    switch (profile.goal) {
      case "lose":
        goalCalories = tdee - 500;
        break;
      case "gain":
        goalCalories = tdee + 500;
        break;
      default:
        goalCalories = tdee;
    }

    setCalculatedGoal(Math.round(goalCalories));
  };

  const handleSave = async () => {
    if (!user) return;
    
    setLoading(true);
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: profile.name,
          age: parseInt(profile.age) || null,
          weight: parseFloat(profile.weight) || null,
          height: parseFloat(profile.height) || null,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Profile Updated!",
        description: "Your profile information has been saved successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save profile. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="icon" className="text-foreground hover:bg-accent">
              <ArrowLeft className="w-6 h-6" />
            </Button>
          </Link>
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <User className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-medium text-foreground">👤 Profile</h1>
        </div>

        {/* Personal Information */}
        <div className="glass-card p-4">
          <h3 className="text-base font-medium text-foreground mb-4">Personal Information</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-foreground text-sm">Name</Label>
                <Input
                  id="name"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  placeholder="Your name"
                  className="bg-background/50 border-border text-foreground placeholder:text-muted-foreground rounded-xl h-12 backdrop-blur-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="age" className="text-foreground text-sm">Age</Label>
                <Input
                  id="age"
                  type="number"
                  value={profile.age}
                  onChange={(e) => setProfile({ ...profile, age: e.target.value })}
                  placeholder="Years"
                  className="bg-background/50 border-border text-foreground placeholder:text-muted-foreground rounded-xl h-12 backdrop-blur-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="weight" className="text-foreground text-sm">Weight (kg)</Label>
                <Input
                  id="weight"
                  type="number"
                  value={profile.weight}
                  onChange={(e) => setProfile({ ...profile, weight: e.target.value })}
                  placeholder="Kilograms"
                  className="bg-background/50 border-border text-foreground placeholder:text-muted-foreground rounded-xl h-12 backdrop-blur-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="height" className="text-foreground text-sm">Height (cm)</Label>
                <Input
                  id="height"
                  type="number"
                  value={profile.height}
                  onChange={(e) => setProfile({ ...profile, height: e.target.value })}
                  placeholder="Centimeters"
                  className="bg-background/50 border-border text-foreground placeholder:text-muted-foreground rounded-xl h-12 backdrop-blur-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="gender" className="text-foreground text-sm">Gender</Label>
                <Select 
                  value={profile.gender} 
                  onValueChange={(value) => setProfile({ ...profile, gender: value })}
                >
                  <SelectTrigger className="bg-background/50 border-border text-foreground rounded-xl h-12 backdrop-blur-sm [&>svg]:text-muted-foreground">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border backdrop-blur-xl">
                    <SelectItem value="male" className="text-foreground hover:bg-accent focus:bg-accent">Male</SelectItem>
                    <SelectItem value="female" className="text-foreground hover:bg-accent focus:bg-accent">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="activityLevel" className="text-foreground text-sm">Activity Level</Label>
                <Select 
                  value={profile.activityLevel} 
                  onValueChange={(value) => setProfile({ ...profile, activityLevel: value })}
                >
                  <SelectTrigger className="bg-background/50 border-border text-foreground rounded-xl h-12 backdrop-blur-sm [&>svg]:text-muted-foreground">
                    <SelectValue placeholder="Select activity level" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border backdrop-blur-xl">
                    <SelectItem value="sedentary" className="text-foreground hover:bg-accent focus:bg-accent">Sedentary</SelectItem>
                    <SelectItem value="active" className="text-foreground hover:bg-accent focus:bg-accent">Active</SelectItem>
                    <SelectItem value="very_active" className="text-foreground hover:bg-accent focus:bg-accent">Very Active</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="goal" className="text-foreground text-sm">Goal</Label>
              <Select 
                value={profile.goal} 
                onValueChange={(value) => setProfile({ ...profile, goal: value })}
              >
                <SelectTrigger className="bg-background/50 border-border text-foreground rounded-xl h-12 backdrop-blur-sm [&>svg]:text-muted-foreground">
                  <SelectValue placeholder="Select your goal" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border backdrop-blur-xl">
                  <SelectItem value="lose" className="text-foreground hover:bg-accent focus:bg-accent">Lose Weight</SelectItem>
                  <SelectItem value="maintain" className="text-foreground hover:bg-accent focus:bg-accent">Maintain Weight</SelectItem>
                  <SelectItem value="gain" className="text-foreground hover:bg-accent focus:bg-accent">Gain Weight</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Calorie Goal Calculator */}
        <div className="glass-card p-4">
          <h3 className="text-base font-medium text-foreground mb-4">Calorie Goal Calculator</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Calculate your daily calorie goal based on your personal information and activity level.
          </p>
          
          <Button 
            onClick={calculateCalorieGoal}
            className="w-full primary-button h-12 mb-4"
          >
            <Calculator className="w-4 h-4 mr-2" />
            Calculate Calorie Goal
          </Button>

          {calculatedGoal && (
            <div className="p-4 bg-primary/20 border border-primary/30 rounded-xl">
              <h4 className="font-semibold text-primary mb-2">Recommended Daily Calorie Goal</h4>
              <div className="text-3xl font-bold text-primary mb-2">{calculatedGoal} calories</div>
              <p className="text-sm text-muted-foreground">
                This is based on your current profile settings and {profile.goal} goal.
              </p>
            </div>
          )}
        </div>

        {/* Health Metrics Summary */}
        <div className="glass-card p-4">
          <h3 className="text-base font-medium text-foreground mb-4">Health Summary</h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 bg-background/50 rounded-lg border border-border">
              <div className="text-xl font-bold text-foreground">
                {profile.weight ? parseFloat(profile.weight).toFixed(1) : "--"}
              </div>
              <p className="text-xs text-muted-foreground">Weight (kg)</p>
            </div>
            
            <div className="p-3 bg-background/50 rounded-lg border border-border">
              <div className="text-xl font-bold text-foreground">
                {profile.height ? parseFloat(profile.height).toFixed(0) : "--"}
              </div>
              <p className="text-xs text-muted-foreground">Height (cm)</p>
            </div>
            
            <div className="p-3 bg-background/50 rounded-lg border border-border">
              <div className="text-xl font-bold text-primary">
                {profile.weight && profile.height 
                  ? (parseFloat(profile.weight) / Math.pow(parseFloat(profile.height) / 100, 2)).toFixed(1)
                  : "--"
                }
              </div>
              <p className="text-xs text-muted-foreground">BMI</p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="pt-4">
          <Button 
            onClick={handleSave} 
            className="w-full primary-button h-12"
            disabled={loading}
          >
            <Save className="w-4 h-4 mr-2" />
            {loading ? 'Saving...' : 'Save Profile'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Profile;
