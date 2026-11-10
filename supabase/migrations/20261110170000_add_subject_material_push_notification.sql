create or replace function public.enqueue_push_event()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'vault', 'net'
as $function$
declare
  internal_token text;
  payload jsonb;
  event_type text;
begin
  select decrypted_secret into internal_token
  from vault.decrypted_secrets
  where name = 'push_internal_token'
  limit 1;

  if internal_token is null then
    return new;
  end if;

  event_type := case TG_TABLE_NAME
    when 'comments' then 'comment'
    when 'announcements' then 'announcement'
    when 'tasks' then 'task'
    when 'schedule_changes' then 'schedule_change'
    when 'polls' then 'poll'
    when 'subject_materials' then 'subject_material'
    else null
  end;

  if event_type is null then
    return new;
  end if;

  payload := jsonb_build_object(
    'event_type', event_type,
    'record', to_jsonb(new)
  );

  perform net.http_post(
    url := 'https://ezdlwxbcacsbcnjhqqnq.supabase.co/functions/v1/push-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', internal_token
    ),
    body := payload
  );

  return new;
end;
$function$;

drop trigger if exists subject_materials_push_notification on public.subject_materials;
create trigger subject_materials_push_notification
  after insert on public.subject_materials
  for each row execute function public.enqueue_push_event();