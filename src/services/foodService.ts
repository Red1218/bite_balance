import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

export type IndianFood = Database['public']['Tables']['indian_foods']['Row'];
export type NewIndianFood = Database['public']['Tables']['indian_foods']['Insert'];

/**
 * Inserts a new custom food for the authenticated user.
 */
export async function createCustomFood(
  food: Omit<NewIndianFood, 'id' | 'is_verified' | 'user_id' | 'created_at'>
): Promise<IndianFood> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User must be authenticated');

  const { data, error } = await supabase
    .from('indian_foods')
    .insert({
      ...food,
      user_id: user.id,
      is_verified: false,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating custom food:', error);
    throw error;
  }

  return data;
}
