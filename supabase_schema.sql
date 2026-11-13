-- ==============================================================================
-- ⚠️  ARCHIVO OBSOLETO — NO EJECUTAR
-- ==============================================================================
-- Este script NO coincide con la base real de Supabase y es inseguro:
--   * toma el rol desde los metadatos del registro (cualquiera podría crearse ADMIN);
--   * usa políticas que se consultan a sí mismas (recursión en RLS);
--   * no incluye barberos.usuario_id, horarios_barberos, la regla de 24 h ni las RPC.
-- La estructura vigente está en las migraciones aplicadas en Supabase
-- (Dashboard → Database → Migrations).
-- La siguiente instrucción detiene la ejecución si alguien lo pega en el SQL Editor.
do $$ begin
  raise exception 'supabase_schema.sql está obsoleto. No lo ejecutes: usá las migraciones de Supabase.';
end $$;

-- ==============================================================================
-- ESQUEMA COMPLETO DE BASE DE DATOS PARA BARBERÍA (SUPABASE)
-- Copia y pega este script en el SQL Editor de tu proyecto en Supabase
-- ==============================================================================

-- 1. EXTENSIONES
create extension if not exists "uuid-ossp";

-- 2. TABLA: PROFILES
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  nombre text,
  apellido text,
  telefono text,
  rol text not null default 'USUARIO' check (rol in ('USUARIO', 'ADMIN')),
  avatar_url text,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Habilitar RLS en profiles
alter table public.profiles enable row level security;

-- Políticas RLS para profiles
create policy "Los usuarios pueden ver su propio perfil y los admins pueden ver todos"
  on public.profiles for select
  using (
    auth.uid() = id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.rol = 'ADMIN'
    )
  );

create policy "Los usuarios pueden actualizar su propio perfil"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Permitir inserción de perfil para el usuario autenticado"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Trigger para crear perfil automáticamente cuando un usuario se registra en auth.users
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, nombre, apellido, telefono, rol, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', ''),
    coalesce(new.raw_user_meta_data->>'apellido', ''),
    coalesce(new.raw_user_meta_data->>'telefono', ''),
    coalesce(new.raw_user_meta_data->>'rol', 'USUARIO'),
    coalesce(new.raw_user_meta_data->>'avatar_url', null)
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Reasociar trigger
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 3. TABLA: SERVICIOS
create table if not exists public.servicios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  precio numeric(10,2) not null default 0,
  duracion integer not null default 30, -- duración en minutos
  activo boolean not null default true,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Habilitar RLS en servicios
alter table public.servicios enable row level security;

-- Políticas RLS para servicios
create policy "Cualquiera puede consultar servicios activos"
  on public.servicios for select
  using (
    activo = true 
    or exists (
      select 1 from public.profiles p 
      where p.id = auth.uid() and p.rol = 'ADMIN'
    )
  );

create policy "Solo los admins pueden insertar servicios"
  on public.servicios for insert
  with check (
    exists (
      select 1 from public.profiles p 
      where p.id = auth.uid() and p.rol = 'ADMIN'
    )
  );

create policy "Solo los admins pueden actualizar servicios"
  on public.servicios for update
  using (
    exists (
      select 1 from public.profiles p 
      where p.id = auth.uid() and p.rol = 'ADMIN'
    )
  );

create policy "Solo los admins pueden eliminar servicios"
  on public.servicios for delete
  using (
    exists (
      select 1 from public.profiles p 
      where p.id = auth.uid() and p.rol = 'ADMIN'
    )
  );


-- 4. TABLA: BARBEROS
create table if not exists public.barberos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  apellido text not null,
  especialidad text,
  descripcion text,
  foto_url text,
  activo boolean not null default true,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Habilitar RLS en barberos
alter table public.barberos enable row level security;

-- Políticas RLS para barberos
create policy "Cualquiera puede ver barberos activos"
  on public.barberos for select
  using (
    activo = true
    or exists (
      select 1 from public.profiles p 
      where p.id = auth.uid() and p.rol = 'ADMIN'
    )
  );

