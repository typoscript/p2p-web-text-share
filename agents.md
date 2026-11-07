> 경고: claude.md와 agents.md는 항상 동일한 내용을 유지해야 합니다. 하나를 수정하면 다른 하나도 반드시 동일하게 업데이트하세요.

# p2p-web-text-share 프로젝트 가이드 & 에이전트 규칙

## 1. 프로젝트 개요
- **프로젝트명**: p2p-web-text-share
- **목적**: 별도의 데이터베이스(DB)나 커스텀 백엔드 서버 없이 브라우저 간 WebRTC(PeerJS)를 활용하여 텍스트를 실시간으로 공유하는 P2P 웹 애플리케이션.
- **주요 기술 스택**:
  - TypeScript 5 (strict 모드)
  - React 18
  - Vite 5
  - Tailwind CSS 3
  - PeerJS 1.5
  - qrcode 1.5 (QR 초대)
  - Lucide React (아이콘)

## 2. 핵심 요구사항 및 기능
1. **고유 ID 발급 및 표시**:
   - 접속 시 내 기기(브라우저)의 고유 Peer ID를 생성/발급받아 화면에 표시.
   - 복사 기능 등을 제공하여 상대방에게 쉽게 공유 가능하도록 지원.
2. **다중(1:N) P2P 연결**:
   - 상대방의 Peer ID를 입력하여 P2P 데이터 연결 수립.
   - 1:1뿐만 아니라 여러 피어와 동시에 연결할 수 있는 1:N 구조 지원.
3. **상하 2분할 UI 레이아웃**:
   - 화면을 상단과 하단 패널로 분할.
   - **상단 패널**: 내가 작성하여 전송하는 텍스트 입력창 (실시간 편집 가능).
   - **하단 패널**: 연결된 상대방(피어)이 전송한 텍스트를 표시하는 읽기 전용(Read-only) 수신창.
4. **실시간 브로드캐스트**:
   - 상단 입력창에 텍스트가 입력/수정될 때 연결된 모든 활성 피어에게 실시간 브로드캐스트 전송.
5. **예외 처리 및 연결 방어 로직**:
   - 빈 입력값 방지, 자기 자신 ID 연결 차단 ("자기 자신과는 연결할 수 없습니다" 경고).
   - 중복 연결 차단.
   - WebRTC DataChannel 및 PeerConnection 다중 계층 닫힘 감지로 연결 종료 시 기기 수 즉시 동기화.
   - 브로드캐스트 실패 시 끊긴 피어 자동 감지 및 목록 정리.
   - Tailwind 기반 부드러운 전환 효과(transition, active scale, pulse/ping 애니메이션) 적용.
6. **가독성 높은 6자리 단축 ID & 초대 링크**:
   - 헷갈리는 문자(0/O, 1/I/L)를 제외한 Base32 기반 6자리 단축 ID 체계 적용 (약 10억 7천만 가지 조합).
   - 전역 충돌 방지를 위한 내부 네임스페이스(`p2ptxt-`) 분리 및 `unavailable-id` 자동 자가치유(Self-healing).
   - URL 쿼리 파라미터(`?join=XXXXXX`) 기반 원클릭 초대 링크 복사 및 자동 접속 지원.
7. **크로스 디바이스(iOS/Mac) P2P 연결 최적화 및 TURN 릴레이 지원**:
   - ID 대소문자 소문자 통일 정규화로 PeerJS 시그널링 불일치 원천 차단.
   - Google & Cloudflare 다중 STUN 서버 + 환경 변수로 주입하는 TURN 릴레이(선택)로 LTE/5G 대칭형 NAT, 방화벽 환경 대응.
   - iOS Safari 비표준 옵션 충돌 방지 및 모바일 백그라운드 복귀 시 자동 재연결(`visibilitychange`).
   - 실시간 P2P 서버 등록 상태 인디케이터(초록불 `●`) 탑재.

