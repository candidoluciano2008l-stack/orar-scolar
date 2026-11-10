alter table public.subject_materials
  add column documents jsonb not null default '[]'::jsonb,
  add constraint subject_materials_documents_valid
    check (jsonb_typeof(documents) = 'array' and jsonb_array_length(documents) <= 10);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'subject-material-files',
  'subject-material-files',
  true,
  20971520,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]::text[]
);

create policy "Admins can upload subject material files"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'subject-material-files' and private.is_admin());

create policy "Admins can delete subject material files"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'subject-material-files' and private.is_admin());
