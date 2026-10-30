-- Habit categories become names people choose and rename, instead of a fixed list.
alter table public.checklist_items drop constraint if exists checklist_items_category_check;

update public.checklist_items set category = initcap(category) where category is not null;

alter table public.checklist_items
  add constraint checklist_items_category_check check (char_length(category) between 1 and 30);
