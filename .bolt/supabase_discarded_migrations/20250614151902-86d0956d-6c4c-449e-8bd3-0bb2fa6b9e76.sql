
-- Add fiber column to daily_meals table
ALTER TABLE public.daily_meals 
ADD COLUMN fiber numeric DEFAULT 0;

-- Add fiber column to saved_meals table  
ALTER TABLE public.saved_meals 
ADD COLUMN fiber numeric DEFAULT 0;
