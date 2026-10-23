-- Run AFTER schema.sql. Safe to rerun. These tables are server-only.
create table if not exists public.studio_records (
  bucket text not null check (bucket in ('queue','status','reviews')),
  key text not null, document jsonb not null,
  updated_at timestamptz not null default now(), primary key(bucket,key)
);
alter table public.studio_records enable row level security;
revoke all on public.studio_records from public, anon, authenticated;
grant all on public.studio_records to service_role;

-- A compare-and-swap makes cancellation and worker claims mutually exclusive.
create or replace function public.transition_studio_queue(p_id uuid, p_from text, p_to text, p_patch jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare result jsonb;
begin
  update public.studio_records
  set document = document || (p_patch - 'id' - 'created_at') || jsonb_build_object('status',p_to), updated_at=now()
  where bucket='queue' and key=p_id::text and document->>'status'=p_from
  returning document into result;
  return result;
end; $$;
revoke all on function public.transition_studio_queue(uuid,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.transition_studio_queue(uuid,text,text,jsonb) to service_role;

-- Persist the claim BEFORE delivery or further AI calls. A crash cannot replay
-- an approval from the old WAITING state. Interrupted work needs human review.
create or replace function public.claim_studio_review(p_id uuid, p_expected jsonb, p_next text)
returns boolean language plpgsql security invoker set search_path = public as $$
declare changed integer;
begin
  if p_next not in ('RUNNING','DELIVERING') then return false; end if;
  update public.missions set status=p_next, snapshot=jsonb_set(snapshot,'{status}',to_jsonb(p_next))
  where id=p_id and status in ('WAITING_APPROVAL','WAITING_CLARIFICATION') and snapshot=p_expected;
  get diagnostics changed = row_count;
  return changed=1;
end; $$;
revoke all on function public.claim_studio_review(uuid,jsonb,text) from public, anon, authenticated;
grant execute on function public.claim_studio_review(uuid,jsonb,text) to service_role;
