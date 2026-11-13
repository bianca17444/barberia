-- ======================================================================
-- 📘 PARA LA DEFENSA — Calendario mejorado y lista de espera (etapa 19).
--   - horarios_del_dia: todos los horarios con su estado (LIBRE, OCUPADO o PASADO).
--   - dias_disponibles: qué días hay atención y cuántos horarios libres quedan.
--   - lista_espera: "Avisarme si se libera". Si se cancela un turno, un trigger avisa al primero de la fila.
--   - pg_cron: tarea programada cada 5 minutos que pasa al siguiente si el avisado no reservó en 30 minutos.
-- ======================================================================
-- etapa19_lista_espera_calendario (aplicada en Supabase el 23/10/2026; copia exacta de supabase_migrations.schema_migrations)
-- ¿Está libre ese horario para ese barbero y servicio? (misma regla de solapamiento que la reserva)
create or replace function privado.slot_libre(p_barbero bigint, p_servicio bigint, p_fecha date, p_hora time)
 returns boolean language sql stable security definer set search_path to ''
as $function$
  select not exists (
    select 1 from public.turnos t join public.servicios s on s.id = t.servicio_id
    where t.barbero_id = p_barbero and t.estado <> 'CANCELADO'
      and t.fecha between p_fecha - 1 and p_fecha + 1
      and (t.fecha + t.hora) < (p_fecha + p_hora) + make_interval(mins => (select duracion from public.servicios where id = p_servicio))
      and (p_fecha + p_hora) < (t.fecha + t.hora + make_interval(mins => s.duracion)));
$function$;

-- Todos los horarios del día con su estado: LIBRE, OCUPADO o PASADO (para mostrar los ocupados deshabilitados)
create or replace function public.horarios_del_dia(p_barbero_id bigint, p_servicio_id bigint, p_fecha date)
 returns table (hora time, estado text)
 language plpgsql stable security definer set search_path to ''
as $function$
declare v_duracion integer; v_ahora timestamp := privado.ahora_local();
begin
  if auth.uid() is null then raise exception 'Se requiere iniciar sesión' using errcode = '42501'; end if;
  select s.duracion into v_duracion from public.servicios s where s.id = p_servicio_id and s.activo;
  if not found then raise exception 'El servicio seleccionado no está disponible' using errcode = '22023'; end if;
  if not exists (select 1 from public.barberos b where b.id = p_barbero_id and b.activo) then
    raise exception 'El barbero seleccionado no está disponible' using errcode = '22023'; end if;
  return query
  select distinct slot::time,
    case when slot <= v_ahora then 'PASADO'
         when privado.slot_libre(p_barbero_id, p_servicio_id, p_fecha, slot::time) then 'LIBRE'
         else 'OCUPADO' end
  from public.horarios_barberos h
  cross join lateral generate_series(p_fecha + h.hora_inicio, p_fecha + h.hora_fin - make_interval(mins => v_duracion), make_interval(mins => v_duracion)) slot
  where h.barbero_id = p_barbero_id and h.activo and h.dia_semana = extract(dow from p_fecha)
  order by 1;
end; $function$;

-- Resumen de los próximos días: si el barbero trabaja y cuántos horarios libres hay
create or replace function public.dias_disponibles(p_barbero_id bigint, p_servicio_id bigint, p_desde date, p_dias integer default 21)
 returns table (fecha date, trabaja boolean, libres integer, ocupados integer)
 language plpgsql stable security definer set search_path to ''
as $function$
declare d date;
begin
  if auth.uid() is null then raise exception 'Se requiere iniciar sesión' using errcode = '42501'; end if;
  if p_dias is null or p_dias < 1 or p_dias > 60 then raise exception 'Cantidad de días inválida' using errcode = '22023'; end if;
  for d in select generate_series(p_desde, p_desde + p_dias - 1, interval '1 day')::date loop
    return query select d,
      exists (select 1 from public.horarios_barberos h where h.barbero_id = p_barbero_id and h.activo and h.dia_semana = extract(dow from d)),
      coalesce((select count(*)::int from public.horarios_del_dia(p_barbero_id, p_servicio_id, d) x where x.estado = 'LIBRE'), 0),
      coalesce((select count(*)::int from public.horarios_del_dia(p_barbero_id, p_servicio_id, d) x where x.estado = 'OCUPADO'), 0);
  end loop;
