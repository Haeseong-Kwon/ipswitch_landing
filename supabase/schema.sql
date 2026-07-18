-- Harris Prep 랜딩 리드 수집 스키마
-- Supabase 프로젝트 생성 후 SQL Editor에 그대로 붙여넣어 실행하세요.
-- 재실행해도 안전합니다(idempotent).

create table if not exists public.leads (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),

  -- 유입 경로 구분: diagnostic(로드맵 진단) / summary_pdf(요약본 신청)
  type          text not null default 'diagnostic',

  -- 최종 단계 입력 정보
  parent_name   text,
  phone         text,
  child_grade   text,
  email         text,

  -- 12문항 진단 결과
  result_type   text,   -- 예: HHT
  result_name   text,   -- 예: 최상위 실전형
  scores        jsonb,  -- {"완성도":100,"정밀도":66,"트랙":88,"타이밍":77}
  answers       jsonb,  -- [{no,area,question,answer,score}, ...] 12개

  -- 동의
  consent           boolean not null default false,  -- [필수] 개인정보 수집·이용
  consent_marketing boolean not null default false,  -- [선택] 마케팅 수신

  -- 유입 추적
  utm_source text, utm_medium text, utm_campaign text,
  utm_content text, utm_term text,
  referrer text, page_path text, user_agent text
);

-- 기존 테이블이 있던 경우를 위한 컬럼 보강
alter table public.leads add column if not exists result_type       text;
alter table public.leads add column if not exists result_name       text;
alter table public.leads add column if not exists scores            jsonb;
alter table public.leads add column if not exists answers           jsonb;
alter table public.leads add column if not exists consent           boolean not null default false;
alter table public.leads add column if not exists consent_marketing boolean not null default false;

-- 대시보드는 최신순 조회가 기본
create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_type_idx       on public.leads (type);

-- RLS 활성화 + 정책 없음 = anon/authenticated 키로는 읽기·쓰기 모두 차단.
-- 서버(API 함수)의 service_role 키만 RLS를 우회합니다.
alter table public.leads enable row level security;