create policy "Solo los admins pueden insertar barberos"
  on public.barberos for insert
  with check (
    exists (
      select 1 from public.profiles p 
      where p.id = auth.uid() and p.rol = 'ADMIN'
    )
  );

create policy "Solo los admins pueden actualizar barberos"
  on public.barberos for update
  using (
    exists (
      select 1 from public.profiles p 
      where p.id = auth.uid() and p.rol = 'ADMIN'
    )
  );

create policy "Solo los admins pueden eliminar barberos"
  on public.barberos for delete
  using (
    exists (
      select 1 from public.profiles p 
      where p.id = auth.uid() and p.rol = 'ADMIN'
    )
  );


-- 5. TABLA: TURNOS
create table if not exists public.turnos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.profiles(id) on delete cascade,
  barbero_id uuid not null references public.barberos(id) on delete cascade,
  servicio_id uuid not null references public.servicios(id) on delete cascade,
  fecha date not null,
  hora text not null,
  estado text not null default 'PENDIENTE' check (estado in ('PENDIENTE', 'CONFIRMADO', 'CANCELADO', 'FINALIZADO')),
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Habilitar RLS en turnos
alter table public.turnos enable row level security;

-- Políticas RLS para turnos
create policy "Usuarios ven sus propios turnos y Admins ven todos"
  on public.turnos for select
  using (
    auth.uid() = usuario_id
    or exists (
      select 1 from public.profiles p 
      where p.id = auth.uid() and p.rol = 'ADMIN'
    )
  );

create policy "Usuarios autenticados pueden crear sus turnos"
  on public.turnos for insert
  with check (
    auth.uid() = usuario_id
  );

create policy "Usuarios pueden cancelar su propio turno o Admins pueden modificar cualquier turno"
  on public.turnos for update
  using (
    auth.uid() = usuario_id
    or exists (
      select 1 from public.profiles p 
      where p.id = auth.uid() and p.rol = 'ADMIN'
    )
  );

-- Habilitar Realtime para la tabla turnos
begin;
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
commit;
alter publication supabase_realtime add table public.turnos;


-- 6. BUCKET DE STORAGE: AVATARS
-- Crear bucket público si no existe
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Políticas de Storage para el bucket avatars
create policy "Acceso público de lectura para avatares"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Usuarios pueden subir su propio avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars' 
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Usuarios pueden actualizar su propio avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars' 
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Usuarios pueden eliminar su propio avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars' 
    and auth.uid()::text = (storage.foldername(name))[1]
  );


-- 7. DATOS INICIALES (SEED DATA)
-- Servicios de ejemplo
insert into public.servicios (nombre, descripcion, precio, duracion, activo)
values 
  ('Corte Clásico & Fade', 'Degradado milimétrico a navaja y tijera con acabado premium y peinado.', 8500, 45, true),
  ('Perfilado y Tratamiento de Barba', 'Recorte simétrico, aceites aromáticos esenciales y toalla caliente tradicional.', 6000, 30, true),
  ('Servicio Completo VIP', 'Corte de autor, ritual completo de barba con toalla caliente, mascarilla exfoliante y bebida.', 13500, 60, true),
  ('Camuflaje de Canas / Color', 'Coloración sutil para un aspecto rejuvenecido e hipernatural.', 9500, 40, true)
on conflict do nothing;

-- Barberos de ejemplo
insert into public.barberos (nombre, apellido, especialidad, descripcion, foto_url, activo)
values 
  ('Franco', 'Alarcón', 'Master Barber & Skin Fades', 'Más de 10 años creando cortes impecables y estilismo contemporáneo.', 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=600&q=80', true),
  ('Mateo', 'Silva', 'Especialista en Barbas y Navaja', 'Artesano del afeitado clásico italiano con toallas calientes y bálsamos orgánicos.', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80', true),
  ('Lucas', 'Rossi', 'Cortes de Tendencia & Freestyle', 'Experto en texturas, tijera japonesa y diseño de líneas modernas.', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80', true)
on conflict do nothing;
