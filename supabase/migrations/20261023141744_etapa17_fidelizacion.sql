-- ======================================================================
-- 📘 PARA LA DEFENSA — Club de puntos (etapa 17): niveles, movimientos de puntos, recompensas y canjes.
-- Ideas clave para la defensa:
--   - Los puntos los da el trigger turnos_otorgar_puntos cuando un turno pasa a FINALIZADO.
--   - El índice único puntos_un_turno impide dar puntos dos veces por el mismo turno.
--   - Los usuarios solo tienen permiso de LECTURA (grant select) en puntos y canjes: no pueden sumarse puntos.
--   - canjear_recompensa y usar_canje son funciones que controlan todo adentro (sesión, saldo, rol, código ya usado).
-- ======================================================================
-- etapa17_fidelizacion (aplicada en Supabase el 23/10/2026; copia exacta de supabase_migrations.schema_migrations)
-- Puntos por servicio: null = automático según el nombre (Corte 100 · Barba 70 · Corte + Barba 150). El admin puede fijar otro valor.
alter table public.servicios add column if not exists puntos integer check (puntos is null or puntos between 0 and 10000);

create or replace function public.puntos_de_servicio(p_nombre text, p_puntos integer)
 returns integer language sql immutable set search_path to ''
as $function$
  select coalesce(p_puntos, case
    when p_nombre ilike '%corte%' and p_nombre ilike '%barba%' then 150
    when p_nombre ilike '%barba%' then 70
    else 100 end);
$function$;

-- 📘 Niveles según los puntos acumulados: Bronze desde 0, Silver desde 500, Gold desde 1500 y VIP desde 3000.
create table public.niveles (
  id smallint primary key,
  nombre text not null unique,
  desde integer not null unique check (desde >= 0)
);
insert into public.niveles (id, nombre, desde) values (1,'Bronze',0),(2,'Silver',500),(3,'Gold',1500),(4,'VIP',3000);
alter table public.niveles enable row level security;
create policy "ver niveles" on public.niveles for select to authenticated using (true);
create policy "admin edita niveles" on public.niveles for update to authenticated using (public.es_admin()) with check (public.es_admin());
revoke all on public.niveles from anon, public, authenticated;
grant select, update on public.niveles to authenticated;

create table public.puntos_movimientos (
  id bigint generated always as identity primary key,
  usuario_id uuid not null references public.profiles(id) on delete cascade,
  tipo text not null check (tipo in ('TURNO','CANJE','AJUSTE')),
  turno_id bigint references public.turnos(id) on delete set null,
  canje_id bigint,
  puntos integer not null check (puntos <> 0),
  motivo text not null,
  creado_at timestamptz not null default now()
);
-- 📘 Índice único: un turno da puntos UNA sola vez, aunque el trigger se vuelva a ejecutar.
create unique index puntos_un_turno on public.puntos_movimientos (turno_id) where tipo = 'TURNO';
create index puntos_usuario_idx on public.puntos_movimientos (usuario_id, creado_at desc);
alter table public.puntos_movimientos enable row level security;
create policy "ver mis puntos" on public.puntos_movimientos for select to authenticated using (usuario_id = (select auth.uid()) or public.es_admin());
revoke all on public.puntos_movimientos from anon, public, authenticated;
grant select on public.puntos_movimientos to authenticated;

-- 📘 Función del trigger: si el turno pasó a FINALIZADO, suma los puntos del servicio y le avisa al cliente.
create or replace function privado.otorgar_puntos_turno()
 returns trigger language plpgsql security definer set search_path to ''
as $function$
declare v_puntos integer; v_servicio text; v_insertados integer;
begin
  if new.estado = 'FINALIZADO' and old.estado is distinct from 'FINALIZADO' then
    select public.puntos_de_servicio(s.nombre, s.puntos), s.nombre into v_puntos, v_servicio from public.servicios s where s.id = new.servicio_id;
    if coalesce(v_puntos, 0) > 0 then
      insert into public.puntos_movimientos (usuario_id, tipo, turno_id, puntos, motivo)
      values (new.usuario_id, 'TURNO', new.id, v_puntos, 'Turno completado: ' || coalesce(v_servicio, 'servicio'))
      on conflict (turno_id) where tipo = 'TURNO' do nothing;
      get diagnostics v_insertados = row_count;
      if v_insertados > 0 then
        perform privado.notificar(new.usuario_id, new.id, 'PUNTOS', '🏆 Sumaste ' || v_puntos || ' puntos',
          'Gracias por venir. Tus puntos ya están en Cuenta → Mis puntos.');
      end if;
    end if;
  end if;
  return null;