## 3. 에이전트 공통 규칙
- **문서 동기화 절대 원칙**:
  - `claude.md`와 `agents.md`는 프로젝트 맥락, 규칙, 상태를 공유하기 위한 공통 문서입니다.
  - 구조, 상태, 규칙 등이 변경되어 두 파일 중 하나라도 수정될 경우 **반드시 나머지 파일도 즉시 동일하게 수정하여 100% 일치**시켜야 합니다.
- **코드 및 아키텍처 원칙**:
  - 외부 서버 종속성을 최소화하고 순수 P2P(PeerJS 클라우드 브로커/시그널링 활용) 통신을 유지합니다.
  - 컴포넌트 분리 및 상태 관리를 명확히 하여 피어 연결 상태와 데이터 흐름을 직관적으로 관리합니다.
  - 타이핑 중 빈번한 렌더링에 따른 성능 저하를 방지하기 위해 React.memo, useCallback, useRef를 적극 활용합니다.

## 4. 진행 현황
- [x] 프로젝트 초기 환경 설정 (Vite, React, Tailwind CSS, Lucide React, PeerJS 설치)
- [x] 프롬프트 1: 기본 UI 레이아웃 및 스캐폴딩 구현
  - 상단 헤더: 내 기기 ID 영역(복사 버튼 포함), 연결된 기기 수 표시, 상대방 ID 입력창 및 연결하기 버튼
  - 메인 패널: 100dvh 반응형 상하 2분할 레이아웃 (상단: 내가 보내는 텍스트 입력창, 하단: 상대방이 보낸 텍스트 read-only 창)
- [x] 프롬프트 2: PeerJS 기반 P2P 연결 및 수신 로직 구현
  - Peer 인스턴스 초기화 및 고유 ID 발급/표시
  - `peer.connect(targetId)`를 통한 발신 연결 수립
  - `peer.on('connection')`을 통한 수신 연결 자동 수락
  - `connections` 다중 배열 상태 관리 (`open`, `close`, `error` 시 연결된 기기 수 실시간 동기화)
  - `conn.on('data')` 이벤트 수신 시 하단 패널 텍스트 실시간 렌더링
- [x] 프롬프트 3: 실시간 텍스트 브로드캐스트 및 상태 최적화
  - 상단 `<textarea>` `onChange` 시 열려 있는 모든 connection 대상 `conn.send(text)` 브로드캐스트
  - 신규 피어 연결 시 기존 작성된 텍스트 자동 초기 동기화
  - `React.memo`, `useRef`, `useCallback`을 활용한 불필요한 리렌더링 방지 및 입력 반응성 최적화
- [x] 프롬프트 4: 연결 예외 처리 및 UI UX 고도화
  - 빈 ID 입력, 본인 ID 입력("자기 자신과는 연결할 수 없습니다"), 중복 연결 방지 토스트 알림
  - PeerJS 이벤트 + WebRTC DataChannel close + PeerConnection statechange + 브로드캐스트 예외 감지를 통한 4중 연결 종료 방어
  - Tailwind CSS 부드러운 전환 효과(transition, active:scale-95, 펄스 애니메이션 등) 적용
- [x] 프롬프트 5: GitHub Pages CI/CD 자동 배포 환경 구축
  - `vite.config.js`의 `base: '/p2p-web-text-share/'` 설정
  - `.github/workflows/deploy.yml` 작성 (main 브랜치 푸시 시 자동 빌드 및 gh-pages 배포)
- [x] 프롬프트 6: 상세 기술 명세서(README.md) 작성 완료
  - 시스템 아키텍처 및 시그널링 흐름 Mermaid 다이어그램 포함
  - 1:N 메시 브로드캐스팅, 렌더링 최적화, 4중 계층 단절 방어 메커니즘 등 엔지니어링 고려 사항 기술
- [x] 프롬프트 7: 사용자 경험 개선 - 가독성 높은 6자리 단축 ID & 원클릭 초대 링크 구현
  - 혼동 문자(0/O, 1/I/L) 배제된 Base32 6자리 식별자 발급
  - 내부 네임스페이스(`p2ptxt-`) 충돌 방어 및 `?join=XXXXXX` URL 파라미터 자동 연결
