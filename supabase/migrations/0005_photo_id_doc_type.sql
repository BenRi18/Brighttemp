-- =====================================================================
-- Adds the Photo ID document type.
--
-- This is on its own because Postgres will not let a new enum value be
-- USED in the same transaction that adds it. 0006 does the rest.
-- =====================================================================

alter type public.compliance_doc_type add value if not exists 'photo_id';
