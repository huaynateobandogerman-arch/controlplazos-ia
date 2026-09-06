-- Preparado para ejecutar manualmente más adelante. No ejecutado por la aplicación.
begin;
create table if not exists public.casos (
  id uuid primary key default gen_random_uuid(),
  caso text not null unique check (length(btrim(caso)) > 0 and caso = btrim(caso)),
  unidad text not null,
  responsable text not null,
  fecha_vencimiento date not null,
  estado text not null,
  observacion text not null default '',
  created_at timestamptz not null default now()
);
alter table public.casos enable row level security;
revoke all on table public.casos from anon, authenticated;
grant select, insert, update on table public.casos to service_role;
-- Sin políticas públicas: solo el backend usa service_role.
notify pgrst, 'reload schema';
commit;
