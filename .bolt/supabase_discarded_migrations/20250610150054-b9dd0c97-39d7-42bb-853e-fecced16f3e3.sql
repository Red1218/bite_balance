
-- First, let's check what policies already exist and only create the missing ones

-- Enable RLS on tables (these commands will succeed even if already enabled)
ALTER TABLE public.daily_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for daily_meals (only if they don't exist)
DO $$ 
BEGIN
    -- Check and create INSERT policy for daily_meals
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'daily_meals' 
        AND policyname = 'Users can create their own daily meals'
    ) THEN
        CREATE POLICY "Users can create their own daily meals" 
          ON public.daily_meals 
          FOR INSERT 
          WITH CHECK (auth.uid() = user_id);
    END IF;

    -- Check and create UPDATE policy for daily_meals
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'daily_meals' 
        AND policyname = 'Users can update their own daily meals'
    ) THEN
        CREATE POLICY "Users can update their own daily meals" 
          ON public.daily_meals 
          FOR UPDATE 
          USING (auth.uid() = user_id);
    END IF;

    -- Check and create DELETE policy for daily_meals
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'daily_meals' 
        AND policyname = 'Users can delete their own daily meals'
    ) THEN
        CREATE POLICY "Users can delete their own daily meals" 
          ON public.daily_meals 
          FOR DELETE 
          USING (auth.uid() = user_id);
    END IF;
END $$;

-- Create policies for saved_meals
DO $$ 
BEGIN
    -- Check and create SELECT policy for saved_meals
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'saved_meals' 
        AND policyname = 'Users can view their own saved meals'
    ) THEN
        CREATE POLICY "Users can view their own saved meals" 
          ON public.saved_meals 
          FOR SELECT 
          USING (auth.uid() = user_id);
    END IF;

    -- Check and create INSERT policy for saved_meals
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'saved_meals' 
        AND policyname = 'Users can create their own saved meals'
    ) THEN
        CREATE POLICY "Users can create their own saved meals" 
          ON public.saved_meals 
          FOR INSERT 
          WITH CHECK (auth.uid() = user_id);
    END IF;

    -- Check and create UPDATE policy for saved_meals
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'saved_meals' 
        AND policyname = 'Users can update their own saved meals'
    ) THEN
        CREATE POLICY "Users can update their own saved meals" 
          ON public.saved_meals 
          FOR UPDATE 
          USING (auth.uid() = user_id);
    END IF;

    -- Check and create DELETE policy for saved_meals
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'saved_meals' 
        AND policyname = 'Users can delete their own saved meals'
    ) THEN
        CREATE POLICY "Users can delete their own saved meals" 
          ON public.saved_meals 
          FOR DELETE 
          USING (auth.uid() = user_id);
    END IF;
END $$;

-- Create policies for profiles
DO $$ 
BEGIN
    -- Check and create SELECT policy for profiles
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' 
        AND policyname = 'Users can view their own profile'
    ) THEN
        CREATE POLICY "Users can view their own profile" 
          ON public.profiles 
          FOR SELECT 
          USING (auth.uid() = user_id);
    END IF;

    -- Check and create UPDATE policy for profiles
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' 
        AND policyname = 'Users can update their own profile'
    ) THEN
        CREATE POLICY "Users can update their own profile" 
          ON public.profiles 
          FOR UPDATE 
          USING (auth.uid() = user_id);
    END IF;

    -- Check and create INSERT policy for profiles (for trigger function)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' 
        AND policyname = 'Allow profile creation via trigger'
    ) THEN
        CREATE POLICY "Allow profile creation via trigger" 
          ON public.profiles 
          FOR INSERT 
          WITH CHECK (true);
    END IF;
END $$;
