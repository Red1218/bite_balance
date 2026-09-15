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

/**
 * Lists the authenticated user's own custom foods, most recently saved first.
 */
export async function getMyCustomFoods(): Promise<IndianFood[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User must be authenticated');

  const { data, error } = await supabase
    .from('indian_foods')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching custom foods:', error);
    throw error;
  }

  return data || [];
}

export async function deleteCustomFood(id: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User must be authenticated');

  const { error } = await supabase.from('indian_foods').delete().eq('id', id).eq('user_id', user.id);
  if (error) {
    console.error('Error deleting custom food:', error);
    throw error;
  }
}

/**
 * Checks whether a saved meal or custom food with this name already exists for
 * the current user, across both collections -- so saving from either the Add
 * Meal "reusable food" flow or the Saved Meals form can warn before duplicating.
 */
export async function findExistingSavedItemByName(
  name: string
): Promise<{ type: 'meal' | 'food'; id: string } | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: meals }, { data: foods }] = await Promise.all([
    supabase.from('saved_meals').select('id').eq('user_id', user.id).ilike('name', name).limit(1),
    supabase.from('indian_foods').select('id').eq('user_id', user.id).ilike('name', name).limit(1),
  ]);

  if (meals?.[0]) return { type: 'meal', id: meals[0].id };
  if (foods?.[0]) return { type: 'food', id: foods[0].id };
  return null;
}
