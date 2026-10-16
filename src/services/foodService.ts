import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

export type IndianFood = Database['public']['Tables']['indian_foods']['Row'];
export type NewIndianFood = Database['public']['Tables']['indian_foods']['Insert'];

export const categories = [
  { id: 'rice_grains', name: 'Rice & Grains', icon: '🍚' },
  { id: 'south_indian', name: 'South Indian', icon: '🥞' },
  { id: 'north_indian', name: 'North Indian', icon: '🫓' },
  { id: 'curries', name: 'Curries', icon: '🍛' },
  { id: 'vegetables', name: 'Vegetables', icon: '🥦' },
  { id: 'fruits', name: 'Fruits', icon: '🍎' },
  { id: 'dairy', name: 'Dairy', icon: '🧀' },
  { id: 'eggs', name: 'Eggs', icon: '🥚' },
  { id: 'chicken', name: 'Chicken', icon: '🍗' },
  { id: 'meat', name: 'Meat', icon: '🥩' },
  { id: 'seafood', name: 'Seafood', icon: '🐟' },
  { id: 'snacks', name: 'Snacks', icon: '🥟' },
  { id: 'beverages', name: 'Beverages', icon: '☕' },
];

async function requireUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User must be authenticated');
  return user;
}

/**
 * Inserts a new custom food for the authenticated user.
 */
export async function createCustomFood(
  food: Omit<NewIndianFood, 'id' | 'is_verified' | 'user_id' | 'created_at'>
): Promise<IndianFood> {
  const user = await requireUser();

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
 * Adds search aliases to a food. Aliases are unique across all users, so each is inserted on
 * its own: one clash is logged and skipped instead of losing the rest.
 */
export async function addFoodAliases(foodId: string, aliases: string[]): Promise<void> {
  for (const alias of aliases) {
    const { error } = await supabase.from('food_aliases').insert({ food_id: foodId, alias });
    if (error) console.warn('Failed to insert alias:', alias, error);
  }
}

/**
 * Lists the authenticated user's own custom foods, most recently saved first.
 */
export async function getMyCustomFoods(): Promise<IndianFood[]> {
  const user = await requireUser();

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

export type CustomFoodUpdate = Partial<Omit<NewIndianFood, 'id' | 'is_verified' | 'user_id' | 'created_at'>>;

export async function updateCustomFood(id: string, updates: CustomFoodUpdate): Promise<IndianFood> {
  const user = await requireUser();

  const { data, error } = await supabase
    .from('indian_foods')
    .update(updates)
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

export async function deleteCustomFood(id: string): Promise<void> {
  const user = await requireUser();

  const { error } = await supabase.from('indian_foods').delete().eq('id', id).eq('user_id', user.id);
  if (error) {
    console.error('Error deleting custom food:', error);
    throw error;
  }
}

export async function deleteCustomFoods(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const user = await requireUser();

  const { error } = await supabase.from('indian_foods').delete().in('id', ids).eq('user_id', user.id);
  if (error) {
    console.error('Error deleting custom foods:', error);
    throw error;
  }
}

/**
 * Checks whether a saved meal or custom food with this name already exists for
 * the current user, across both collections -- so saving from either the Add
 * Meal "reusable food" flow or the Saved Meals form can warn before duplicating.
 */
async function findExistingSavedItemByName(
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

/**
 * Asks before saving under a name that's already taken; true means go ahead.
 * selfId: the item being edited, which isn't a duplicate of itself.
 */
export async function confirmNotDuplicate(name: string, selfId?: string): Promise<boolean> {
  const existing = await findExistingSavedItemByName(name);
  if (!existing || existing.id === selfId) return true;
  const kind = existing.type === 'meal' ? 'saved meal' : 'custom food';
  return window.confirm(`You already have a ${kind} named "${name}". Save this anyway?`);
}
