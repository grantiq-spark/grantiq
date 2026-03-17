# GRANTIQ — Vercel Deploy Checklist

## PHASE 0 MANUAL REQUIRED

```
MANUAL REQUIRED
- Team / Project:         grantiq-spark / grantiq
- grantiq.co project:     UNKNOWN (not yet configured — manual check needed)
- grantiq.vercel.app project: grantiq-sparks-projects/grantiq (confirmed)
- Same project?:          UNKNOWN
- Repo:                   grantiq-spark/grantiq
- Production branch:      main
- Root directory:         / (repo root)
- Domain branch assignment: UNKNOWN
- Deployment Protection method: UNKNOWN
- Deployment Protection scope:  UNKNOWN
- Env parity issues:      see Section 5 below
- Redeploy needed?:       YES — after any env var or branch change
```

---

## 1. 프로젝트 식별

- [ ] **Team:** `grantiq-spark`
- [ ] **Project name:** `grantiq`
- [ ] **Project ID:** _(Vercel Dashboard > Settings > General > Project ID)_
- [ ] **Repo owner/name:** `grantiq-spark/grantiq`
- [ ] **Root directory:** `/` (repo root)
- [ ] **Framework preset:** `Next.js`
- [ ] **Build command:** `next build` (default)
- [ ] **Output directory:** `.next` (default)
- [ ] **Node version:** 18.x or 20.x (check Vercel > Settings > General)

---

## 2. Domain 매핑 확인

- [ ] `grantiq.vercel.app` → project `grantiq` confirmed
- [ ] `grantiq.co` → check Vercel Dashboard > Domains
- [ ] `www.grantiq.co` → check redirect or CNAME
- [ ] Both domains point to same project? _(confirm in Dashboard)_
- [ ] No branch assignment conflict? _(Domains > check "Branch" column)_
- [ ] No redirect loop? _(test `curl -IL https://grantiq.co`)_

---

## 3. Production Branch 확인

- [ ] Current production branch: `main`
- [ ] Vercel Dashboard > Settings > Git > Production Branch = `main`
- [ ] Auto-assign custom production domains: verify ON/OFF setting
- [ ] No other branch (e.g. `staging`, `dev`) accidentally assigned to production domain

---

## 4. Deployment Protection 확인

- [ ] Vercel Dashboard > Settings > Deployment Protection
- [ ] Method: _(Password / Vercel Auth / None)_ — check current setting
- [ ] Scope: _(All Deployments / Preview only / Production only)_
- [ ] Preview deployments protected? _(important for Slack webhook testing)_
- [ ] Production deployment protection? _(must be OFF or bypassed for Slack Events URL)_
- [ ] If protection is ON: Slack cannot send events to protected URLs without bypass
- [ ] Bypass secret: _(if needed, add `x-vercel-protection-bypass` header)_

---

## 5. Environment Variables 확인

Vercel Dashboard > Settings > Environment Variables

### Required (Production)
- [ ] `ANTHROPIC_API_KEY` = `sk-ant-...`
- [ ] `SLACK_BOT_TOKEN` = `xoxb-...`
- [ ] `SLACK_SIGNING_SECRET` = `...`
- [ ] `SLACK_NOTIFY_CHANNEL` = `C...` (channel ID, NOT name)

### Recommended
- [ ] `AUTO_BOARD_THRESHOLD` = `80`
- [ ] `MONITOR_ENABLED` = `true`
- [ ] `CRON_SECRET` = _(random secret for monitor endpoint)_
- [ ] `DATABASE_URL` = `postgresql://...` (if using persistent DB)

### Optional
- [ ] `NEXT_PUBLIC_COMPANY_NAME` = _(your company name — NOT "움틀" or demo value)_
- [ ] `COMPANY_NAME` = _(same as above — used by next.config.js)_
- [ ] `COMPANY_ID` = `default`
- [ ] `INTERNAL_API_SECRET` = _(for /api/slack/webhook)_

