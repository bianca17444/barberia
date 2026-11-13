-- ======================================================================
-- 📘 PARA LA DEFENSA — Favoritos (etapa 15).
-- Una MIGRACIÓN es un archivo con cambios de la base de datos, en orden, para poder reconstruirla igual.
-- La estructura principal (profiles, turnos, servicios, pagos, reseñas y sus triggers) se creó en etapas anteriores:
-- se ve en Supabase → Database → Migrations.
--
-- Conceptos SQL que aparecen en todas las migraciones:
--   - create table: crea una tabla. references = clave foránea (relación con otra tabla).
--   - enable row level security (RLS): activa las reglas por fila. Sin una política que lo permita, nadie ve nada.
--   - create policy: una regla. Ej.: usuario_id = auth.uid() → cada uno solo ve SUS filas
--     (auth.uid() es el id del usuario que viene en el token).
--   - revoke / grant: qué operaciones puede hacer cada tipo de usuario (anon = sin sesión, authenticated = con sesión).
--   - index: acelera las búsquedas. unique index: no permite repetidos.
-- ======================================================================
-- BELABARBERÍA · Favoritos (barberos y servicios). Aplicado en Supabase el 23/10/2026.
create table public.favoritos (
  id bigint generated always as identity primary key,
  usuario_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  barbero_id bigint references public.barberos(id) on delete cascade,
  servicio_id bigint references public.servicios(id) on delete cascade,
  creado_at timestamptz not null default now(),
  check ((barbero_id is null) <> (servicio_id is null)),   -- o barbero o servicio
  unique (usuario_id, barbero_id),
  unique (usuario_id, servicio_id)
);
create index favoritos_usuario_idx on public.favoritos (usuario_id);
alter table public.favoritos enable row level security;
-- 📘 Cada cliente solo ve, agrega y quita SUS favoritos (compara usuario_id con el usuario del token).
create policy "ver mis favoritos"     on public.favoritos for select to authenticated using (usuario_id = (select auth.uid()));
create policy "agregar mis favoritos" on public.favoritos for insert to authenticated with check (usuario_id = (select auth.uid()));
create policy "quitar mis favoritos"  on public.favoritos for delete to authenticated using (usuario_id = (select auth.uid()));
revoke all on public.favoritos from anon, public;
grant select, insert, delete on public.favoritos to authenticated;
revoke update, truncate, references, trigger on public.favoritos from authenticated;
