import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import Peer from 'peerjs';
import { Copy, Check, Link2, Users, Send, Download, AlertCircle, Sparkles, Share2, Loader2 } from 'lucide-react';

// 가독성 높은 Base32 문자셋 (0/O, 1/I/L 혼동 문자 제외)
const CODE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

// 글로벌 STUN + 무료 공용 TURN 릴레이 서버 풀 (사파리 시크릿모드, LTE/5G 대칭형 NAT, 방화벽 돌파)
const ICE_SERVERS_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    // Open Relay Project (TURN 릴레이: P2P 직접 홀펀칭 실패 시 서버 릴레이로 100% 통과)
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelay',
      credential: 'openrelay',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelay',
      credential: 'openrelay',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelay',
      credential: 'openrelay',
    },
  ],
  iceCandidatePoolSize: 10,
  sdpSemantics: 'unified-plan',
};

// 6자리 고유 랜덤 코드 생성기 (32^6 = 약 10억 7천만 개 조합)
function generateShortCode(length = 6) {
  let result = '';
  const bytes = new Uint8Array(length);
  window.crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i++) {
    result += CODE_CHARS[bytes[i] % CODE_CHARS.length];
  }
  return result;
}

// 사용자 입력값 정규화 (소문자 변환 및 URL 파라미터 추출)
function normalizePeerId(input) {
  let clean = input.trim().toLowerCase();
  if (clean.includes('join=')) {
    clean = clean.split('join=')[1].split('&')[0];
  }
  return clean;
}

