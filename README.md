# BIN CLOUD ☁️

가족과 함께하는 개인 클라우드 — 사진, 파일, 영상, 메모를 한 곳에서 관리하고 가족과 공유하세요.

## ✨ 기능

- 📸 **사진** — 업로드, 갤러리 뷰, 가족 공유
- 📁 **파일** — 모든 형식 지원, 검색, 다운로드
- 🎬 **영상** — MP4/MOV 업로드 및 인앱 플레이어
- 📝 **메모** — 색상 메모, 고정, 가족 공유
- 👨‍👩‍👧 **가족 초대** — 초대 코드/링크로 가족 추가
- 🔐 **인증** — 이메일 회원가입/로그인 (Supabase Auth)

---

## 🚀 시작하기

### 1. 패키지 설치

```bash
npm install
```

### 2. Supabase 프로젝트 생성

1. [https://supabase.com](https://supabase.com) 접속 → 새 프로젝트 생성
2. **Project URL**과 **anon key** 복사

### 3. 환경변수 설정

```bash
cp .env.local.example .env.local
```

`.env.local` 파일을 열고 Supabase 정보 입력:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

### 4. 데이터베이스 스키마 적용

Supabase 대시보드 → **SQL Editor** → `supabase/schema.sql` 내용을 붙여넣고 실행

### 5. Storage 버킷 생성

Supabase 대시보드 → **Storage** → 버킷 2개 생성:
- `family-files` (Public 체크)

### 6. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 열기

---

## 📂 폴더 구조

```
src/
├── app/
│   ├── login/          # 로그인/회원가입
│   ├── invite/         # 가족 초대 코드 입력
│   ├── auth/callback/  # Supabase 인증 콜백
│   └── dashboard/
│       ├── page.tsx         # 전체 보기 (홈)
│       ├── photos/          # 사진 갤러리
│       ├── files/           # 파일 관리
│       ├── videos/          # 영상 플레이어
│       ├── notes/           # 메모장
│       └── family/          # 가족 관리 & 초대
├── components/
│   ├── layout/
│   │   └── Sidebar.tsx      # 사이드바 네비게이션
│   └── features/
│       └── UploadZone.tsx   # 드래그&드롭 업로드
└── lib/
    ├── supabase.ts          # 클라이언트
    └── supabase-server.ts   # 서버 컴포넌트용
```

---

## 🛠 기술 스택

| 항목 | 기술 |
|------|------|
| 프레임워크 | Next.js 15 (App Router) |
| 데이터베이스 | Supabase (PostgreSQL) |
| 파일 저장소 | Supabase Storage |
| 인증 | Supabase Auth |
| 스타일 | Tailwind CSS |
| 아이콘 | Lucide React |
| 알림 | Sonner |
| 업로드 UI | react-dropzone |

---

## 🏗 배포 (Vercel 권장)

> 배포 트리거용 변경: 2026-03-18

```bash
# Vercel CLI 설치
npm i -g vercel

# 배포
vercel

# 환경변수 설정 (Vercel 대시보드에서)
# NEXT_PUBLIC_SUPABASE_URL
# NEXT_PUBLIC_SUPABASE_ANON_KEY
# NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
```

---

## ❓ 자주 묻는 질문

**Q: 무료로 쓸 수 있나요?**  
A: Supabase 무료 플랜으로 500MB DB + 1GB 파일 저장소 무료 제공. Vercel도 무료 플랜 있음.

**Q: 가족은 몇 명까지?**  
A: 제한 없음. 초대 코드로 원하는 만큼 추가 가능.

**Q: 내 파일이 안전한가요?**  
A: Supabase RLS(Row Level Security)로 본인 파일만 접근 가능. 공유 설정한 파일만 가족 공개.
