-- ======================================================================
-- 📘 PARA LA DEFENSA — Galería y estilos (etapa 18).
--   - Columna "estilos" en servicios y barberos (para "Elegí tu estilo").
--   - Tabla galeria: todos los usuarios con sesión pueden ver; solo el admin sube, edita o borra (políticas con es_admin()).
--   - Bucket "galeria" en Storage con las mismas reglas: solo el admin puede subir archivos.
-- ======================================================================
-- etapa18_galeria_estilos (aplicada en Supabase el 23/10/2026; copia exacta de supabase_migrations.schema_migrations)
-- Estilos (para "Elegí tu estilo" y para clasificar la galería). Los asigna el admin.
alter table public.servicios add column if not exists estilos text[] not null default '{}'
  check (estilos <@ array['FADE','CLASICO','CROP','BARBA','PREMIUM','FORMAL','MODERNO','OTRO']);
alter table public.barberos add column if not exists estilos text[] not null default '{}'
  check (estilos <@ array['FADE','CLASICO','CROP','BARBA','PREMIUM','FORMAL','MODERNO','OTRO']);

-- Galería de trabajos por barbero (fotos en Storage, bucket público de solo lectura)
create table public.galeria (
  id bigint generated always as identity primary key,
  barbero_id bigint not null references public.barberos(id) on delete cascade,
  url text not null check (url ~* '^https://'),
  path text not null unique,
  estilo text not null default 'OTRO' check (estilo in ('FADE','CLASICO','CROP','BARBA','PREMIUM','FORMAL','MODERNO','OTRO')),
  descripcion text check (char_length(descripcion) <= 200),
  creado_at timestamptz not null default now(),
  creado_por uuid references public.profiles(id) on delete set null default auth.uid()
);
create index galeria_barbero_idx on public.galeria (barbero_id, creado_at desc);
create index galeria_estilo_idx on public.galeria (estilo);
alter table public.galeria enable row level security;
create policy "ver galeria" on public.galeria for select to authenticated using (true);
create policy "admin sube a galeria" on public.galeria for insert to authenticated with check (public.es_admin());
create policy "admin edita galeria" on public.galeria for update to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "admin borra de galeria" on public.galeria for delete to authenticated using (public.es_admin());
revoke all on public.galeria from anon, public, authenticated;
grant select, insert, update, delete on public.galeria to authenticated;

-- 📘 Crea el "bucket" (la carpeta de archivos de Storage) para las fotos de la galería.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('galeria', 'galeria', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy "galeria: admin sube" on storage.objects for insert to authenticated with check (bucket_id = 'galeria' and public.es_admin());
create policy "galeria: admin modifica" on storage.objects for update to authenticated using (bucket_id = 'galeria' and public.es_admin()) with check (bucket_id = 'galeria' and public.es_admin());
create policy "galeria: admin borra" on storage.objects for delete to authenticated using (bucket_id = 'galeria' and public.es_admin());