end; $function$;
revoke all on function privado.otorgar_puntos_turno() from public, anon, authenticated;
-- 📘 El trigger en sí: se ejecuta después de cada cambio de estado en la tabla turnos.
create trigger turnos_otorgar_puntos after update of estado on public.turnos
  for each row execute function privado.otorgar_puntos_turno();

create or replace function public.mis_puntos()
 returns table (saldo integer, ganados integer, nivel text, nivel_desde integer, siguiente text, siguiente_desde integer, faltan integer, progreso numeric)
 language plpgsql stable security definer set search_path to ''
as $function$
declare v_uid uuid := auth.uid(); v_saldo integer; v_ganados integer; n record; s record;
begin
  if v_uid is null then raise exception 'Tenés que iniciar sesión.' using errcode = '42501'; end if;
  select coalesce(sum(m.puntos),0), coalesce(sum(m.puntos) filter (where m.puntos > 0),0) into v_saldo, v_ganados
    from public.puntos_movimientos m where m.usuario_id = v_uid;
  select * into n from public.niveles where desde <= v_ganados order by desde desc limit 1;
  select * into s from public.niveles where desde > v_ganados order by desde limit 1;
  return query select v_saldo, v_ganados, n.nombre, n.desde, s.nombre, s.desde,
    case when s.desde is null then 0 else s.desde - v_ganados end,
    case when s.desde is null then 1::numeric else round((v_ganados - n.desde)::numeric / (s.desde - n.desde), 3) end;
end; $function$;

create table public.recompensas (
  id bigint generated always as identity primary key,
  nombre text not null check (char_length(nombre) between 2 and 80),
  descripcion text check (char_length(descripcion) <= 300),
  costo integer not null check (costo > 0),
  tipo text not null default 'OTRO' check (tipo in ('DESCUENTO','SERVICIO','OTRO')),
  valor numeric check (valor is null or valor > 0),
  activo boolean not null default true,
  creado_at timestamptz not null default now()
);
insert into public.recompensas (nombre, descripcion, costo, tipo, valor) values
  ('10% de descuento', 'Descuento del 10% en tu próximo servicio. Mostrá el código al pagar.', 500, 'DESCUENTO', 10),
  ('Recompensa especial', 'Un beneficio especial que define la barbería. Mostrá el código en el local.', 1000, 'OTRO', null);
alter table public.recompensas enable row level security;
create policy "ver recompensas" on public.recompensas for select to authenticated using (activo or public.es_admin());
create policy "admin crea recompensas" on public.recompensas for insert to authenticated with check (public.es_admin());
create policy "admin edita recompensas" on public.recompensas for update to authenticated using (public.es_admin()) with check (public.es_admin());
revoke all on public.recompensas from anon, public, authenticated;
grant select, insert, update on public.recompensas to authenticated;

-- 📘 Cada recompensa canjeada: código BB-XXXXXX, estado DISPONIBLE o USADO, y cuándo se usó.
create table public.canjes (
  id bigint generated always as identity primary key,
  usuario_id uuid not null references public.profiles(id) on delete cascade,
  recompensa_id bigint not null references public.recompensas(id),
  nombre text not null,
  costo integer not null,
  codigo text not null unique,
  estado text not null default 'DISPONIBLE' check (estado in ('DISPONIBLE','USADO')),
  creado_at timestamptz not null default now(),
  usado_at timestamptz,
  usado_por uuid references public.profiles(id) on delete set null
);
create index canjes_usuario_idx on public.canjes (usuario_id, creado_at desc);
alter table public.canjes enable row level security;
create policy "ver mis canjes" on public.canjes for select to authenticated using (usuario_id = (select auth.uid()) or public.es_admin());
revoke all on public.canjes from anon, public, authenticated;
grant select on public.canjes to authenticated;
alter table public.puntos_movimientos add constraint puntos_canje_fk foreign key (canje_id) references public.canjes(id) on delete set null;

-- 📘 Canjear: controla la sesión y el saldo ("Te faltan X puntos"), descuenta los puntos y genera el código, todo en una sola operación.
create or replace function public.canjear_recompensa(p_recompensa_id bigint)
 returns public.canjes language plpgsql security definer set search_path to ''