end; $function$;

-- ===================== LISTA DE ESPERA =====================
create table public.lista_espera (
  id bigint generated always as identity primary key,
  usuario_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  barbero_id bigint not null references public.barberos(id) on delete cascade,
  servicio_id bigint not null references public.servicios(id) on delete cascade,
  fecha date not null,
  hora time not null,
  estado text not null default 'ESPERANDO' check (estado in ('ESPERANDO','AVISADO','RESERVADO','CANCELADO','VENCIDO')),
  creado_at timestamptz not null default now(),
  avisado_at timestamptz
);
-- Sin duplicados: una sola anotación activa por persona y horario
create unique index lista_espera_unica on public.lista_espera (usuario_id, barbero_id, fecha, hora) where estado in ('ESPERANDO','AVISADO');
create index lista_espera_slot_idx on public.lista_espera (barbero_id, fecha, hora, creado_at) where estado in ('ESPERANDO','AVISADO');
alter table public.lista_espera enable row level security;
create policy "ver mi lista de espera" on public.lista_espera for select to authenticated using (usuario_id = (select auth.uid()) or public.es_admin());
revoke all on public.lista_espera from anon, public, authenticated;
grant select on public.lista_espera to authenticated;

create or replace function public.anotarse_lista_espera(p_barbero_id bigint, p_servicio_id bigint, p_fecha date, p_hora time)
 returns public.lista_espera language plpgsql security definer set search_path to ''
as $function$
declare v_uid uuid := auth.uid(); e public.lista_espera; v_estado text; v_pos integer;
begin
  if v_uid is null then raise exception 'Tenés que iniciar sesión.' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles p where p.id = v_uid and p.activo and p.rol = 'USUARIO') then
    raise exception 'Solo los clientes pueden anotarse en la lista de espera.' using errcode = '42501'; end if;
  select x.estado into v_estado from public.horarios_del_dia(p_barbero_id, p_servicio_id, p_fecha) x where x.hora = p_hora;
  if v_estado is null then raise exception 'Ese horario no está dentro de la atención del barbero.' using errcode = '22023'; end if;
  if v_estado = 'PASADO' then raise exception 'Ese horario ya pasó.' using errcode = '22023'; end if;
  if v_estado = 'LIBRE' then raise exception 'Ese horario está libre: podés reservarlo directamente.' using errcode = '22023'; end if;
  insert into public.lista_espera (usuario_id, barbero_id, servicio_id, fecha, hora)
    values (v_uid, p_barbero_id, p_servicio_id, p_fecha, p_hora)
    on conflict (usuario_id, barbero_id, fecha, hora) where estado in ('ESPERANDO','AVISADO') do nothing
    returning * into e;
  if e.id is null then raise exception 'Ya estás anotado para ese horario.' using errcode = '23505'; end if;
  return e;
end; $function$;

create or replace function public.salir_lista_espera(p_id bigint)
 returns void language plpgsql security definer set search_path to ''
as $function$
begin
  update public.lista_espera set estado = 'CANCELADO'
   where id = p_id and usuario_id = auth.uid() and estado in ('ESPERANDO','AVISADO');
  if not found then raise exception 'No encontramos esa anotación.' using errcode = 'P0002'; end if;
end; $function$;

-- Avisa al primero en la fila de un horario que quedó libre
create or replace function privado.lista_espera_avisar(p_barbero bigint, p_fecha date)
 returns void language plpgsql security definer set search_path to ''
