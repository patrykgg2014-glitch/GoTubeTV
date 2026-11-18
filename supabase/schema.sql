-- Run in the Supabase SQL Editor. Create a private/public Storage bucket named "videos"
-- with public read enabled only if you intentionally want every published video public.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  is_owner boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text,
  storage_path text not null unique,
  visibility text not null default 'public' check (visibility in ('public','unlisted','private')),
  created_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.likes (
  video_id uuid not null references public.videos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(video_id,user_id)
);

create table if not exists public.subscriptions (
  subscriber_id uuid not null references auth.users(id) on delete cascade,
  channel_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(subscriber_id,channel_id),
  check (subscriber_id <> channel_id)
);

alter table public.profiles enable row level security;
alter table public.videos enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;
alter table public.subscriptions enable row level security;

create policy "profiles readable" on public.profiles for select using (true);
create policy "user creates own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "user updates own username only" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "public videos readable" on public.videos for select using (visibility = 'public' or auth.uid() = user_id);
create policy "users publish own videos" on public.videos for insert with check (auth.uid() = user_id);
create policy "owners edit own videos" on public.videos for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owners delete own videos" on public.videos for delete using (auth.uid() = user_id);

create policy "comments readable" on public.comments for select using (true);
create policy "signed-in users comment" on public.comments for insert with check (auth.uid() = user_id);
create policy "users delete own comments" on public.comments for delete using (auth.uid() = user_id);

create policy "likes readable" on public.likes for select using (true);
create policy "users like as self" on public.likes for insert with check (auth.uid() = user_id);
create policy "users remove own likes" on public.likes for delete using (auth.uid() = user_id);

create policy "subscriptions readable" on public.subscriptions for select using (true);
create policy "users subscribe as self" on public.subscriptions for insert with check (auth.uid() = subscriber_id);
create policy "users unsubscribe as self" on public.subscriptions for delete using (auth.uid() = subscriber_id);

-- Profiles are automatically created after signup. is_owner is always false by default.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Storage policies: users can upload only into a folder named with their auth user id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('videos','videos',true,524288000,array['video/mp4','video/webm','video/quicktime','video/x-matroska'])
on conflict (id) do nothing;

create policy "public can read published video files" on storage.objects
for select using (bucket_id = 'videos');
create policy "users upload into own folder" on storage.objects
for insert with check (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users delete own files" on storage.objects
for delete using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);

-- IMPORTANT: Never allow users to update profiles.is_owner from the browser.
-- Grant owner role manually using Supabase dashboard / trusted server-side admin tooling.


-- Defense in depth: authenticated users cannot promote themselves to owner.
create or replace function public.protect_owner_flag()
returns trigger language plpgsql as $$
begin
  if new.is_owner is distinct from old.is_owner and auth.role() <> 'service_role' then
    raise exception 'Only trusted server-side administration can change owner status';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_owner_flag on public.profiles;
create trigger protect_profile_owner_flag
before update on public.profiles
for each row execute procedure public.protect_owner_flag();
