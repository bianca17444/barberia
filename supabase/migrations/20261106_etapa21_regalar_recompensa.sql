-- ======================================================================
-- 📘 PARA LA DEFENSA — Regalar recompensa (etapa 21, noviembre).
-- regalar_recompensa(cliente, recompensa): solo un ADMIN activo puede usarla (si no, la base responde "Solo el dueño puede regalar recompensas").
-- Crea un canje con costo 0 (no descuenta puntos), genera el código BB-XXXXXX y le manda un aviso al cliente.
-- Se probó dentro de una transacción que después se deshizo: un cliente no puede regalar, el admin sí,
-- y el código se puede usar una sola vez.
-- ======================================================================
-- Etapa 21: el dueño le regala una recompensa a un cliente (código BB-XXXXXX sin descontar puntos).
create or replace function public.regalar_recompensa(p_usuario uuid, p_recompensa_id bigint)
returns public.canjes
language plpgsql security definer set search_path = ''
as $$
declare r public.recompensas; c public.canjes; v_codigo text;
begin
  -- solo el dueño (ADMIN activo)
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.rol = 'ADMIN' and p.activo) then
    raise exception 'Solo el dueño puede regalar recompensas.' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles p where p.id = p_usuario and p.activo) then
    raise exception 'Ese cliente no existe o está desactivado.' using errcode = 'P0002'; end if;
  select * into r from public.recompensas where id = p_recompensa_id and activo;
  if not found then raise exception 'Esa recompensa no está disponible.' using errcode = 'P0002'; end if;
  loop  -- código único BB-XXXXXX
    v_codigo := 'BB-' || upper(substr(md5(gen_random_uuid()::text), 1, 6));
    exit when not exists (select 1 from public.canjes where codigo = v_codigo);
  end loop;
  insert into public.canjes (usuario_id, recompensa_id, nombre, costo, codigo)
    values (p_usuario, r.id, r.nombre, 0, v_codigo) returning * into c;
  perform privado.notificar(p_usuario, null, 'RECOMPENSA_REGALO', '🎁 Te regalaron una recompensa',
    r.nombre || '. Tu código es ' || v_codigo || ': mostralo en la barbería.');
  return c;
end; $$;

-- 📘 Nadie sin sesión (anon) la puede ejecutar. Los usuarios con sesión pueden llamarla, pero adentro se controla que sea ADMIN.
revoke all on function public.regalar_recompensa(uuid, bigint) from public, anon;
grant execute on function public.regalar_recompensa(uuid, bigint) to authenticated;