- [x] 프롬프트 8: 크로스 디바이스(iOS/Mac) P2P 연결 최적화 및 STUN/TURN 풀 구성
  - ID 대소문자 소문자 통일 정규화로 PeerJS 시그널링 불일치 원천 차단
  - Google & Cloudflare 다중 STUN + Open Relay TURN(TCP 443) 서버 풀 구성으로 사파리 시크릿 모드/LTE NAT 홀펀칭 강화
  - iOS Safari 비표준 옵션 충돌 방지 및 모바일 백그라운드 복귀 시 자동 재연결(`visibilitychange`)
- [x] 프롬프트 9: TypeScript 전환
  - `src/*.jsx` → `.tsx`, `vite.config.js` → `.ts` 전환 및 strict 타입 적용
  - `tsconfig.json`(references) / `tsconfig.app.json` / `tsconfig.node.json` 구성, `npm run build` 시 `tsc -b` 타입 체크 선행
  - PeerJS `serialization`은 `'raw' | 'json' | 'binary' | 'binary-utf8'`만 유효 (`'none'` 사용 시 `connect()` 예외)
- [x] 프롬프트 10: 연결 안정성 버그 수정
  - 연결 제거를 객체 단위로 비교하여 중복 연결 정리 시 정상 연결까지 삭제되던 문제 수정
  - 동시 연결로 생긴 중복 연결은 (발신자 ID, connectionId) 기준으로 양측이 동일한 1개만 유지
  - `serialization: 'binary'`로 16KB 초과 텍스트 자동 청크 분할 전송 (긴 텍스트 전송 시 연결 끊김 방지)
  - 진행 중인 발신 연결(`pendingConnRef`)에만 타임아웃/로딩 상태 적용, `peer-unavailable` 시 타이머 해제
- [x] 수신 텍스트 영역 전체 복사 버튼 추가
- [x] 프롬프트 11: TURN 릴레이 설정 지원
  - `src/iceConfig.ts`: 빌드 환경 변수(`VITE_TURN_CREDENTIALS_URL` 또는 `VITE_TURN_URLS`/`USERNAME`/`CREDENTIAL`)로 TURN 주입, 미설정/실패 시 STUN만으로 동작
  - GitHub Actions 빌드 단계에서 동일 이름의 저장소 Secrets 주입 (`.env.example` 참고)
  - ICE 연결 후 실제 연결 경로(host/srflx/relay)를 진단 로그에 표시
- [x] 프롬프트 12: 사용자 편의 기능
  - QR 코드 초대 모달 (`qrcode` 라이브러리, 초대 링크 `?join=` 인코딩, ESC/배경 클릭 닫기)
  - 입력/수신 텍스트 저장·복원 (`src/storage.ts`: sessionStorage 탭별 우선 + localStorage 폴백, 300ms 디바운스)
  - 수신 텍스트 기기별 탭 분리 (`src/components/ReceiverPanel.tsx`: 온라인/오프라인 표시, 새 텍스트 알림 점, 탭별 지우기)
- [x] ICE 연결 실패 진단 로그: 내 후보 수집 결과(host(mDNS)/srflx/relay), 실패·타임아웃 시 양측 후보 요약 및 추정 원인 표시
- [x] 상단 플로팅 토스트 알림 (`src/components/Toast.tsx`): 연결/끊김/오류 등을 화면 상단 중앙에 2초간 표시 (success/warning/error/loading 색상 구분, "연결 중..."만 결과가 나올 때까지 유지)

## 5. 배포 및 CI/CD
- 이 프로젝트는 CI/CD 구축되어 있어, main 브랜치에 코드가 푸시되면 GitHub Actions를 통해 GitHub Pages로 자동 빌드 및 배포됩니다. 배포 관련 설정은 .github/workflows/deploy.yml과 vite.config.js의 base 속성에 정의되어 있습니다.
