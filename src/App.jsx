import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import Peer from 'peerjs';
import { Copy, Check, Link2, Users, Send, Download, AlertCircle, Sparkles, Share2, Loader2 } from 'lucide-react';

// 가독성 높은 Base32 문자셋 (0/O, 1/I/L 혼동 문자 제외)
const CODE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const CODE_PREFIX = 'p2ptxt-';

// 글로벌 STUN 서버 풀 (모바일 LTE/5G 및 공유기 NAT 홀펀칭 강화)
const ICE_SERVERS_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
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

// 사용자 입력값을 내부 PeerJS 고유 ID로 정규화 (항상 소문자로 통일하여 대소문자 불일치 원천 차단)
function toFullPeerId(input) {
  let clean = input.trim().toLowerCase();
  // 사용자가 URL 전체나 접두사를 붙여넣은 경우 처리
  if (clean.includes('join=')) {
    clean = clean.split('join=')[1].split('&')[0];
  }
  if (clean.startsWith(CODE_PREFIX)) {
    return clean;
  }
  return `${CODE_PREFIX}${clean}`;
}

// 내부 PeerJS ID를 사용자가 보기 편한 6자리 대문자 코드로 변환
function toDisplayId(peerId) {
  if (!peerId) return '';
  const lower = peerId.toLowerCase();
  if (lower.startsWith(CODE_PREFIX)) {
    return lower.slice(CODE_PREFIX.length).toUpperCase();
  }
  return peerId.toUpperCase();
}