as $function$
declare e record; v_barbero text;
begin
  for e in
    select distinct on (le.hora) le.* from public.lista_espera le
    where le.barbero_id = p_barbero and le.fecha = p_fecha and le.estado = 'ESPERANDO'
      and (le.fecha + le.hora) > privado.ahora_local()
      and not exists (select 1 from public.lista_espera a where a.barbero_id = le.barbero_id and a.fecha = le.fecha and a.hora = le.hora and a.estado = 'AVISADO')
      and privado.slot_libre(le.barbero_id, le.servicio_id, le.fecha, le.hora)
    order by le.hora, le.creado_at
  loop
    select nombre || ' ' || apellido into v_barbero from public.barberos where id = e.barbero_id;
    update public.lista_espera set estado = 'AVISADO', avisado_at = now() where id = e.id;
    perform privado.notificar(e.usuario_id, null, 'LISTA_ESPERA', '⏳ Se liberó tu horario',
      'Se liberó el turno del ' || to_char(e.fecha, 'DD/MM') || ' a las ' || to_char(e.hora, 'HH24:MI') || ' con ' || coalesce(v_barbero, 'tu barbero') ||
      '. Reservalo en los próximos 30 minutos; después le avisamos a la siguiente persona.');
  end loop;
end; $function$;

create or replace function privado.lista_espera_por_turno()
 returns trigger language plpgsql security definer set search_path to ''
as $function$
begin
  if tg_op = 'UPDATE' and new.estado = 'CANCELADO' and old.estado <> 'CANCELADO' then
    perform privado.lista_espera_avisar(new.barbero_id, new.fecha);
  elsif tg_op = 'INSERT' then
    update public.lista_espera set estado = 'RESERVADO'
     where usuario_id = new.usuario_id and barbero_id = new.barbero_id and fecha = new.fecha and hora = new.hora and estado in ('ESPERANDO','AVISADO');
  end if;
  return null;
end; $function$;
-- 📘 Trigger: cuando un turno se cancela, avisa a quien estaba esperando ese horario.
create trigger turnos_lista_espera after insert or update of estado on public.turnos
  for each row execute function privado.lista_espera_por_turno();

-- Cada 5 minutos: si el avisado no reservó en 30 min, pasa al siguiente; los horarios pasados vencen
create or replace function privado.lista_espera_avanzar()
 returns void language plpgsql security definer set search_path to ''
as $function$
declare s record;
begin
  update public.lista_espera set estado = 'VENCIDO'
   where estado in ('ESPERANDO','AVISADO') and (fecha + hora) <= privado.ahora_local();
  for s in
    update public.lista_espera set estado = 'VENCIDO'
     where estado = 'AVISADO' and avisado_at < now() - interval '30 minutes'
    returning barbero_id, fecha
  loop
    perform privado.lista_espera_avisar(s.barbero_id, s.fecha);
  end loop;
end; $function$;

revoke all on function privado.slot_libre(bigint,bigint,date,time) from public, anon, authenticated;
revoke all on function privado.lista_espera_avisar(bigint,date) from public, anon, authenticated;
revoke all on function privado.lista_espera_por_turno() from public, anon, authenticated;
revoke all on function privado.lista_espera_avanzar() from public, anon, authenticated;
revoke all on function public.horarios_del_dia(bigint,bigint,date) from public, anon;
revoke all on function public.dias_disponibles(bigint,bigint,date,integer) from public, anon;
revoke all on function public.anotarse_lista_espera(bigint,bigint,date,time) from public, anon;
revoke all on function public.salir_lista_espera(bigint) from public, anon;
grant execute on function public.horarios_del_dia(bigint,bigint,date) to authenticated;
grant execute on function public.dias_disponibles(bigint,bigint,date,integer) to authenticated;
grant execute on function public.anotarse_lista_espera(bigint,bigint,date,time) to authenticated;
grant execute on function public.salir_lista_espera(bigint) to authenticated;

-- 📘 pg_cron: programa una tarea dentro de la base cada 5 minutos ('*/5 * * * *').
--    Es un proceso en segundo plano: funciona aunque nadie tenga la app abierta.
select cron.schedule('belabarberia_lista_espera', '*/5 * * * *', 'select privado.lista_espera_avanzar()');
