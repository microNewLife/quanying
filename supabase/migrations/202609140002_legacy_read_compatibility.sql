-- Preserve the old mini program's public read contract while the new version is reviewed/released.
BEGIN;
ALTER TABLE public.certifications ADD COLUMN legacy_teacher_id uuid UNIQUE;
UPDATE public.certifications c SET legacy_teacher_id=t.id
FROM public.teachers t WHERE upper(btrim(t.certificate_no))=c.certificate_no;
ALTER TABLE public.teachers RENAME TO teachers_legacy_backup;
CREATE VIEW public.teachers WITH (security_invoker=true) AS
SELECT coalesce(c.legacy_teacher_id,c.id) AS id,p.certificate_name,c.qualification,c.certificate_no,
 coalesce(c.certified_at,c.initial_year::text || '年') AS certified_at,
 p.photo_url,p.tags,p.description,p.qrcode_url,p.is_active,p.sort_order,c.created_at
FROM public.people p JOIN public.certifications c ON c.person_id=p.id
WHERE p.is_active AND c.is_active;
REVOKE ALL ON public.teachers FROM anon,authenticated;
GRANT SELECT ON public.teachers TO anon,authenticated;
-- Alias certificate-based old links as well as person-based new links.
INSERT INTO public.person_aliases(old_id,person_id)
SELECT id,person_id FROM public.certifications ON CONFLICT(old_id) DO NOTHING;
CREATE FUNCTION public.sync_certificate_aliases() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.person_aliases(old_id,person_id) VALUES(NEW.id,NEW.person_id)
 ON CONFLICT(old_id) DO UPDATE SET person_id=NEW.person_id;
 IF NEW.legacy_teacher_id IS NOT NULL THEN
  INSERT INTO public.person_aliases(old_id,person_id) VALUES(NEW.legacy_teacher_id,NEW.person_id)
  ON CONFLICT(old_id) DO UPDATE SET person_id=NEW.person_id;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sync_certificate_aliases() FROM PUBLIC;
CREATE TRIGGER sync_certificate_aliases AFTER INSERT OR UPDATE OF person_id ON public.certifications
FOR EACH ROW EXECUTE FUNCTION public.sync_certificate_aliases();
COMMENT ON VIEW public.teachers IS 'Read-only compatibility for older mini program versions. Authorization is enforced by people/certifications RLS.';
NOTIFY pgrst, 'reload schema';
COMMIT;
