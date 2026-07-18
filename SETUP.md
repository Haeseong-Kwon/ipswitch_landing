# 리드 수집 · 대시보드 설정 가이드

랜딩 → Supabase 저장 → 대시보드 조회까지의 설정 절차입니다.

## 전체 흐름

```
QR 스캔 → 랜딩(index.html)
  → '무료 로드맵 진단 시작' → 12문항 선택 → 성함/휴대폰/자녀학년 입력
  → POST /api/lead → Supabase leads 테이블 저장
  → /dashboard.html (비밀번호 인증) → GET /api/leads → 한눈에 조회 · CSV 내보내기
```

## 1. Supabase 프로젝트 생성

1. https://supabase.com 에서 새 프로젝트 생성 (Region: **Northeast Asia (Seoul)** 권장)
2. 좌측 **SQL Editor** → `supabase/schema.sql` 내용을 붙여넣고 **Run**
3. **Table Editor** 에서 `leads` 테이블이 생성됐는지 확인

## 2. 키 확인

Supabase 대시보드 → **Project Settings → API**

| 항목 | 사용처 |
|---|---|
| Project URL | `SUPABASE_URL` |
| `service_role` secret key | `SUPABASE_SERVICE_ROLE_KEY` |

> ⚠️ `service_role` 키는 RLS를 우회하는 마스터 키입니다.
> Vercel 환경변수에만 저장하고, 프론트엔드 코드·깃 저장소에는 절대 넣지 마세요.
> (현재 구조상 이 키는 서버 함수 안에서만 쓰이며 브라우저로 전송되지 않습니다.)

## 3. Vercel 환경변수 등록

Vercel 프로젝트 → **Settings → Environment Variables** (Production/Preview 모두 체크)

### 필수

| 변수명 | 값 |
|---|---|
| `SUPABASE_URL` | `https://xxxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role 키 |
| `DASHBOARD_PASSWORD` | 대시보드 접속 비밀번호 (직접 지정, 20자 이상 랜덤 권장) |

### 선택

| 변수명 | 용도 |
|---|---|
| `SLACK_WEBHOOK_URL` | 신규 신청 시 슬랙 실시간 알림 |
| `RESEND_API_KEY`, `SUMMARY_PDF_URL`, `LEAD_NOTIFY_FROM` | 요약본 PDF 자동 발송 |
| `KLAVIYO_API_KEY`, `KLAVIYO_LIST_ID` | 이메일 리스트 연동 |

비밀번호 생성 예시:

```bash
openssl rand -base64 24
```

환경변수 등록 후 **반드시 재배포**해야 반영됩니다 (Deployments → 최신 배포 → Redeploy).

## 4. 대시보드 사용

접속 주소: `https://<도메인>/dashboard.html`

- `DASHBOARD_PASSWORD` 입력 후 접속 (세션 동안만 유지, 탭 닫으면 재로그인)
- **KPI**: 전체/오늘/최근 7일/진단 건수, 마케팅 동의 수
- **표**: 신청일시·성함·연락처·학년·진단유형·4개 영역 점수·마케팅 동의·유입
- **행 클릭**: 12문항 질문과 선택한 답변 전체 + 영역별 점수 + 유입 상세
- **검색/필터**: 이름·연락처·유형 검색, 구분/학년/기간 필터
- **CSV 내려받기**: 현재 필터가 적용된 목록을 엑셀용(BOM 포함)으로 저장

## 5. 저장되는 데이터

| 컬럼 | 내용 |
|---|---|
| `parent_name`, `phone`, `child_grade` | 최종 단계 입력 3개 항목 |
| `answers` (jsonb) | 12문항 `{no, area, question, answer, score}` 전체 |
| `scores` (jsonb) | 완성도·정밀도·트랙·타이밍 영역별 점수(0–100) |
| `result_type`, `result_name` | 진단 결과 코드 / 유형명 |
| `consent`, `consent_marketing` | 필수·선택 동의 여부 |
| `utm_*`, `referrer`, `page_path` | 유입 추적 (QR 링크에 `?utm_source=qr` 등을 붙이면 구분 가능) |

## 6. 로컬 테스트

```bash
npm install
npx vercel dev
```

`.env.local` 에 위 환경변수를 동일하게 넣으면 `http://localhost:3000/dashboard.html` 에서 확인할 수 있습니다.

## 보안 메모

- `leads` 테이블은 RLS 활성 + 정책 없음 → anon 키로는 조회·삽입 모두 불가. 서버 함수만 접근 가능합니다.
- 대시보드는 `noindex` 처리되어 검색엔진에 노출되지 않습니다.
- 개인정보가 담긴 화면이므로 대시보드 비밀번호는 운영진 외 공유하지 마세요.
- 더 강한 보안이 필요해지면(운영진 개인별 계정, 접근 로그) Supabase Auth 기반으로 전환하는 것을 권장합니다.
