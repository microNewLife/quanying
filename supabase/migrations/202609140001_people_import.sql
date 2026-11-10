-- Run once in Supabase SQL Editor, after schema.sql. Existing teachers are retained as a legacy backup.
BEGIN;
CREATE TABLE public.admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = '' AS $$ SELECT EXISTS(SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()) $$;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

CREATE TABLE public.people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_name text NOT NULL CHECK (length(btrim(certificate_name)) BETWEEN 1 AND 100),
  nickname text NOT NULL DEFAULT '',
  student_no text,
  photo_url text NOT NULL DEFAULT '',
  tags jsonb NOT NULL DEFAULT '[]',
  description text NOT NULL DEFAULT '',
  qrcode_url text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.certifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.people(id),
  certificate_no text NOT NULL UNIQUE CHECK (certificate_no = upper(btrim(certificate_no))),
  qualification text NOT NULL,
  initial_year integer CHECK (initial_year BETWEEN 1900 AND 2100),
  recent_year integer CHECK (recent_year IS NULL OR (initial_year IS NOT NULL AND recent_year BETWEEN initial_year AND 2100)),
  certified_at text,
  is_active boolean NOT NULL DEFAULT true,
  source_file text, source_sheet text, source_row integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.certifications(person_id);
CREATE INDEX ON public.people(student_no);
CREATE TABLE public.person_aliases (
  old_id uuid PRIMARY KEY,
  person_id uuid NOT NULL REFERENCES public.people(id)
);
CREATE TABLE public.import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE,
  file_name text NOT NULL,
  file_hash text NOT NULL,
  operator_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  backup jsonb NOT NULL,
  result jsonb NOT NULL
);
-- Keep every old profile intact. Ambiguous multiple profiles are explicitly merged in the admin UI.
INSERT INTO public.people(id,certificate_name,student_no,photo_url,tags,description,qrcode_url,is_active,sort_order,created_at)
SELECT id,certificate_name,substring(upper(btrim(certificate_no)) from '-([0-9]{7})$'),
 coalesce(photo_url,''),coalesce(tags,'[]'),coalesce(description,''),coalesce(qrcode_url,''),coalesce(is_active,true),coalesce(sort_order,0),created_at FROM public.teachers;
INSERT INTO public.certifications(person_id,certificate_no,qualification,initial_year,certified_at,is_active)
SELECT id,upper(btrim(certificate_no)),coalesce(qualification,''),
 CASE WHEN certified_at ~ '^(19|20)[0-9]{2}' THEN substring(certified_at,1,4)::integer END,
 certified_at,coalesce(is_active,true) FROM public.teachers;
INSERT INTO public.person_aliases SELECT id,id FROM public.people;

ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.people,public.certifications TO authenticated;
GRANT SELECT ON public.people,public.certifications,public.person_aliases TO anon,authenticated;
GRANT SELECT ON public.import_batches TO authenticated;
CREATE POLICY people_public ON public.people FOR SELECT TO anon,authenticated USING(is_active);
CREATE POLICY people_admin ON public.people FOR ALL TO authenticated USING(public.is_admin()) WITH CHECK(public.is_admin());
CREATE POLICY certifications_public ON public.certifications FOR SELECT TO anon,authenticated USING(is_active AND EXISTS(SELECT 1 FROM public.people p WHERE p.id=person_id AND p.is_active));
CREATE POLICY certifications_admin ON public.certifications FOR ALL TO authenticated USING(public.is_admin()) WITH CHECK(public.is_admin());
CREATE POLICY aliases_public ON public.person_aliases FOR SELECT TO anon,authenticated USING(EXISTS(SELECT 1 FROM public.people p WHERE p.id=person_id AND p.is_active));
CREATE POLICY aliases_admin ON public.person_aliases FOR SELECT TO authenticated USING(public.is_admin());
CREATE POLICY imports_admin ON public.import_batches FOR SELECT TO authenticated USING(public.is_admin());

