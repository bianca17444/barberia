-- ======================================================================
-- 📘 PARA LA DEFENSA — Paneles con números (etapa 20): dashboard_barbero y dashboard_admin.
-- Devuelven los indicadores en formato JSON y controlan quién llama:
-- dashboard_barbero exige una cuenta vinculada a una ficha de barbero; dashboard_admin exige ser admin.
-- ======================================================================
-- etapa20_dashboards (aplicada en Supabase el 23/10/2026; copia exacta de supabase_migrations.schema_migrations)
create or replace function public.dashboard_barbero()
 returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
declare v_uid uuid := auth.uid(); v_hoy date := (privado.ahora_local())::date; v_barbero bigint; r jsonb;
begin
  if v_uid is null then raise exception 'Tenés que iniciar sesión.' using errcode = '42501'; end if;
  select id into v_barbero from public.barberos where usuario_id = v_uid;
  if v_barbero is null then raise exception 'Tu cuenta no está vinculada a una ficha de barbero.' using errcode = '42501'; end if;
  with t as (
    select t.*, coalesce(d.precio, s.precio) precio, s.nombre servicio, p.nombre cli_nombre, p.apellido cli_apellido
    from public.turnos t join public.servicios s on s.id = t.servicio_id join public.profiles p on p.id = t.usuario_id
    left join public.detalle_turno d on d.turno_id = t.id
    where t.barbero_id = v_barbero
  )
  select jsonb_build_object(
    'hoy', v_hoy,
    'turnos_hoy', (select count(*) from t where fecha = v_hoy and estado <> 'CANCELADO'),
    'confirmados_hoy', (select count(*) from t where fecha = v_hoy and estado = 'CONFIRMADO'),
    'pendientes_hoy', (select count(*) from t where fecha = v_hoy and estado = 'PENDIENTE'),
    'pendientes_total', (select count(*) from t where fecha >= v_hoy and estado = 'PENDIENTE'),
    'completados_hoy', (select count(*) from t where fecha = v_hoy and estado = 'FINALIZADO'),
    'ingresos_estimados_hoy', (select coalesce(sum(precio),0) from t where fecha = v_hoy and estado <> 'CANCELADO'),
    'ingresos_semana', (select coalesce(sum(precio),0) from t where fecha between v_hoy - 6 and v_hoy and estado = 'FINALIZADO'),
    'proximo', (select jsonb_build_object('id', id, 'fecha', fecha, 'hora', to_char(hora,'HH24:MI'), 'servicio', servicio, 'cliente', trim(coalesce(cli_nombre,'') || ' ' || coalesce(cli_apellido,'')), 'estado', estado)
                from t where estado in ('PENDIENTE','CONFIRMADO') and (fecha + hora) >= privado.ahora_local() order by fecha, hora limit 1),
    'semana', (select jsonb_agg(jsonb_build_object('fecha', d::date, 'turnos', (select count(*) from t where fecha = d::date and estado <> 'CANCELADO')) order by d)
               from generate_series(v_hoy, v_hoy + 6, interval '1 day') d)
  ) into r;
  return r;
end; $function$;

create or replace function public.dashboard_admin()
 returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
declare v_hoy date := (privado.ahora_local())::date; v_lunes date; r jsonb;
begin
  if not public.es_admin() then raise exception 'Solo el administrador puede ver esto.' using errcode = '42501'; end if;
  v_lunes := v_hoy - ((extract(isodow from v_hoy))::int - 1);
  with t as (
    select t.*, coalesce(d.precio, s.precio) precio, s.nombre servicio, b.nombre || ' ' || b.apellido barbero
    from public.turnos t join public.servicios s on s.id = t.servicio_id join public.barberos b on b.id = t.barbero_id
    left join public.detalle_turno d on d.turno_id = t.id
  )
  select jsonb_build_object(
    'hoy', v_hoy,
    'turnos_hoy', (select count(*) from t where fecha = v_hoy and estado <> 'CANCELADO'),
    'pendientes_hoy', (select count(*) from t where fecha = v_hoy and estado = 'PENDIENTE'),
    'turnos_semana', (select count(*) from t where fecha between v_lunes and v_lunes + 6 and estado <> 'CANCELADO'),
    'cancelados_semana', (select count(*) from t where fecha between v_lunes and v_lunes + 6 and estado = 'CANCELADO'),
    'ingresos_mes', (select coalesce(sum(p.monto),0) from public.pagos p where p.estado_pago_id = 2 and date_trunc('month', p.updated_at) = date_trunc('month', now())),
    'ingresos_semana', (select coalesce(sum(p.monto),0) from public.pagos p where p.estado_pago_id = 2 and p.updated_at >= v_lunes),
    'ingresos_estimados_hoy', (select coalesce(sum(precio),0) from t where fecha = v_hoy and estado <> 'CANCELADO'),
    'clientes', (select count(*) from public.profiles where rol = 'USUARIO' and activo),
    'barberos', (select count(*) from public.barberos where activo),
    'top_servicios', (select coalesce(jsonb_agg(x order by x.turnos desc), '[]') from (
        select servicio nombre, count(*) turnos from t where estado <> 'CANCELADO' and fecha >= v_hoy - 30 group by servicio order by count(*) desc limit 5) x),
    'top_barberos', (select coalesce(jsonb_agg(x order by x.turnos desc), '[]') from (
        select barbero nombre, count(*) turnos from t where estado <> 'CANCELADO' and fecha >= v_hoy - 30 group by barbero order by count(*) desc limit 5) x),
    'ultimos_14_dias', (select jsonb_agg(jsonb_build_object('fecha', d::date, 'turnos', (select count(*) from t where fecha = d::date and estado <> 'CANCELADO')) order by d)
               from generate_series(v_hoy - 13, v_hoy, interval '1 day') d)
  ) into r;
  return r;
end; $function$;

revoke all on function public.dashboard_barbero() from public, anon;
revoke all on function public.dashboard_admin() from public, anon;
grant execute on function public.dashboard_barbero() to authenticated;
grant execute on function public.dashboard_admin() to authenticated;