// 상단 헤더 컴포넌트
const Header = memo(function Header({
  myPeerId,
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
  const displayId = toDisplayId(myPeerId);

  return (
    <header className="flex-none bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-3 sm:px-6 transition-colors duration-200">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between max-w-7xl mx-auto">
        {/* 좌측: 내 기기 ID & 연결된 기기 수 */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 rounded-lg px-3 py-1.5 text-xs sm:text-sm transition-all duration-200">
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
              title="원클릭 초대 링크 복사 (상대방 자동 연결)"
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
          statusMessage ? 'max-h-16 opacity-100 mt-2.5' : 'max-h-0 opacity-0 mt-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-2 text-xs sm:text-sm text-indigo-200 bg-indigo-950/70 border border-indigo-700/50 px-3.5 py-1.5 rounded-lg shadow-sm">
          <AlertCircle className="w-4 h-4 text-indigo-400 flex-none animate-bounce" />
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
        showToast(`[${toDisplayId(peerId)}] 기기와의 연결이 종료되었습니다.`, 3000);
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
    const targetDisplay = toDisplayId(conn.peer);

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
      showToast(`[${targetDisplay}] 연결 오류가 발생했습니다.`, 3500);
    });

    // 브라우저 WebRTC DataChannel 이벤트
    if (conn.dataChannel) {
      conn.dataChannel.addEventListener('close', () => {
        removeConnection(conn.peer, conn);
      });
      conn.dataChannel.addEventListener('error', () => {
        removeConnection(conn.peer, conn);
      });
    }

    // WebRTC PeerConnection 상태 변경 감지
    if (conn.peerConnection) {
      conn.peerConnection.addEventListener('connectionstatechange', () => {
        const state = conn.peerConnection?.connectionState;
        if (state === 'disconnected' || state === 'failed' || state === 'closed') {
          setIsConnecting(false);
          removeConnection(conn.peer, conn);
        }
      });
    }
  }, [removeConnection, showToast]);

  // 내부 연결 시도 공통 함수
  const initiateConnect = useCallback((targetFullId) => {
    if (!targetFullId) return;

    const myCurrentId = peerRef.current?.id;
    if (targetFullId === myCurrentId) {
      showToast('자기 자신과는 연결할 수 없습니다.', 3500);
      return;
    }

    if (connectionsRef.current.some((c) => c.peer === targetFullId)) {
      showToast('이미 연결되어 있는 기기입니다.', 3500);
      return;
    }

    if (!peerRef.current || peerRef.current.destroyed || peerRef.current.disconnected) {
      showToast('P2P 시그널링 서버와 다시 연결 중입니다. 잠시 후 시도해 주세요.', 3500);
      peerRef.current?.reconnect();
      return;
    }

    setIsConnecting(true);
    const targetDisplay = toDisplayId(targetFullId);
    showToast(`[${targetDisplay}] 기기와 P2P 연결 수립 중...`, 12000);

    // 타임아웃 감지 (12초 내 연결 미수립 시 사용자에게 명확한 피드백 제공)
    if (connectTimeoutTimer.current) clearTimeout(connectTimeoutTimer.current);
    connectTimeoutTimer.current = setTimeout(() => {
      setIsConnecting(false);
      showToast(`[${targetDisplay}] 기기 응답 없음. 상대방 화면이 켜져 있는지 확인해 주세요.`, 5000);
    }, 12000);

    // 표준 WebRTC DataConnection 수립
    const conn = peerRef.current.connect(targetFullId);
    setupConnection(conn);
  }, [setupConnection, showToast]);

  // Peer 인스턴스 초기화 (소문자 정규화 ID 및 STUN 풀 구성)
  useEffect(() => {
    let currentPeer = null;

    const initPeer = () => {
      // 6자리 단축 코드 생성 후 소문자로 내부 ID 생성
      const shortCode = generateShortCode(6).toLowerCase();
      const fullId = `${CODE_PREFIX}${shortCode}`;

      const peer = new Peer(fullId, {
        config: ICE_SERVERS_CONFIG,
      });
      currentPeer = peer;
      peerRef.current = peer;

      peer.on('open', (id) => {
        setMyPeerId(id);

        // URL에 ?join= 파라미터가 있을 시 자동 연결 시도
        if (!autoConnectAttempted.current) {
          const params = new URLSearchParams(window.location.search);
          const joinParam = params.get('join') || params.get('connect');
          if (joinParam && joinParam.trim()) {
            autoConnectAttempted.current = true;
            const targetFullId = toFullPeerId(joinParam);
            setTimeout(() => {
              initiateConnect(targetFullId);
            }, 800);
            window.history.replaceState({}, '', window.location.pathname);
          }
        }
      });

      // 상대방 연결 요청 자동 수락
      peer.on('connection', (conn) => {
        setupConnection(conn);
      });

      peer.on('error', (err) => {
        console.error('PeerJS error:', err);
        setIsConnecting(false);

        // ID 충돌 시 자동 재시도
        if (err.type === 'unavailable-id') {
          console.warn('ID 충돌 감지, 새 ID로 재초기화합니다.');
          peer.destroy();
          initPeer();
          return;
        }

        if (err.type === 'peer-unavailable') {
          showToast('해당 ID의 기기를 찾을 수 없습니다. 상대방 ID를 다시 확인해 주세요.', 4500);
        } else {
          showToast(`P2P 연결 오류: ${err.message || err.type}`, 4000);
        }
      });

      // 연결이 끊어졌을 때 자동 재연결
      peer.on('disconnected', () => {
        console.warn('PeerJS 시그널링 서버 연결 끊김. 재연결 시도...');
        if (!peer.destroyed) {
          peer.reconnect();
        }
      });
    };

    initPeer();

    // 모바일 브라우저 백그라운드 전환 복귀 시 시그널링 재연결
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (currentPeer && currentPeer.disconnected && !currentPeer.destroyed) {
          currentPeer.reconnect();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 언로드 시 연결 정리
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
  }, [setupConnection, initiateConnect, showToast]);

  // ID 클립보드 복사
  const handleCopyId = useCallback(async () => {
    const displayId = toDisplayId(myPeerId);
    if (!displayId) return;
    try {
      await navigator.clipboard.writeText(displayId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch (err) {
      console.error('Failed to copy ID:', err);
    }
  }, [myPeerId]);

  // 원클릭 초대 링크 클립보드 복사
  const handleCopyInviteLink = useCallback(async () => {
    const displayId = toDisplayId(myPeerId);
    if (!displayId) return;
    const inviteUrl = `${window.location.origin}${window.location.pathname}?join=${displayId}`;
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

    const targetFullId = toFullPeerId(rawInput);
    initiateConnect(targetFullId);
    setPeerInputId('');
  }, [peerInputId, initiateConnect, showToast]);

  return (
    <div className="flex flex-col h-[100dvh] w-screen bg-slate-950 text-slate-100 overflow-hidden select-none transition-colors duration-200">
      {/* 상단 헤더 */}
      <Header
        myPeerId={myPeerId}
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