-- Replace existing policies; ordinary signed-in users must never inherit admin access.
DO $$ DECLARE r record; t text; BEGIN
 FOR r IN SELECT schemaname,tablename,policyname FROM pg_policies WHERE schemaname='public' AND tablename IN ('teachers','organization_info','courses','users_profile','user_course_progress') LOOP
  EXECUTE format('DROP POLICY %I ON %I.%I',r.policyname,r.schemaname,r.tablename);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['organization_info','courses','users_profile','user_course_progress'] LOOP
  EXECUTE format('CREATE POLICY admin_only ON public.%I FOR ALL TO authenticated USING(public.is_admin()) WITH CHECK(public.is_admin())',t);
 END LOOP;
END $$;
CREATE POLICY legacy_admin_read ON public.teachers FOR SELECT TO authenticated USING(public.is_admin());
CREATE POLICY org_public ON public.organization_info FOR SELECT TO anon,authenticated USING(true);
CREATE POLICY courses_public ON public.courses FOR SELECT TO anon,authenticated USING(is_published);
DROP POLICY IF EXISTS "Auth Insert" ON storage.objects;
DROP POLICY IF EXISTS "Auth Update" ON storage.objects;
DROP POLICY IF EXISTS "Auth Delete" ON storage.objects;
CREATE POLICY images_admin_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='images' AND public.is_admin());
CREATE POLICY images_admin_update ON storage.objects FOR UPDATE TO authenticated USING(bucket_id='images' AND public.is_admin()) WITH CHECK(bucket_id='images' AND public.is_admin());
CREATE POLICY images_admin_delete ON storage.objects FOR DELETE TO authenticated USING(bucket_id='images' AND public.is_admin());

