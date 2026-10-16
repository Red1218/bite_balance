// Backup: everything the signed-in user owns, as one JSON file.
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { supabase } from '@/integrations/supabase/client';
import { fmtLocalDate } from '@/lib/utils';

// Tables with a user_id column; row-level security limits each to the user's own rows anyway.
const USER_TABLES = [
  'profiles', 'daily_meals', 'saved_meals', 'indian_foods', 'weight_logs', 'water_logs',
  'health_daily', 'checklist_items', 'checklist_checks', 'chat_messages',
] as const;

const PAGE = 1000; // Supabase returns at most 1000 rows per request

const fetchAll = async (table: (typeof USER_TABLES)[number], userId: string) => {
  const rows: unknown[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select('*').eq('user_id', userId).range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE) return rows;
  }
};

export const buildBackup = async (userId: string) => {
  const tables: Record<string, unknown[]> = {};
  for (const table of USER_TABLES) tables[table] = await fetchAll(table, userId);

  // Aliases belong to foods, not users: keep the ones on the user's own foods.
  const foodIds = (tables.indian_foods as { id: string }[]).map((f) => f.id);
  if (foodIds.length) {
    const { data, error } = await supabase.from('food_aliases').select('*').in('food_id', foodIds);
    if (error) throw new Error(`food_aliases: ${error.message}`);
    tables.food_aliases = data;
  }
  return { app: 'Bite Balance', exported_at: new Date().toISOString(), tables };
};

// Writes the backup and hands it to the share sheet (phone) or downloads it (browser).
export const exportBackup = async (userId: string) => {
  const json = JSON.stringify(await buildBackup(userId), null, 2);
  const fileName = `bite-balance-backup-${fmtLocalDate(new Date())}.json`;

  if (!Capacitor.isNativePlatform()) {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: fileName });
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const { uri } = await Filesystem.writeFile({ path: fileName, data: json, directory: Directory.Cache, encoding: Encoding.UTF8 });
  await Share.share({ title: 'Bite Balance backup', files: [uri] });
};
