create table public.site_visits (
  id uuid primary key default gen_random_uuid(),
  session_id text not null unique
    check (char_length(session_id) between 10 and 100),
  visitor_name text not null
    check (char_length(btrim(visitor_name)) between 2 and 30),
  visited_at timestamptz not null default now()
);

comment on table public.site_visits is 'One timestamped site access per browser tab session; visitor_name is self-entered.';
alter table public.site_visits enable row level security;

revoke all on table public.site_visits from public, anon, authenticated;
grant insert on table public.site_visits to anon, authenticated;
grant select on table public.site_visits to authenticated;

create policy "Visitors can record site visits"
  on public.site_visits
  for insert
  to anon, authenticated
  with check (
    char_length(btrim(visitor_name)) between 2 and 30
    and char_length(session_id) between 10 and 100
  );

create policy "Super admins can read site visits"
  on public.site_visits
  for select
  to authenticated
  using ((select private.is_superadmin()));

create index site_visits_visited_at_idx
  on public.site_visits (visited_at desc);
