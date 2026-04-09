create extension if not exists pgcrypto;

create table if not exists public.experiment_records (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  student_id text,
  group_no text,
  experiment_date date,
  salt_concentration numeric not null check (salt_concentration in (0, 1, 3, 4)),
  peel_mass numeric not null check (peel_mass > 0),
  oil_mass numeric not null check (oil_mass > 0),
  yield_percent numeric not null check (yield_percent >= 0),
  replicate_no integer,
  note text
);

alter table public.experiment_records enable row level security;

create policy "public can read experiment records"
on public.experiment_records
for select
using (true);

create policy "public can insert experiment records"
on public.experiment_records
for insert
with check (true);

insert into public.experiment_records (
  name, student_id, group_no, experiment_date, salt_concentration, peel_mass, oil_mass, yield_percent, replicate_no, note
)
values
('张三', '2026001', 'A1', '2026-04-09', 0, 50, 0.62, 1.24, 1, '纯水对照'),
('李四', '2026002', 'A1', '2026-04-09', 0, 50, 0.58, 1.16, 2, '纯水对照'),
('王五', '2026003', 'A2', '2026-04-09', 0, 50, 0.61, 1.22, 1, null),
('赵六', '2026004', 'A2', '2026-04-09', 1, 50, 0.69, 1.38, 1, null),
('钱七', '2026005', 'A2', '2026-04-09', 1, 50, 0.71, 1.42, 2, null),
('孙八', '2026006', 'A3', '2026-04-09', 1, 50, 0.70, 1.40, 1, null),
('周九', '2026007', 'A3', '2026-04-09', 3, 50, 0.82, 1.64, 1, '当前最优'),
('吴十', '2026008', 'A3', '2026-04-09', 3, 50, 0.79, 1.58, 2, null),
('郑一', '2026009', 'A4', '2026-04-09', 3, 50, 0.81, 1.62, 1, null),
('王二', '2026010', 'A4', '2026-04-09', 4, 50, 0.74, 1.48, 1, null),
('陈三', '2026011', 'A4', '2026-04-09', 4, 50, 0.76, 1.52, 2, null),
('刘四', '2026012', 'A5', '2026-04-09', 4, 50, 0.73, 1.46, 1, null);
