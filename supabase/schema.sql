-- Run once in a new Bej Hub project's Supabase SQL editor.
-- Private server-side mirror; no anonymous or browser access is granted.
create table if not exists public.missions (
  id uuid primary key, prompt text not null, status text not null,
  created_by text not null, created_at timestamptz not null,
  requires_human_approval boolean not null default false,
  tokens_used bigint not null default 0, snapshot jsonb not null
);
create table if not exists public.agents (
  id text primary key, name text not null, role text not null,
  current_state text not null default 'IDLE', x_coord int not null,
  y_coord int not null, model_used text, updated_at timestamptz not null
);
create table if not exists public.agent_logs (
  mission_id uuid references public.missions(id), event_index int,
  agent_id text not null, thought_summary text not null,
  tool_called text, timestamp timestamptz not null, event jsonb not null,
  primary key (mission_id, event_index)
);
alter table public.missions enable row level security;
alter table public.agents enable row level security;
alter table public.agent_logs enable row level security;
revoke all on public.missions, public.agents, public.agent_logs from anon, authenticated;
grant all on public.missions, public.agents, public.agent_logs to service_role;

create or replace function public.sync_studio_mission(p_mission jsonb)
returns void language plpgsql security invoker set search_path = public as $$
declare e jsonb; n bigint; agent_time timestamptz; agent_state text;
begin
  insert into public.missions(id,prompt,status,created_by,created_at,tokens_used,snapshot)
  values ((p_mission->>'id')::uuid,p_mission->>'prompt',p_mission->>'status',p_mission->>'created_by',(p_mission->>'created_at')::timestamptz,(p_mission->>'tokens_used')::bigint,p_mission)
  on conflict (id) do update set status=excluded.status,tokens_used=excluded.tokens_used,snapshot=excluded.snapshot;
  for e,n in select value,ordinality from jsonb_array_elements(p_mission->'events') with ordinality loop
    insert into public.agent_logs(mission_id,event_index,agent_id,thought_summary,timestamp,event)
    values ((p_mission->>'id')::uuid,n::int,e->>'agent_id',e->>'speech_bubble',(e->>'timestamp')::timestamptz,e)
    on conflict do nothing;
    agent_time := (e->>'timestamp')::timestamptz;
    agent_state := case when p_mission->>'status'='COMPLETED' then 'IDLE' else e->>'next_state' end;
    insert into public.agents(id,name,role,current_state,x_coord,y_coord,model_used,updated_at)
    values (e->>'agent_id',case e->>'agent_id' when 'manager' then 'Bej Manager' when 'researcher' then 'Research Bot' else 'Writer Bot' end,
      e->>'agent_id',agent_state,case e->>'agent_id' when 'manager' then 235 when 'researcher' then 480 else 725 end,260,p_mission->>'mode',agent_time)
    on conflict(id) do update set current_state=excluded.current_state,model_used=excluded.model_used,updated_at=excluded.updated_at
      where agents.updated_at <= excluded.updated_at;
  end loop;
end; $$;
revoke all on function public.sync_studio_mission(jsonb) from public,anon,authenticated;
grant execute on function public.sync_studio_mission(jsonb) to service_role;
