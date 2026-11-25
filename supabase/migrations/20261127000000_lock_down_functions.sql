-- Security advisor warnings:
-- search_foods ran with whatever search_path the caller had; pin it to public.
alter function public.search_foods(text) set search_path = public;
-- These two are trigger functions; nobody should call them over the API.
-- Triggers still fire: EXECUTE is only checked when a trigger is created.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_updated_at() from public, anon, authenticated;
