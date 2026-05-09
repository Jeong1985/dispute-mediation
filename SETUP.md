# 다정초 분쟁조정위원회 - 설치 및 실행 가이드

## 1. 패키지 설치

```bash
npm install
```

---

## 2. Firebase 프로젝트 설정 (`dajeonges2026`)

### 2-1. Firebase Console 설정

1. [Firebase Console](https://console.firebase.google.com) → 프로젝트 `dajeonges2026` 선택
2. **Authentication** → 시작하기 → **Google** 로그인 제공업체 활성화
3. **Firestore Database** → 데이터베이스 만들기 (테스트 모드로 시작)
4. **프로젝트 설정** (⚙️ 아이콘) → **내 앱** → 웹 앱 추가 → SDK 구성 복사

### 2-2. `.env.local` 파일 생성

```bash
cp .env.example .env.local
```

복사한 Firebase SDK 값을 `.env.local`에 붙여넣기:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=dajeonges2026.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=dajeonges2026
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=dajeonges2026.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
```

### 2-3. Firestore 보안 규칙 배포

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules
```

---

## 3. Anthropic API 키

1. [Anthropic Console](https://console.anthropic.com) → API Keys → Create Key
2. `.env.local`에 입력:
```env
ANTHROPIC_API_KEY=sk-ant-...
```

---

## 4. 이메일 발송 설정 (Gmail)

1. Google 계정 → **보안** → **2단계 인증** 활성화
2. **앱 비밀번호** 생성 (앱: 메일)
3. `.env.local`에 입력:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=abcd efgh ijkl mnop   # 앱 비밀번호 (공백 없이)
SMTP_FROM="다정초 분쟁조정위원회 <your-email@gmail.com>"
```

---

## 5. Google Drive 연동 설정

대화 내용이 **내 드라이브 > 2026 > 클로드 > 분쟁조정위원회** 폴더에 자동 저장됩니다.

### 5-1. Google Drive 폴더 준비

1. Google Drive에서 폴더 구조 생성:
   ```
   내 드라이브/
     2026/
       클로드/
         분쟁조정위원회/   ← 이 폴더를 서비스 계정과 공유
   ```

2. `분쟁조정위원회` 폴더 열기 → 주소창에서 폴더 ID 복사
   ```
   https://drive.google.com/drive/folders/[여기가 폴더 ID]
   ```

### 5-2. Google Cloud 서비스 계정 생성

1. [Google Cloud Console](https://console.cloud.google.com) → 프로젝트 `dajeonges2026` 선택
2. **API 및 서비스** → **라이브러리** → `Google Drive API` 검색 → **사용** 클릭
3. **IAM 및 관리자** → **서비스 계정** → **서비스 계정 만들기**
   - 이름: `dispute-mediation-drive`
4. 생성된 서비스 계정 클릭 → **키** 탭 → **키 추가** → **JSON** → 파일 다운로드

### 5-3. Drive 폴더 공유

1. Google Drive에서 `분쟁조정위원회` 폴더 우클릭 → **공유**
2. 서비스 계정 이메일 입력 (예: `dispute-mediation-drive@dajeonges2026.iam.gserviceaccount.com`)
3. 권한: **편집자** → 공유

### 5-4. `.env.local`에 추가

```env
GOOGLE_DRIVE_FOLDER_ID=1a2b3c4d5e6f7g8h9i0j   # 폴더 ID

# 다운로드한 JSON 파일 내용을 한 줄로 압축해서 입력
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"dajeonges2026",...}
```

> JSON 파일을 한 줄로 압축하는 방법: 텍스트 에디터에서 파일 열기 → 줄바꿈 모두 제거

---

## 6. 개발 서버 실행

```bash
npm run dev
```
→ http://localhost:3000

---

## 7. Firebase Hosting 배포 (`trouble2026.web.app`)

```bash
# Firebase CLI 설치
npm install -g firebase-tools

# 로그인
firebase login

# Web Frameworks 실험 기능 활성화 (Next.js 지원)
firebase experiments:enable webframeworks

# 배포
firebase deploy --only hosting
```

배포 후 → https://trouble2026.web.app

> **환경변수 설정**: Firebase Hosting 배포 시 환경변수는 Firebase Console에서 설정하거나
> `firebase functions:secrets:set` 명령어로 설정합니다.

---

## 사용 방법

### 👨‍🏫 선생님

1. 홈 → **선생님** 클릭
2. 구글 계정 `@dajeong.sjedues.kr`으로 로그인
3. **새 상담실 만들기** → 주제 + 4자리 방번호
4. 학생에게 방번호 전달
5. 세부 보기 → 학생 상담 → **요약 보기** → **PDF 이메일 발송**

### 🧑‍🎓 학생

1. 홈 → **학생** 클릭
2. **방번호**(4자리) + **이름** + **개인번호** 입력
3. AI 선생님과 대화 (타이핑 또는 🎤 마이크)
4. **상담 완료** 버튼 클릭

> 같은 방번호 + 이름 + 개인번호로 재접속하면 이전 대화를 이어갈 수 있습니다.

---

## 파일 저장 구조

| 저장소 | 내용 | 용도 |
|--------|------|------|
| **Firestore** | 세션 상태, 메시지 배열 | 실시간 재접속, 교사 대시보드 |
| **Google Drive** | JSON 파일 (대화 전체) | 영구 보관, 백업 |
