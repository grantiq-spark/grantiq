# GRANTIQ — 움틀 R&D 공고 매칭 & 사업계획서 생성기

## 🚀 Vercel 배포 (5분)

### 1단계 — GitHub에 올리기
```bash
git init
git add .
git commit -m "init grantiq"
git remote add origin https://github.com/YOUR_USERNAME/grantiq.git
git push -u origin main
```

### 2단계 — Vercel 연결
1. https://vercel.com 접속 → "New Project"
2. GitHub 레포 선택
3. **Environment Variables** 탭에서 아래 값 입력:

| Key | Value | 필수 |
|-----|-------|------|
| `ANTHROPIC_API_KEY` | `sk-ant-...` | ✅ 필수 |
| `NOTION_API_KEY` | `secret_...` | 선택 |
| `NOTION_GRANTS_DB_ID` | Notion DB ID | 선택 |
| `NOTION_PROPOSALS_DB_ID` | Notion DB ID | 선택 |
| `COMPANY_NAME` | `㈜움틀` | 선택 |

4. "Deploy" 클릭 → 2분 후 URL 생성 🎉

---

## 🔑 API 키 발급

### Anthropic API Key
1. https://console.anthropic.com/settings/keys
2. "Create Key" → 이름 입력 → 복사

### Notion 연동 (선택)
1. https://www.notion.so/my-integrations → "New integration"
2. 공고 저장용 데이터베이스 생성:
   - 속성: `공고명(title)`, `주관기관(text)`, `매칭점수(number)`, `마감일(date)`, `예산(text)`, `상태(select)`, `원문링크(url)`
3. 데이터베이스 우상단 `...` → "Connections" → 생성한 통합 추가
4. URL에서 DB ID 복사: `notion.so/YOUR_DB_ID?v=...`

---

## 💻 로컬 개발

```bash
# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env.local
# .env.local 열어서 API 키 입력

# 개발 서버 실행
npm run dev
# → http://localhost:3000
```

---

## 📱 주요 기능

### 공고 탐색
- 6개 프리셋 버튼으로 빠른 검색
- Claude 웹 검색으로 실시간 최신 공고 로드
- 움틀 키워드 기반 자동 매칭 점수
- AI 상세 분석 (강점·약점·전략)
- Notion에 공고 저장

### 사업계획서 생성
- 공고 탐색에서 "사업계획서 작성" 버튼으로 자동 연결
- 과제 개요 / 배경 / 최종목표 / 연차별 목표 / 예산 / 사업화 / 기대효과 전체 생성
- Notion에 초안 저장

---

## 🛠 기술 스택
- **Frontend**: Next.js 14, React 18
- **AI**: Claude claude-sonnet-4-20250514 (API 프록시로 키 보안)
- **저장**: Notion API
- **배포**: Vercel

