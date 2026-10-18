-- Keep privileged push credentials out of the public RPC surface.
REVOKE EXECUTE ON FUNCTION public.get_push_config() FROM PUBLIC, anon, authenticated;

-- Trigger functions are invoked by PostgreSQL triggers and do not need client EXECUTE grants.
REVOKE EXECUTE ON FUNCTION public.enqueue_push_event() FROM PUBLIC, anon, authenticated;

-- Anonymous comments are public input. Do not fan every comment out as a push notification.
DROP TRIGGER IF EXISTS comments_push_notification ON public.comments;
