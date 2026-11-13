-- ======================================================================
-- 📘 PARA LA DEFENSA — Aviso al aprobar un barbero (etapa 16).
-- Un TRIGGER es código que la base ejecuta sola cuando pasa algo en una tabla (insert, update o delete).
-- Acá: cuando un perfil pasa de USUARIO a BARBERO, se le crea un aviso a esa persona.
-- "security definer": la función corre con los permisos de su dueño. Por eso está en el esquema "privado"
-- y se le quitan los permisos a los usuarios (revoke): nadie la puede llamar a mano, solo el trigger.
-- ======================================================================
-- BELABARBERÍA · Aviso al aprobar un pedido de barbero. Aplicado en Supabase el 23/10/2026.
-- Cuando la cuenta pasa de USUARIO a BARBERO, la persona recibe un aviso (en la app y push si registró el teléfono).
create or replace function privado.avisar_rol_barbero()
 returns trigger language plpgsql security definer set search_path to ''
as $function$
begin
  if old.rol = 'USUARIO' and new.rol = 'BARBERO' then
    perform privado.notificar(new.id, null, 'BARBERO_APROBADO', '¡Ya sos barbero de BELABARBERÍA!',
      case when old.solicita_barbero
        then 'El dueño aprobó tu pedido. Abrí la app (o deslizá hacia abajo para actualizar) y vas a ver tu Agenda.'
        else 'Tu cuenta ya es de barbero. Abrí la app y vas a ver tu Agenda.' end);
  end if;
  return null;
end; $function$;
revoke all on function privado.avisar_rol_barbero() from public, anon, authenticated;

create trigger profiles_avisar_rol_barbero
  after update of rol on public.profiles
  for each row when (old.rol is distinct from new.rol)
  execute function privado.avisar_rol_barbero();
