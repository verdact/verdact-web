-- RLS still restricts which rows each merchant can read; these grants only let
-- PostgREST reach the tables so the Stage 1D dashboard read layer can query them.

grant select on public.disputes to authenticated;
grant select on public.efw_alerts to authenticated;
grant select on public.dispute_events to authenticated;
grant select on public.vamp_snapshots to authenticated;
