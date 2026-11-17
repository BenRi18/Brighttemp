-- =====================================================================
-- Re-uploading a compliance document.
--
-- Replacing a document is two steps: archive the current one, then insert
-- the new one. The app did both directly, and the first step was silently
-- refused:
--
--   revoke update on public.compliance_documents from authenticated;
--   grant update (storage_path, original_filename, mime_type, size_bytes,
--                 issue_date, expiry_date, reference) ...
--
-- is_current is not in that list — deliberately, since nothing a locum does
-- should quietly retire a document — so the archive raised "permission denied",
-- the app ignored the error, and the insert then hit
--
--   duplicate key value violates unique constraint
--   "compliance_documents_current_idx"
--
-- which the locum saw as "We couldn't save that document. Try again." Every
-- re-upload failed, for everyone. The first upload always worked, because
-- there was no current row to archive, which is why this only surfaced once
-- documents started being rejected and re-sent.
--
-- Granting is_current would fix the rejected case and still leave renewals
-- broken: documents_update_own only permits an update while the document is
-- pending or rejected, so replacing an approved certificate before it expires
-- would fail the same way. Widening that policy is the wrong trade — it would
-- let a locum swap the file on a document an admin has already approved.
--
-- So the whole replace happens here instead, in one transaction: archive and
-- insert together, scoped to the caller's own record, with the new document
-- forced to 'pending'. A locum still cannot approve anything, cannot touch
-- anyone else's documents, and cannot be left with nothing if the insert fails.
--
-- Run after 0011. Safe to re-run.
-- =====================================================================

create or replace function public.replace_compliance_document(
  p_doc_type          compliance_doc_type,
  p_storage_path      text,
  p_original_filename text default null,
  p_mime_type         text default null,
  p_size_bytes        bigint default null,
  p_issue_date        date default null,
  p_expiry_date       date default null,
  p_reference         text default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_locum uuid;
  v_id    uuid;
begin
  -- my_locum_id() reads the caller's JWT, so this can only ever act on the
  -- signed-in locum's own documents however it is called.
  v_locum := public.my_locum_id();
  if v_locum is null then
    raise exception 'Only a locum can upload compliance documents'
      using errcode = '42501';
  end if;

  if p_storage_path is null or btrim(p_storage_path) = '' then
    raise exception 'A stored file is required';
  end if;

  update public.compliance_documents
     set is_current = false
   where locum_id = v_locum
     and doc_type = p_doc_type
     and is_current;

  insert into public.compliance_documents (
    locum_id, doc_type, storage_path, original_filename, mime_type, size_bytes,
    issue_date, expiry_date, reference, status, is_current
  ) values (
    v_locum, p_doc_type, p_storage_path, p_original_filename, p_mime_type, p_size_bytes,
    p_issue_date, p_expiry_date, p_reference, 'pending', true
  )
  returning id into v_id;

  return v_id;
end $$;

revoke all on function public.replace_compliance_document(
  compliance_doc_type, text, text, text, bigint, date, date, text) from public;
grant execute on function public.replace_compliance_document(
  compliance_doc_type, text, text, text, bigint, date, date, text) to authenticated;
