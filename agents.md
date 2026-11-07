> 경고: claude.md와 agents.md는 항상 동일한 내용을 유지해야 합니다. 하나를 수정하면 다른 하나도 반드시 동일하게 업데이트하세요.

# p2p-web-text-share 프로젝트 가이드 & 에이전트 규칙

## 1. 프로젝트 개요
- **프로젝트명**: p2p-web-text-share
- **목적**: 별도의 데이터베이스(DB)나 커스텀 백엔드 서버 없이 브라우저 간 WebRTC(PeerJS)를 활용하여 텍스트를 실시간으로 공유하는 P2P 웹 애플리케이션.
- **주요 기술 스택**:
  - React 18
  - Vite 5
  - Tailwind CSS 3
  - PeerJS 1.5
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

## 5. 배포 및 CI/CD
- 이 프로젝트는 CI/CD 구축되어 있어, main 브랜치에 코드가 푸시되면 GitHub Actions를 통해 GitHub Pages로 자동 빌드 및 배포됩니다. 배포 관련 설정은 .github/workflows/deploy.yml과 vite.config.js의 base 속성에 정의되어 있습니다.