as $function$
declare v_uid uuid := auth.uid(); r public.recompensas; v_saldo integer; c public.canjes; v_codigo text;
begin
  if v_uid is null then raise exception 'Tenés que iniciar sesión.' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles p where p.id = v_uid and p.activo) then
    raise exception 'Tu cuenta está desactivada.' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext('canje:' || v_uid::text));
  select * into r from public.recompensas where id = p_recompensa_id and activo;
  if not found then raise exception 'Esa recompensa no está disponible.' using errcode = 'P0002'; end if;
  select coalesce(sum(puntos),0) into v_saldo from public.puntos_movimientos where usuario_id = v_uid;
  if v_saldo < r.costo then
    raise exception 'Te faltan % puntos para esta recompensa.', r.costo - v_saldo using errcode = '22023'; end if;
  loop
    v_codigo := 'BB-' || upper(substr(md5(gen_random_uuid()::text), 1, 6));
    exit when not exists (select 1 from public.canjes where codigo = v_codigo);
  end loop;
  insert into public.canjes (usuario_id, recompensa_id, nombre, costo, codigo)
    values (v_uid, r.id, r.nombre, r.costo, v_codigo) returning * into c;
  insert into public.puntos_movimientos (usuario_id, tipo, canje_id, puntos, motivo)
    values (v_uid, 'CANJE', c.id, -r.costo, 'Canje: ' || r.nombre);
  return c;
end; $function$;

-- 📘 Usar un código: solo BARBERO o ADMIN activos. Si el código ya estaba USADO, avisa cuándo se usó y no lo acepta de nuevo.
create or replace function public.usar_canje(p_codigo text)
 returns public.canjes language plpgsql security definer set search_path to ''
as $function$
declare c public.canjes;
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.rol in ('BARBERO','ADMIN') and p.activo) then
    raise exception 'Solo el equipo de la barbería puede validar códigos.' using errcode = '42501'; end if;
  select * into c from public.canjes where codigo = upper(trim(p_codigo)) for update;
  if not found then raise exception 'El código no existe.' using errcode = 'P0002'; end if;
  if c.estado = 'USADO' then raise exception 'Ese código ya se usó el %.', to_char(c.usado_at at time zone 'America/Argentina/Buenos_Aires', 'DD/MM HH24:MI') using errcode = '22023'; end if;
  update public.canjes set estado = 'USADO', usado_at = now(), usado_por = auth.uid() where id = c.id returning * into c;
  perform privado.notificar(c.usuario_id, null, 'RECOMPENSA_USADA', '🎁 Usaste tu recompensa', c.nombre || ' (código ' || c.codigo || ').');
  return c;
end; $function$;

-- 📘 Logros calculados con los turnos reales del cliente.
create or replace function public.mis_logros()
 returns table (id text, titulo text, descripcion text, icono text, actual integer, meta integer, desbloqueado boolean)
 language plpgsql stable security definer set search_path to ''
as $function$
declare v_uid uuid := auth.uid(); v_reservas integer; v_finalizados integer; v_recientes integer; v_ganados integer; v_vip integer;
begin
  if v_uid is null then raise exception 'Tenés que iniciar sesión.' using errcode = '42501'; end if;
  select count(*) filter (where estado <> 'CANCELADO'), count(*) filter (where estado = 'FINALIZADO'),
         count(*) filter (where estado = 'FINALIZADO' and fecha >= (privado.ahora_local())::date - 90)
    into v_reservas, v_finalizados, v_recientes from public.turnos where usuario_id = v_uid;
  select coalesce(sum(puntos) filter (where puntos > 0), 0) into v_ganados from public.puntos_movimientos where usuario_id = v_uid;
  select desde into v_vip from public.niveles where nombre = 'VIP';
  return query values
    ('primera_reserva'::text, 'Primera reserva'::text, 'Reservaste tu primer turno.'::text, 'trophy'::text, least(v_reservas,1), 1, v_reservas >= 1),
    ('cinco_cortes', '5 cortes', 'Completaste 5 servicios.', 'cut', least(v_finalizados,5), 5, v_finalizados >= 5),
    ('frecuente', 'Cliente frecuente', '3 servicios completados en los últimos 90 días.', 'flame', least(v_recientes,3), 3, v_recientes >= 3),
    ('diez_visitas', '10 visitas', 'Completaste 10 servicios.', 'ribbon', least(v_finalizados,10), 10, v_finalizados >= 10),
    ('vip', 'Cliente VIP', 'Llegaste al nivel VIP.', 'diamond', least(v_ganados, v_vip), v_vip, v_ganados >= v_vip);
end; $function$;

revoke all on function public.mis_puntos() from public, anon;
revoke all on function public.canjear_recompensa(bigint) from public, anon;
revoke all on function public.usar_canje(text) from public, anon;
revoke all on function public.mis_logros() from public, anon;
grant execute on function public.mis_puntos() to authenticated;
grant execute on function public.canjear_recompensa(bigint) to authenticated;
grant execute on function public.usar_canje(text) to authenticated;
grant execute on function public.mis_logros() to authenticated;
