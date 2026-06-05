-- ============================================================
-- Truco Venezolano — Schema SQL
-- Ejecutar en: Supabase → SQL Editor → New Query
-- ============================================================

create extension if not exists "uuid-ossp";

-- ─── Profiles ────────────────────────────────────────────────
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text not null,
  avatar_id int not null default 0,
  games_played int not null default 0,
  games_won int not null default 0,
  games_lost int not null default 0,
  current_streak int not null default 0,
  created_at timestamptz default now()
);

-- Auto-crear perfil al registrarse
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── Rooms ───────────────────────────────────────────────────
create table public.rooms (
  id uuid default uuid_generate_v4() primary key,
  code text not null unique,
  mode text not null,
  max_points int not null default 12,
  visibility text not null default 'public',
  status text not null default 'waiting',
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── Room players ─────────────────────────────────────────────
create table public.room_players (
  room_id uuid references public.rooms(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  position int not null default 0,
  is_ready boolean not null default false,
  is_connected boolean not null default true,
  primary key (room_id, user_id)
);

-- ─── Game state ───────────────────────────────────────────────
create table public.game_state (
  room_id uuid references public.rooms(id) on delete cascade primary key,
  state jsonb not null,
  updated_at timestamptz default now()
);

-- ─── Game actions log ─────────────────────────────────────────
create table public.game_actions (
  id uuid default uuid_generate_v4() primary key,
  room_id uuid references public.rooms(id) on delete cascade,
  user_id uuid references public.profiles(id),
  action_type text not null,
  payload jsonb not null default '{}',
  created_at timestamptz default now()
);

-- ─── Chat messages ────────────────────────────────────────────
create table public.messages (
  id uuid default uuid_generate_v4() primary key,
  room_id uuid references public.rooms(id) on delete cascade,
  user_id uuid references public.profiles(id),
  content text not null,
  is_quick_reply boolean not null default false,
  created_at timestamptz default now()
);

-- ─── Row Level Security ───────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.room_players enable row level security;
alter table public.game_state enable row level security;
alter table public.game_actions enable row level security;
alter table public.messages enable row level security;

-- profiles
create policy "profiles_select" on public.profiles for select using (true);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

-- rooms
create policy "rooms_select" on public.rooms for select using (true);
create policy "rooms_insert" on public.rooms for insert with check (auth.uid() = created_by);
create policy "rooms_update" on public.rooms for update using (true);

-- room_players
create policy "room_players_select" on public.room_players for select using (true);
create policy "room_players_insert" on public.room_players for insert with check (auth.uid() = user_id);
create policy "room_players_update" on public.room_players for update using (auth.uid() = user_id);
create policy "room_players_delete" on public.room_players for delete using (auth.uid() = user_id);

-- game_state
create policy "game_state_select" on public.game_state for select using (true);
create policy "game_state_insert" on public.game_state for insert with check (true);
create policy "game_state_update" on public.game_state for update using (true);

-- game_actions
create policy "game_actions_select" on public.game_actions for select using (true);
create policy "game_actions_insert" on public.game_actions for insert with check (auth.uid() = user_id);

-- messages
create policy "messages_select" on public.messages for select using (true);
create policy "messages_insert" on public.messages for insert with check (auth.uid() = user_id);

-- ─── Realtime ─────────────────────────────────────────────────
-- Habilitar realtime para las tablas necesarias
-- (hacer esto en Supabase → Database → Replication → Tables)
-- Tablas: room_players, rooms, game_state, game_actions, messages