CREATE FUNCTION public.qualification_key(v text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE v WHEN '柔丝咨询师导师' THEN '咨询师导师' WHEN '柔丝咨询师' THEN '咨询师'
 WHEN '柔丝咨询师（实习）' THEN '咨询师实习' WHEN '柔丝辅导师' THEN '辅导师'
 WHEN '柔丝辅导师（实习）' THEN '辅导师实习' WHEN '柔丝科普师' THEN '科普师'
 WHEN '柔丝好家长' THEN '好家长' ELSE v END
$$;

-- One transaction per confirmed import. No updates or deletes of existing people/certificates.
-- Both preview and commit recheck database state. The request UUID makes an uncertain retry safe.
CREATE FUNCTION public.import_certifications(p_rows jsonb,p_file_name text,p_file_hash text,p_request_id uuid,p_preview boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r jsonb; c public.certifications%ROWTYPE; p public.people%ROWTYPE;
 n text; cert text; qual text; student text; iy integer; ry integer; ids uuid[];
 results jsonb := '[]'; snapshot jsonb; answer jsonb; existing_result jsonb;
 status text; reason text; target uuid; inserted integer:=0; seen text[]:='{}';
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION '需要管理员权限' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION '导入参数无效'; END IF;
 IF jsonb_array_length(p_rows)>5000 OR p_file_name IS NULL OR length(p_file_name)>255 OR p_file_hash IS NULL OR p_file_hash !~ '^[a-f0-9]{64}$' OR p_request_id IS NULL THEN RAISE EXCEPTION '导入参数无效'; END IF;
 PERFORM pg_advisory_xact_lock(20260914,1);
 SELECT result INTO existing_result FROM public.import_batches WHERE request_id=p_request_id;
 IF FOUND THEN
  IF existing_result->>'input_hash' IS DISTINCT FROM md5(p_rows::text || p_file_name || p_file_hash) THEN RAISE EXCEPTION '提交编号已用于另一组数据'; END IF;
  RETURN existing_result;
 END IF;
 IF NOT p_preview THEN
  LOCK TABLE public.people,public.certifications IN SHARE ROW EXCLUSIVE MODE;
  SELECT jsonb_build_object('people',coalesce((SELECT jsonb_agg(t) FROM public.people t),'[]'), 'certifications',coalesce((SELECT jsonb_agg(t) FROM public.certifications t),'[]'), 'aliases',coalesce((SELECT jsonb_agg(t) FROM public.person_aliases t),'[]')) INTO snapshot;
 END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
  n:=btrim(r->>'name'); cert:=upper(btrim(r->>'certificate_no')); qual:=r->>'qualification';
  status:='invalid'; reason:=''; target:=NULL; iy:=NULL; ry:=NULL;
  BEGIN
   iy:=nullif(r->>'initial_year','')::integer; ry:=nullif(r->>'recent_year','')::integer;
   IF n IS NULL OR length(n) NOT BETWEEN 1 AND 100 OR cert IS NULL OR cert !~ '^DEA-[A-Z]+-[0-9]{7}$'
    OR qual IS NULL OR qual NOT IN ('咨询师导师','咨询师','咨询师实习','辅导师','辅导师实习','科普师','好家长')
    OR iy IS NULL OR iy NOT BETWEEN 1900 AND 2100 OR (ry IS NOT NULL AND (ry<iy OR ry>2100)) THEN
    reason:='姓名、证书编号、资格或年份不合法';
   ELSIF split_part(cert,'-',2) <> (CASE qual WHEN '咨询师导师' THEN 'RZXDS' WHEN '咨询师' THEN 'RZX' WHEN '咨询师实习' THEN 'RZXI' WHEN '辅导师' THEN 'RFD' WHEN '辅导师实习' THEN 'RFDI' WHEN '科普师' THEN 'RK' WHEN '好家长' THEN 'RHJ' END) THEN reason:='证书编号与资格分类不匹配';
   ELSIF EXISTS(SELECT 1 FROM jsonb_array_elements(p_rows) x WHERE upper(btrim(x->>'certificate_no'))=cert AND (jsonb_build_array(btrim(x->>'name'),x->>'nickname',x->>'qualification',x->>'initial_year',x->>'recent_year') IS DISTINCT FROM jsonb_build_array(n,r->>'nickname',qual,r->>'initial_year',r->>'recent_year'))) THEN status:='conflict'; reason:='文件内同一证书内容冲突';
   ELSIF EXISTS(SELECT 1 FROM jsonb_array_elements(p_rows) x WHERE substring(upper(btrim(x->>'certificate_no')) from '-([0-9]{7})$')=substring(cert from '-([0-9]{7})$') AND btrim(x->>'name') IS DISTINCT FROM n) THEN status:='conflict'; reason:='文件内相同学号尾段的姓名不同';
   ELSIF cert=ANY(seen) THEN status:='duplicate'; reason:='文件内重复编号';
   ELSE
    seen:=array_append(seen,cert);
    SELECT * INTO c FROM public.certifications WHERE certificate_no=cert;
    IF FOUND THEN
     SELECT * INTO p FROM public.people WHERE id=c.person_id;
     IF p.certificate_name<>n OR public.qualification_key(c.qualification)<>qual OR c.initial_year IS DISTINCT FROM iy OR c.recent_year IS DISTINCT FROM ry THEN
      status:='conflict'; reason:='已有编号的姓名、资格或年份不同，保留原数据';
     ELSE status:='skipped'; reason:='证书已存在'; END IF;
    ELSE
     student:=substring(cert from '-([0-9]{7})$');
     SELECT array_agg(id) INTO ids FROM public.people WHERE student_no=student;
     IF coalesce(cardinality(ids),0)>1 THEN status:='conflict'; reason:='学号尾段对应多个旧档案，请先在人员管理合并';
     ELSIF cardinality(ids)=1 THEN
      SELECT * INTO p FROM public.people WHERE id=ids[1];
      IF p.certificate_name<>n THEN status:='conflict'; reason:='相同学号尾段的姓名不同，需要核实';
      ELSE target:=p.id; status:='new'; END IF;
     ELSIF EXISTS(SELECT 1 FROM public.people WHERE certificate_name=n) THEN
      status:='conflict'; reason:='存在同名但不同学号的档案，需要核实';
     ELSE status:='new'; END IF;
     IF status='new' AND NOT p_preview THEN
      IF target IS NULL THEN
       INSERT INTO public.people(certificate_name,nickname,student_no) VALUES(n,left(coalesce(r->>'nickname',''),100),student) RETURNING id INTO target;
      END IF;
      INSERT INTO public.certifications(person_id,certificate_no,qualification,initial_year,recent_year,source_file,source_sheet,source_row)
      VALUES(target,cert,qual,iy,ry,p_file_name,left(r->>'sheet',100),(r->>'row')::integer);
      inserted:=inserted+1;
     END IF;
    END IF;
   END IF;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN status:='invalid'; reason:='年份或行号格式错误';
  END;
  results:=results || jsonb_build_array(r || jsonb_build_object('status',status,'reason',reason));
 END LOOP;
 answer:=jsonb_build_object('rows',results,'inserted',inserted,'preview',p_preview,'request_id',p_request_id,'input_hash',md5(p_rows::text || p_file_name || p_file_hash));
 IF NOT p_preview THEN
  INSERT INTO public.import_batches(request_id,file_name,file_hash,operator_id,backup,result) VALUES(p_request_id,p_file_name,p_file_hash,auth.uid(),snapshot,answer);
 END IF;
 RETURN answer;
END $$;
REVOKE ALL ON FUNCTION public.import_certifications(jsonb,text,text,uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_certifications(jsonb,text,text,uuid,boolean) TO authenticated;

-- Explicit administrator merge; reject conflicting edited fields instead of silently losing them.
CREATE FUNCTION public.merge_people(p_keep uuid,p_remove uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.people%ROWTYPE; b public.people%ROWTYPE; snapshot jsonb;
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION '需要管理员权限' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(20260914,1);
 LOCK TABLE public.people,public.certifications IN SHARE ROW EXCLUSIVE MODE;
 SELECT * INTO STRICT a FROM public.people WHERE id=p_keep;
 SELECT * INTO STRICT b FROM public.people WHERE id=p_remove;
 IF p_keep=p_remove OR a.certificate_name<>b.certificate_name OR a.student_no IS DISTINCT FROM b.student_no OR a.student_no IS NULL THEN RAISE EXCEPTION '仅可合并姓名和学号尾段均相同的档案'; END IF;
 IF (a.photo_url<>'' AND b.photo_url<>'' AND a.photo_url<>b.photo_url)
 OR (a.description<>'' AND b.description<>'' AND a.description<>b.description)
 OR (a.qrcode_url<>'' AND b.qrcode_url<>'' AND a.qrcode_url<>b.qrcode_url)
 OR (a.nickname<>'' AND b.nickname<>'' AND a.nickname<>b.nickname)
 OR a.is_active<>b.is_active OR a.sort_order<>b.sort_order THEN RAISE EXCEPTION '档案资料或展示设置有冲突，请先核实并统一后合并'; END IF;
 SELECT jsonb_build_object('people',jsonb_build_array(to_jsonb(a),to_jsonb(b)), 'certifications',(SELECT jsonb_agg(t) FROM public.certifications t WHERE person_id IN(p_keep,p_remove)), 'aliases',(SELECT jsonb_agg(t) FROM public.person_aliases t WHERE person_id IN(p_keep,p_remove))) INTO snapshot;
 UPDATE public.people SET photo_url=coalesce(nullif(a.photo_url,''),b.photo_url),description=coalesce(nullif(a.description,''),b.description),qrcode_url=coalesce(nullif(a.qrcode_url,''),b.qrcode_url),nickname=coalesce(nullif(a.nickname,''),b.nickname),tags=(SELECT coalesce(jsonb_agg(DISTINCT value),'[]') FROM jsonb_array_elements(a.tags||b.tags)) WHERE id=p_keep;
 UPDATE public.certifications SET person_id=p_keep WHERE person_id=p_remove;
 UPDATE public.person_aliases SET person_id=p_keep WHERE person_id=p_remove;
 INSERT INTO public.person_aliases VALUES(p_remove,p_keep) ON CONFLICT(old_id) DO UPDATE SET person_id=p_keep;
 DELETE FROM public.people WHERE id=p_remove;
 INSERT INTO public.import_batches(request_id,file_name,file_hash,operator_id,backup,result) VALUES(gen_random_uuid(),'人员合并','',auth.uid(),snapshot,jsonb_build_object('keep',p_keep,'remove',p_remove));
END $$;
REVOKE ALL ON FUNCTION public.merge_people(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_people(uuid,uuid) TO authenticated;
COMMIT;