// 상단 헤더 컴포넌트
const Header = memo(function Header({
  myPeerId,
  isPeerReady,
  peerInputId,
  setPeerInputId,
  connectedCount,
  isConnecting,
  copiedId,
  copiedLink,
  statusMessage,
  onCopyId,
  onCopyInviteLink,
  onConnect,
}) {
  const displayId = myPeerId ? myPeerId.toUpperCase() : '';

  return (
    <header className="flex-none bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-3 sm:px-6 transition-colors duration-200">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between max-w-7xl mx-auto">
        {/* 좌측: 내 기기 ID & 연결된 기기 수 */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 rounded-lg px-3 py-1.5 text-xs sm:text-sm transition-all duration-200">
            {/* 온라인 상태 인디케이터 */}
            <span className="relative flex h-2.5 w-2.5" title={isPeerReady ? 'P2P 준비 완료 (온라인)' : 'P2P 서버 연결 중...'}>
              {isPeerReady ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500 animate-pulse"></span>
              )}
            </span>

            <span className="text-slate-400 font-medium">내 ID:</span>
            <code className="font-mono text-base font-bold text-indigo-400 bg-slate-950/80 px-2.5 py-0.5 rounded border border-slate-800 tracking-wider select-all">
              {displayId || '생성 중...'}
            </code>

            {/* ID 복사 버튼 */}
            <button
              type="button"
              onClick={onCopyId}
              disabled={!displayId}
              title="6자리 ID 복사"
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-700/70 disabled:opacity-30 rounded transition-all duration-150 active:scale-90"
            >
              {copiedId ? (
                <Check className="w-4 h-4 text-emerald-400 transition-transform scale-110" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>

            {/* 초대 링크 복사 버튼 */}
            <button
              type="button"
              onClick={onCopyInviteLink}
              disabled={!displayId}
              title="원클릭 초대 링크 복사"
              className="p-1 text-slate-400 hover:text-indigo-300 hover:bg-slate-700/70 disabled:opacity-30 rounded transition-all duration-150 active:scale-90"
            >
              {copiedLink ? (
                <Check className="w-4 h-4 text-emerald-400 transition-transform scale-110" />
              ) : (
                <Share2 className="w-4 h-4" />
              )}
            </button>

            {(copiedId || copiedLink) && (
              <span className="text-[11px] sm:text-xs text-emerald-400 font-semibold animate-pulse">
                {copiedLink ? '초대링크 복사됨!' : 'ID 복사됨!'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 bg-slate-800/40 border border-slate-800 rounded-lg px-3 py-1.5 text-xs sm:text-sm text-slate-300 transition-all duration-200">
            <div className="relative flex items-center justify-center">
              <Users className="w-4 h-4 text-indigo-400" />
              {connectedCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              )}
            </div>
            <span>연결된 기기:</span>
            <span
              className={`font-bold transition-all duration-300 ${
                connectedCount > 0 ? 'text-emerald-400 scale-105' : 'text-indigo-400'
              }`}
            >
              {connectedCount}
            </span>
            <span className="text-slate-400">대</span>
          </div>
        </div>

        {/* 우측: 상대방 ID 입력 및 연결 버튼 */}
        <form onSubmit={onConnect} className="flex items-center gap-2">
          <input
            type="text"
            value={peerInputId}
            onChange={(e) => setPeerInputId(e.target.value.toUpperCase())}
            placeholder="상대방 6자리 ID (예: 7K9P2X)"
            disabled={isConnecting}
            className="flex-1 sm:w-64 bg-slate-800/70 hover:bg-slate-800 focus:bg-slate-800/90 border border-slate-700/80 text-slate-100 text-xs sm:text-sm rounded-lg px-3 py-1.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 placeholder-slate-500 font-mono tracking-wider shadow-inner disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isConnecting || !displayId}
            className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 active:scale-95 text-white text-xs sm:text-sm font-medium px-3.5 py-1.5 rounded-lg transition-all duration-200 shadow-sm shadow-indigo-950 whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>연결 중...</span>
              </>
            ) : (
              <>
                <Link2 className="w-4 h-4 transition-transform group-hover:rotate-45" />
                <span>연결하기</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* 상태/알림 메시지 토스트 */}
      <div
        className={`max-w-7xl mx-auto transition-all duration-300 ease-in-out overflow-hidden ${
          statusMessage ? 'max-h-24 opacity-100 mt-2.5' : 'max-h-0 opacity-0 mt-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-2 text-xs sm:text-sm text-indigo-200 bg-indigo-950/70 border border-indigo-700/50 px-3.5 py-2 rounded-lg shadow-sm">
          <AlertCircle className="w-4 h-4 text-indigo-400 flex-none" />
          <span className="font-medium">{statusMessage}</span>
        </div>
      </div>
    </header>
  );
});

// 상단 패널: 내가 보내는 텍스트 입력창
const SenderPanel = memo(function SenderPanel({ text, onChange }) {
  return (
    <section className="flex-1 flex flex-col min-h-0 bg-slate-900 border border-slate-800/90 hover:border-slate-700/80 rounded-xl overflow-hidden shadow-lg shadow-black/20 transition-all duration-200">
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800/50 border-b border-slate-800/80 transition-colors">
        <div className="flex items-center gap-2">
          <Send className="w-4 h-4 text-indigo-400 transition-transform group-hover:translate-x-0.5" />
          <h2 className="text-xs sm:text-sm font-semibold tracking-wide text-slate-200">
            내가 보내는 텍스트
          </h2>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>실시간 편집 &amp; 브로드캐스트</span>
        </div>
      </div>
      <div className="flex-1 min-h-0 p-2.5">
        <textarea
          value={text}
          onChange={onChange}
          placeholder="여기에 전송할 텍스트를 자유롭게 입력하세요... (입력 즉시 연결된 모든 기기로 전송됩니다)"
          className="w-full h-full resize-none bg-transparent text-slate-100 text-sm font-mono p-2 focus:outline-none placeholder-slate-600 leading-relaxed custom-scrollbar transition-opacity duration-150"
          spellCheck={false}
        />
      </div>
    </section>
  );
});

// 하단 패널: 상대방이 보낸 텍스트 수신창
const ReceiverPanel = memo(function ReceiverPanel({ text }) {
  return (
    <section className="flex-1 flex flex-col min-h-0 bg-slate-900 border border-slate-800/90 hover:border-slate-700/80 rounded-xl overflow-hidden shadow-lg shadow-black/20 transition-all duration-200">
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800/50 border-b border-slate-800/80 transition-colors">
        <div className="flex items-center gap-2">
          <Download className="w-4 h-4 text-emerald-400" />
          <h2 className="text-xs sm:text-sm font-semibold tracking-wide text-slate-200">
            상대방이 보낸 텍스트
          </h2>
        </div>
        <span className="text-[11px] text-slate-400 font-medium bg-slate-800/70 px-2 py-0.5 rounded border border-slate-700/40">
          읽기 전용 (Read-only)
        </span>
      </div>
      <div className="flex-1 min-h-0 p-2.5 bg-slate-950/40">
        <textarea
          readOnly
          value={text}
          placeholder="연결된 상대방이 입력한 텍스트가 실시간으로 여기에 표시됩니다."
          className="w-full h-full resize-none bg-transparent text-slate-300 text-sm font-mono p-2 focus:outline-none placeholder-slate-600 leading-relaxed cursor-default custom-scrollbar transition-opacity duration-150"
          spellCheck={false}
        />
      </div>
    </section>
  );
});

export default function App() {
  const [myPeerId, setMyPeerId] = useState('');
  const [isPeerReady, setIsPeerReady] = useState(false);
  const [peerInputId, setPeerInputId] = useState('');
  const [connections, setConnections] = useState([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const [myText, setMyText] = useState('');
  const [receivedText, setReceivedText] = useState('');

  const peerRef = useRef(null);
  const connectionsRef = useRef([]);
  const myTextRef = useRef('');
  const toastTimerRef = useRef(null);
  const connectTimeoutTimer = useRef(null);
  const autoConnectAttempted = useRef(false);

  // 안내 토스트 노출 헬퍼 함수
  const showToast = useCallback((msg, duration = 3000) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setStatusMessage(msg);
    toastTimerRef.current = setTimeout(() => {
      setStatusMessage('');
      toastTimerRef.current = null;
    }, duration);
  }, []);

  // 최신 ref 동기화
  useEffect(() => {
    connectionsRef.current = connections;
  }, [connections]);

  useEffect(() => {
    myTextRef.current = myText;
  }, [myText]);

  // 특정 peer 연결 제거 헬퍼
  const removeConnection = useCallback((peerId, conn) => {
    setConnections((prev) => {
      const next = prev.filter((c) => c !== conn && c.peer !== peerId);
      if (next.length !== prev.length) {
        showToast(`[${peerId.toUpperCase()}] 기기와의 연결이 종료되었습니다.`, 3000);
      }
      return next;
    });
  }, [showToast]);

  // 열려 있는 모든 피어에게 브로드캐스트
  const broadcastText = useCallback((textToSend) => {
    const deadPeers = [];

    connectionsRef.current.forEach((conn) => {
      if (conn && conn.open) {
        try {
          conn.send(textToSend);
        } catch (err) {
          console.error(`피어(${conn.peer}) 데이터 전송 실패:`, err);
          deadPeers.push(conn.peer);
        }
      } else {
        deadPeers.push(conn.peer);
      }
    });

    if (deadPeers.length > 0) {
      setConnections((prev) => prev.filter((c) => !deadPeers.includes(c.peer)));
    }
  }, []);

  // 텍스트 입력 변경 핸들러
  const handleTextChange = useCallback((e) => {
    const newText = e.target.value;
    setMyText(newText);
    broadcastText(newText);
  }, [broadcastText]);

  // Connection 이벤트 리스너 등록
  const setupConnection = useCallback((conn) => {
    const targetDisplay = conn.peer.toUpperCase();

    const handleOpen = () => {
      if (connectTimeoutTimer.current) {
        clearTimeout(connectTimeoutTimer.current);
        connectTimeoutTimer.current = null;
      }
      setIsConnecting(false);

      setConnections((prev) => {
        if (prev.some((c) => c.peer === conn.peer)) {
          return prev;
        }
        return [...prev, conn];
      });
      showToast(`🎉 [${targetDisplay}] 기기와 성공적으로 연결되었습니다!`, 3500);

      // 연결 직후 기존 작성된 텍스트가 있다면 즉시 초기 동기화
      if (myTextRef.current && conn.open) {
        try {
          conn.send(myTextRef.current);
        } catch (err) {
          console.error(`초기 텍스트 동기화 실패 (${conn.peer}):`, err);
        }
      }
    };

    if (conn.open) {
      handleOpen();
    } else {
      conn.on('open', handleOpen);
    }

    // 데이터 수신 이벤트
    conn.on('data', (data) => {
      const text = typeof data === 'string' ? data : (data?.text ?? String(data));
      setReceivedText(text);
    });

    // 연결 종료 및 에러 처리
    conn.on('close', () => {
      setIsConnecting(false);
      removeConnection(conn.peer, conn);
    });

    conn.on('error', (err) => {
      console.error(`Connection error with ${conn.peer}:`, err);
      setIsConnecting(false);
      removeConnection(conn.peer, conn);
      showToast(`[${targetDisplay}] P2P 연결 실패 (${err.message || '네트워크 제한'})`, 4000);
    });

    // WebRTC PeerConnection ICE 상태 감지
    if (conn.peerConnection) {
      conn.peerConnection.addEventListener('iceconnectionstatechange', () => {
        const iceState = conn.peerConnection?.iceConnectionState;
        if (iceState === 'failed') {
          console.error('ICE Connection failed with', conn.peer);
          setIsConnecting(false);
          removeConnection(conn.peer, conn);
          showToast(`[${targetDisplay}] NAT/방화벽 통과 실패 (TURN 릴레이 재시도 권장)`, 4000);
        }
      });

      conn.peerConnection.addEventListener('connectionstatechange', () => {
        const state = conn.peerConnection?.connectionState;
        if (state === 'failed' || state === 'closed') {
          setIsConnecting(false);
          removeConnection(conn.peer, conn);
        }
      });
    }
  }, [removeConnection, showToast]);

  // 내부 연결 시도 공통 함수
  const initiateConnect = useCallback((targetId) => {
    if (!targetId) return;

    const myCurrentId = peerRef.current?.id;
    if (targetId === myCurrentId) {
      showToast('자기 자신과는 연결할 수 없습니다.', 3500);
      return;
    }

    if (connectionsRef.current.some((c) => c.peer === targetId)) {
      showToast('이미 연결되어 있는 기기입니다.', 3500);
      return;
    }

    if (!peerRef.current || peerRef.current.destroyed || peerRef.current.disconnected) {
      showToast('P2P 서버와 재연결 중입니다. 잠시 후 다시 시도해 주세요.', 3500);
      peerRef.current?.reconnect();
      return;
    }

    setIsConnecting(true);
    const targetDisplay = targetId.toUpperCase();
    showToast(`[${targetDisplay}] 기기와 P2P 연결 수립 중...`, 12000);

    // 타임아웃 감지 (12초)
    if (connectTimeoutTimer.current) clearTimeout(connectTimeoutTimer.current);
    connectTimeoutTimer.current = setTimeout(() => {
      setIsConnecting(false);
      showToast(`[${targetDisplay}] 응답 시간 초과. 상대방 화면이 켜져 있는지 확인해 주세요.`, 5000);
    }, 12000);

    // 표준 WebRTC DataConnection 수립
    const conn = peerRef.current.connect(targetId);
    setupConnection(conn);
  }, [setupConnection, showToast]);

  // Peer 인스턴스 초기화 (앱 마운트 시 단 1회 실행)
  useEffect(() => {
    let currentPeer = null;

    const initPeer = () => {
      const shortId = generateShortCode(6).toLowerCase();

      const peer = new Peer(shortId, {
        config: ICE_SERVERS_CONFIG,
      });
      currentPeer = peer;
      peerRef.current = peer;

      peer.on('open', (id) => {
        setMyPeerId(id);
        setIsPeerReady(true);

        // URL에 ?join= 파라미터가 있을 시 자동 연결 시도
        if (!autoConnectAttempted.current) {
          const params = new URLSearchParams(window.location.search);
          const joinParam = params.get('join') || params.get('connect');
          if (joinParam && joinParam.trim()) {
            autoConnectAttempted.current = true;
            const targetId = normalizePeerId(joinParam);
            setTimeout(() => {
              initiateConnect(targetId);
            }, 600);
            window.history.replaceState({}, '', window.location.pathname);
          }
        }
      });

      // 상대방 연결 요청 수락
      peer.on('connection', (conn) => {
        setupConnection(conn);
      });

      peer.on('error', (err) => {
        console.error('PeerJS error:', err);
        setIsConnecting(false);

        if (err.type === 'unavailable-id') {
          console.warn('ID 충돌 발생, 새 ID로 재초기화합니다.');
          peer.destroy();
          initPeer();
          return;
        }

        if (err.type === 'peer-unavailable') {
          showToast('해당 ID의 기기를 찾을 수 없습니다. (상대방이 새로고침했거나 화면이 꺼져 있을 수 있습니다)', 5000);
        } else {
          showToast(`P2P 오류: ${err.message || err.type}`, 4000);
        }
      });

      peer.on('disconnected', () => {
        setIsPeerReady(false);
        if (!peer.destroyed) {
          peer.reconnect();
        }
      });
    };

    initPeer();

    // 모바일 브라우저 백그라운드 복귀 시 자동 재연결
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (currentPeer && currentPeer.disconnected && !currentPeer.destroyed) {
          currentPeer.reconnect();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const handleBeforeUnload = () => {
      currentPeer?.destroy();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (connectTimeoutTimer.current) clearTimeout(connectTimeoutTimer.current);
      currentPeer?.destroy();
      peerRef.current = null;
    };
  }, []);

  // ID 클립보드 복사
  const handleCopyId = useCallback(async () => {
    if (!myPeerId) return;
    try {
      await navigator.clipboard.writeText(myPeerId.toUpperCase());
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch (err) {
      console.error('Failed to copy ID:', err);
    }
  }, [myPeerId]);

  // 원클릭 초대 링크 클립보드 복사
  const handleCopyInviteLink = useCallback(async () => {
    if (!myPeerId) return;
    const inviteUrl = `${window.location.origin}${window.location.pathname}?join=${myPeerId.toUpperCase()}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      console.error('Failed to copy invite link:', err);
    }
  }, [myPeerId]);

  // 폼 제출을 통한 상대방 연결
  const handleConnect = useCallback((e) => {
    e.preventDefault();
    const rawInput = peerInputId.trim();

    if (!rawInput) {
      showToast('연결할 상대방의 6자리 ID를 입력해 주세요.', 3000);
      return;
    }

    const targetId = normalizePeerId(rawInput);
    initiateConnect(targetId);
    setPeerInputId('');
  }, [peerInputId, initiateConnect, showToast]);

  return (
    <div className="flex flex-col h-[100dvh] w-screen bg-slate-950 text-slate-100 overflow-hidden select-none transition-colors duration-200">
      {/* 상단 헤더 */}
      <Header
        myPeerId={myPeerId}
        isPeerReady={isPeerReady}
        peerInputId={peerInputId}
        setPeerInputId={setPeerInputId}
        connectedCount={connections.length}
        isConnecting={isConnecting}
        copiedId={copiedId}
        copiedLink={copiedLink}
        statusMessage={statusMessage}
        onCopyId={handleCopyId}
        onCopyInviteLink={handleCopyInviteLink}
        onConnect={handleConnect}
      />

      {/* 메인 컨텐츠: 상하 2분할 패널 */}
      <main className="flex-1 flex flex-col min-h-0 p-3 sm:p-4 gap-3 sm:gap-4 max-w-7xl w-full mx-auto select-text">
        {/* 상단 패널: 내가 보내는 텍스트 */}
        <SenderPanel text={myText} onChange={handleTextChange} />

        {/* 하단 패널: 상대방이 보낸 텍스트 */}
        <ReceiverPanel text={receivedText} />
      </main>
    </div>
  );
}