### Env Parity Check
- [ ] All Production env vars also set for Preview? _(or intentionally different)_
- [ ] No demo/test values leaked into Production vars
- [ ] No `움틀`, `ContractIQ`, `ContractPlan`, `GrantFlow`, `contractiq.studio` in any var value

---

## 6. 외부 연동 영향 점검

- [ ] Slack Event Subscriptions URL: `https://YOUR_DOMAIN/api/slack/events`
  - [ ] Verified (green checkmark in Slack App settings)
  - [ ] Not behind Deployment Protection
- [ ] Slack Interactivity URL: `https://YOUR_DOMAIN/api/slack/interactivity`
  - [ ] Verified in Slack App settings
- [ ] Monitor endpoint: `GET /api/monitor/opportunities?secret=CRON_SECRET`
  - [ ] Protected by `CRON_SECRET` env var
- [ ] Vercel Hobby cron: max 1 per day — use external scheduler for more frequent runs
  - External: `curl -H "x-cron-secret: $CRON_SECRET" https://YOUR_DOMAIN/api/monitor/opportunities`

---

## 7. 수동 Smoke Test

After each deploy, verify:

- [ ] `GET /` → 200, title "GRANTIQ — ..." (no "움틀", no HTML fragments)
- [ ] `GET /api/admin/health` → `{"ok":true}`
- [ ] `GET /api/admin/status` → `{"ok":true, "anthropicConfigured": bool, ...}`
- [ ] `POST /api/slack/events` with `url_verification` payload → `{"challenge":"..."}`
- [ ] `GET /api/monitor/opportunities?secret=CRON_SECRET` → `{"ok":true, ...}`
- [ ] No 404 on any public CTA
- [ ] Title tag: `GRANTIQ — My Company` (no HTML comment fragments)
- [ ] OG tags present (check with `curl -s https://YOUR_DOMAIN | grep og:`)
- [ ] robots.txt: `GET /robots.txt` → 200 or 404 (no internal routes leaked)

### Page title / metadata check
```bash
curl -s https://YOUR_DOMAIN | grep -E '<title>|og:title|twitter:title|description'
```
Expected: clean GRANTIQ title, no "움틀", no `<!-- -->` fragments.

---

## 8. 롤백 기준

Immediately rollback if:
- [ ] `/` returns 500 or blank page
- [ ] Slack Events URL returns non-200 to challenge
- [ ] `/api/admin/health` returns non-200
- [ ] Any env var with sensitive data exposed in response
- [ ] Build fails with new commit

### Rollback steps
1. Vercel Dashboard > Deployments
2. Find last working deployment (✅ Ready)
3. Click `...` > `Promote to Production`
4. Verify `/api/admin/health` is 200 again

---

## 9. 재배포 필요 조건

Redeploy required when:
- [ ] Any env var changed in Vercel Dashboard
- [ ] `NEXT_PUBLIC_*` variables changed (these are baked into the build)
- [ ] `next.config.js` changed
- [ ] Any new page or API route added

To redeploy without code change:
Vercel Dashboard > Deployments > latest > `...` > `Redeploy`

---

## AUDIT: 공개 노출 리스크 현황

| 항목 | 이전 | 현재 | 상태 |
|------|------|------|------|
| `pages/index.js` 고객명 fallback | `"움틀"` | `"GRANTIQ"` | ✅ Fixed |
| `lib/store/companyMemory.js` fallback | `"움틀"` | `"GRANTIQ"` | ✅ Fixed |
| `pages/api/board-meeting.js` 하드코딩 | `"㈜움틀"` | `"GRANTIQ"` | ✅ Fixed |
| `next.config.js` 기본값 | `"㈜움틀"` | `"GRANTIQ"` | ✅ Fixed |
| `README.md` 예시값 | `"㈜움틀"` | `"My Company"` | ✅ Fixed |
| ContractIQ / ContractPlan / GrantFlow | N/A | 없음 | ✅ Clean |
| `/contracts/intake` | N/A | 없음 | ✅ Clean |
| `contractiq.studio` | N/A | 없음 | ✅ Clean |

