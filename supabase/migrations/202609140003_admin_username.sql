BEGIN;
ALTER TABLE public.admin_users ADD COLUMN username text UNIQUE
 CHECK (username ~ '^[a-z][a-z0-9_]{2,31}$');
-- Only the trusted login function may look up usernames. No anonymous directory.
GRANT SELECT ON public.admin_users TO service_role;
COMMENT ON COLUMN public.admin_users.username IS 'Optional lowercase login name; passwords remain in Supabase Auth.';
NOTIFY pgrst, 'reload schema';
COMMIT;
