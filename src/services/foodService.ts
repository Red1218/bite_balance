import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

export type IndianFood = Database['public']['Tables']['indian_foods']['Row'];
export type NewIndianFood = Database['public']['Tables']['indian_foods']['Insert'];

/**
 * Searches the Indian Foods database using the search_foods SQL function.
 * This respects RLS, matching on name and aliases.
 */
export async function searchFoodsDb(query: string): Promise<IndianFood[]> {
  if (!query || query.trim().length < 2) return [];
  
  const { data, error } = await supabase.rpc('search_foods', {
    search_query: query.trim(),
  });

  if (error) {
    console.error('Error in searchFoodsDb:', error);
    throw error;
  }

  return data as unknown as IndianFood[];
}

/**
 * Fetches all custom foods created by the logged-in user.
 */
export async function getCustomFoods(): Promise<IndianFood[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User must be authenticated');

  const { data, error } = await supabase
    .from('indian_foods')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_verified', false)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching custom foods:', error);
    throw error;
  }

  return data || [];
}

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

/**
 * Updates an existing custom food.
 */
export async function updateCustomFood(
  id: string,
  food: Partial<Omit<NewIndianFood, 'id' | 'is_verified' | 'user_id' | 'created_at'>>
): Promise<IndianFood> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User must be authenticated');

  const { data, error } = await supabase
    .from('indian_foods')
    .update(food)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating custom food:', error);
    throw error;
  }

  return data;
}

/**
 * Deletes a custom food owned by the user.
 */
export async function deleteCustomFood(id: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User must be authenticated');

  const { error } = await supabase
    .from('indian_foods')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('Error deleting custom food:', error);
    throw error;
  }
}
