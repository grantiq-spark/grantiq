# GRANTIQ — Slack-First R&D Opportunity Intelligence

Slack을 기본 운영 채널로 사용하는 R&D 공고 탐지 + 가상 이사회 심의 + 사업계획서 초안 자동 생성 시스템.

**웹 UI는 보조 Admin Console**이며, 실제 운영은 Slack에서 이루어집니다.

---

## 시스템 플로우

```
[파일 업로드 → Slack]
  → /api/slack/events (file_shared)
  → 문서 파싱 + 회사 메모리 추출 + DB 저장
  → Slack thread에 추출 요약 회신

[공고 탐지]
  → /api/monitor/opportunities (GET/POST 수동 또는 cron)
  → fetchOpportunities() → verifyOpportunity() → DB 저장
  → 점수 ≥ 55점: Slack 채널에 공고 카드 게시
  → 점수 ≥ AUTO_BOARD_THRESHOLD: 자동 이사회 심의 시작

[이사회 심의 — Slack thread]
  → CTO → CFO → CSO → BizDev → Orchestrator 종합
  → GO / HOLD / REJECT 결정

[사업계획서 생성]
  → /api/slack/interactivity (generate_proposal 버튼)
  → generateProposal() → Slack thread에 섹션별 초안 게시

[Admin Console — 웹]
  → pages/index.js → /api/admin/status
  → 메모리 현황 / 공고 목록 / 이사회 이력 / 문서 목록
```

---

## 환경변수

```bash
# Anthropic (필수)
ANTHROPIC_API_KEY=sk-ant-...

# Slack (필수)
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
SLACK_NOTIFY_CHANNEL=C...          # 공고 알림 채널 ID

# 모니터링
MONITOR_ENABLED=true
AUTO_BOARD_THRESHOLD=80            # 이 점수 이상이면 이사회 심의 자동 시작
CRON_SECRET=your-random-secret     # /api/monitor/opportunities 보호용

# DB (선택 — 없으면 in-memory fallback)
DATABASE_URL=postgresql://...

# 회사
NEXT_PUBLIC_COMPANY_NAME=My Company
COMPANY_ID=default
```

---

## Slack App 설정

### Bot Token Scopes

| Scope | 용도 |
|-------|------|
| `app_mentions:read` | @GRANTIQ 멘션 수신 |
| `chat:write` | 메시지 전송 |
| `files:read` | 파일 다운로드 |
| `reactions:write` | 파일 처리 이모지 |

### Event Subscriptions

**Request URL:** `https://YOUR_DOMAIN/api/slack/events`

- `app_mention`
- `file_shared`

### Interactivity

**Request URL:** `https://YOUR_DOMAIN/api/slack/interactivity`

지원 block_actions:
- `start_board_review`
- `generate_proposal`
- `refresh_memory`
- `rerun_monitor`

---

## @GRANTIQ 명령어

| 명령 | 동작 |
|------|------|
| `@GRANTIQ monitor now` | 공고 탐색 실행 |
| `@GRANTIQ memory status` | 회사 메모리 현황 |
| `@GRANTIQ review <id>` | 이사회 심의 |
| `@GRANTIQ proposal <id>` | 사업계획서 생성 |
| `@GRANTIQ help` | 명령어 목록 |

---

## 파일 인제스트

Slack에 파일(PDF/TXT) 업로드 시 자동 실행:

1. `files.info` API로 파일 메타데이터 조회
2. Bot Token으로 파일 다운로드
3. PDF → `lib/ingest/parsePdf.js` (pdf-parse + fallback)
4. `lib/ingest/extractCompanyMemory.js` → Claude API로 구조화된 메모리 추출
5. DB 저장: source_documents, capabilities, past_projects, evidence_snippets
6. Slack thread 회신: 추출 결과 요약

---

## 공고 모니터링

```bash
# 수동 실행
curl -H "x-cron-secret: $CRON_SECRET" https://YOUR_DOMAIN/api/monitor/opportunities
```

**Vercel Hobby 제한:** Hobby 플랜은 일 1회 cron만 가능합니다.
더 자주 실행하려면 GitHub Actions 등 외부 스케줄러에서 위 endpoint를 호출하세요.

---

## 이사회 심의 에이전트

- 🔧 **CTO** — 기술 적합성
- 💰 **CFO** — 예산·수익성
- 🎯 **CSO** — 전략 적합성
- 🤝 **BizDev** — 사업 가능성
- 🏛️ **Orchestrator** — 최종 판단 (GO / HOLD / REJECT)

---

## 로컬 개발

```bash
npm install
cp .env.example .env.local
npm run dev   # http://localhost:3000
```

---

## Vercel 배포

```bash
npm i -g vercel
vercel env add ANTHROPIC_API_KEY
vercel env add SLACK_BOT_TOKEN
vercel env add SLACK_SIGNING_SECRET
vercel env add SLACK_NOTIFY_CHANNEL
vercel --prod
```

---

## 보안

- `SLACK_SIGNING_SECRET` 미설정 시 모든 Slack 요청 거부 (401)
- HMAC-SHA256 서명 검증 + 5분 replay attack 방지
- `timingSafeEqual` 로 timing attack 방지
- `CRON_SECRET` 으로 monitor endpoint 보호

---

## 기술 스택

- **Frontend**: Next.js 14 Pages Router, React 18
- **AI**: Anthropic Claude (web_search server tool, pause_turn 지원)
- **Messaging**: Slack Web API
- **DB**: in-memory store (기본) / PostgreSQL (DATABASE_URL 설정 시)
- **Deploy**: Vercel
