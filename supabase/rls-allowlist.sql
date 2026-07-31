-- ============================================================================
-- Tighten Row Level Security from "any logged-in user" to an ALLOW-LIST:
--   • anyone with an @astrico.ai email, plus
--   • explicit extra emails (astricoai@gmail.com).
-- Enforced in the database itself, so it holds even if the app is bypassed.
-- Re-run any time the allow-list changes (edit the two arrays below).
-- ============================================================================

create or replace function public.is_allowed_user()
returns boolean
language sql
stable
as $$
  select coalesce(
    split_part(lower(auth.jwt() ->> 'email'), '@', 2) = any (array['astrico.ai'])   -- allowed domains
    or lower(auth.jwt() ->> 'email')                    = any (array['astricoai@gmail.com']), -- allowed emails
    false
  );
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'clients','projects','billable_items','purchase_orders','client_documents','audit_log'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists authed_all   on public.%I;', t);
    execute format('drop policy if exists allowlist_all on public.%I;', t);
    execute format(
      'create policy allowlist_all on public.%I for all to authenticated '
      || 'using (public.is_allowed_user()) with check (public.is_allowed_user());', t
    );
  end loop;
end $$;
