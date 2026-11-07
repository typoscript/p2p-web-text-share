import { useState, useEffect, useRef, useCallback, memo } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import Peer from 'peerjs';
import type { DataConnection, PeerOptions } from 'peerjs';
import { Copy, Check, Link2, Users, Send, Download, AlertCircle, Sparkles, Share2, Loader2, Terminal, ChevronDown, ChevronUp } from 'lucide-react';

// 가독성 높은 Base32 문자셋 (0/O, 1/I/L 혼동 문자 제외)
const CODE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

// 가장 빠르고 신뢰성 높은 글로벌 STUN 서버 (불안정한 서드파티 TURN 제거하여 타임아웃 지연 원천 차단)
const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
};

function generateShortCode(length = 6): string {
  let result = '';
  const bytes = new Uint8Array(length);
  window.crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i++) {
    result += CODE_CHARS[bytes[i] % CODE_CHARS.length];
  }
  return result;
}

function normalizePeerId(input: string): string {
  let clean = input.trim().toLowerCase();
  if (clean.includes('join=')) {
    clean = clean.split('join=')[1].split('&')[0];
  }
  return clean;
}

interface HeaderProps {
  myPeerId: string;
  isPeerReady: boolean;
  peerInputId: string;
  setPeerInputId: (value: string) => void;
  connectedCount: number;
  isConnecting: boolean;
  copiedId: boolean;
  copiedLink: boolean;
  statusMessage: string;
  showDebug: boolean;
  onToggleDebug: () => void;
  onCopyId: () => void;
  onCopyInviteLink: () => void;
  onConnect: (e: FormEvent<HTMLFormElement>) => void;
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
  showDebug,
  onToggleDebug,
  onCopyId,
  onCopyInviteLink,
  onConnect,
}: HeaderProps) {
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

          {/* 디버그 로그 토글 버튼 */}
          <button
            type="button"
            onClick={onToggleDebug}
            title="P2P 상세 연결 로그 확인"
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/40 px-2 py-1 rounded transition-colors"
          >
            <Terminal className="w-3.5 h-3.5 text-indigo-400" />
            <span>로그</span>
            {showDebug ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
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
interface SenderPanelProps {
  text: string;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
}

const SenderPanel = memo(function SenderPanel({ text, onChange }: SenderPanelProps) {
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
const ReceiverPanel = memo(function ReceiverPanel({ text }: { text: string }) {
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
  const [connections, setConnections] = useState<DataConnection[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [showDebug, setShowDebug] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const [myText, setMyText] = useState('');
  const [receivedText, setReceivedText] = useState('');

  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<DataConnection[]>([]);
  const myTextRef = useRef('');
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectTimeoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoConnectAttempted = useRef(false);

  // 실시간 디버그 로그 기록 헬퍼
  const addLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString();
    console.log(`[P2P LOG ${time}]`, msg);
    setLogs((prev) => [...prev.slice(-30), `[${time}] ${msg}`]);
  }, []);

  // 안내 토스트 노출 헬퍼 함수
  const showToast = useCallback((msg: string, duration = 3000) => {
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
  const removeConnection = useCallback((peerId: string, conn: DataConnection) => {
    setConnections((prev) => {
      const next = prev.filter((c) => c !== conn && c.peer !== peerId);
      if (next.length !== prev.length) {
        showToast(`[${peerId.toUpperCase()}] 기기와의 연결이 종료되었습니다.`, 3000);
        addLog(`연결 종료됨: ${peerId}`);
      }
      return next;
    });
  }, [showToast, addLog]);

  // 열려 있는 모든 피어에게 브로드캐스트
  const broadcastText = useCallback((textToSend: string) => {
    const deadPeers: string[] = [];

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
  const handleTextChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setMyText(newText);
    broadcastText(newText);
  }, [broadcastText]);

  // Connection 이벤트 리스너 등록
  const setupConnection = useCallback((conn: DataConnection) => {
    const targetDisplay = conn.peer.toUpperCase();
    addLog(`상대방(${targetDisplay})과 WebRTC 연결 설정 시작...`);

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
      addLog(`🎉 [${targetDisplay}] 데이터 채널 OPEN 성공!`);
      showToast(`🎉 [${targetDisplay}] 기기와 성공적으로 연결되었습니다!`, 3500);

      // 연결 직후 기존 작성된 텍스트 동기화
      if (myTextRef.current && conn.open) {
        try {
          conn.send(myTextRef.current);
        } catch (err) {
          console.error('초기 텍스트 동기화 실패:', err);
        }
      }
    };

    if (conn.open) {
      handleOpen();
    } else {
      conn.on('open', handleOpen);
    }

    // 데이터 수신 이벤트
    conn.on('data', (data: unknown) => {
      const text =
        typeof data === 'string'
          ? data
          : ((data as { text?: string } | null)?.text ?? String(data));
      setReceivedText(text);
    });

    // 연결 종료 및 에러 처리
    conn.on('close', () => {
      setIsConnecting(false);
      removeConnection(conn.peer, conn);
    });

    conn.on('error', (err) => {
      addLog(`[${targetDisplay}] Connection error: ${err.message || String(err)}`);
      setIsConnecting(false);
      removeConnection(conn.peer, conn);
      showToast(`[${targetDisplay}] P2P 오류 (${err.message || '네트워크'})`, 4000);
    });

    // WebRTC PeerConnection ICE 상태 감지
    if (conn.peerConnection) {
      conn.peerConnection.addEventListener('iceconnectionstatechange', () => {
        const iceState = conn.peerConnection?.iceConnectionState;
        addLog(`[${targetDisplay}] ICE State: ${iceState}`);
        if (iceState === 'failed') {
          setIsConnecting(false);
          removeConnection(conn.peer, conn);
          showToast(`[${targetDisplay}] 네트워크 방화벽으로 P2P 연결 실패`, 4000);
        }
      });
    }
  }, [removeConnection, showToast, addLog]);

  // 내부 연결 시도 공통 함수
  const initiateConnect = useCallback((targetId: string) => {
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
    addLog(`발신 연결 요청: ${targetDisplay}`);
    showToast(`[${targetDisplay}] 기기와 P2P 연결 수립 중...`, 15000);

    // 타임아웃 감지 (15초)
    if (connectTimeoutTimer.current) clearTimeout(connectTimeoutTimer.current);
    connectTimeoutTimer.current = setTimeout(() => {
      setIsConnecting(false);
      addLog(`[${targetDisplay}] 15초 타임아웃 발생.`);
      showToast(`[${targetDisplay}] 응답 시간 초과. 상대방 브라우저 화면이 켜져 있는지 확인해 주세요.`, 5000);
    }, 15000);

    // 표준 WebRTC DataConnection 수립 (serialization: 'raw'로 가볍고 빠른 순수 텍스트 전송)
    // 주의: PeerJS 1.5의 유효 값은 'raw' | 'json' | 'binary' | 'binary-utf8' 뿐이며, 그 외 값은 connect()에서 예외 발생
    let conn: DataConnection | undefined;
    try {
      conn = peerRef.current.connect(targetId, {
        reliable: true,
        serialization: 'raw',
      });
    } catch (err) {
      addLog(`connect() 호출 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (!conn) {
      if (connectTimeoutTimer.current) {
        clearTimeout(connectTimeoutTimer.current);
        connectTimeoutTimer.current = null;
      }
      setIsConnecting(false);
      showToast(`[${targetDisplay}] 연결을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.`, 4000);
      return;
    }
    setupConnection(conn);
  }, [setupConnection, showToast, addLog]);

  // Peer 인스턴스 초기화 (앱 마운트 시 단 1회 실행)
  useEffect(() => {
    let currentPeer: Peer | null = null;

    const initPeer = () => {
      const shortId = generateShortCode(6).toLowerCase();
      addLog(`새 로컬 Peer ID 생성 중: ${shortId.toUpperCase()}`);

      const peerOptions: PeerOptions = { config: ICE_CONFIG };
      const peer = new Peer(shortId, peerOptions);
      currentPeer = peer;
      peerRef.current = peer;

      peer.on('open', (id: string) => {
        setMyPeerId(id);
        setIsPeerReady(true);
        addLog(`시그널링 서버 등록 완료! 내 ID: ${id.toUpperCase()}`);

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
      peer.on('connection', (conn: DataConnection) => {
        addLog(`수신 연결 요청 도착: ${conn.peer.toUpperCase()}`);
        setupConnection(conn);
      });

      peer.on('error', (err) => {
        addLog(`Peer error: ${err.type} - ${err.message}`);
        console.error('PeerJS error:', err);
        setIsConnecting(false);

        if (err.type === 'unavailable-id') {
          addLog('ID 충돌 발생, 새 ID로 재생성...');
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
        addLog('시그널링 서버 연결 끊김, 재연결 시도...');
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
          addLog('화면 복귀 감지: 시그널링 서버 재연결');
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
  const handleConnect = useCallback((e: FormEvent<HTMLFormElement>) => {
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
        showDebug={showDebug}
        onToggleDebug={() => setShowDebug((prev) => !prev)}
        onCopyId={handleCopyId}
        onCopyInviteLink={handleCopyInviteLink}
        onConnect={handleConnect}
      />

      {/* 디버그 로그 HUD 드롭다운 */}
      {showDebug && (
        <div className="flex-none bg-slate-950/95 border-b border-indigo-900/50 p-3 max-h-40 overflow-y-auto font-mono text-xs text-indigo-300 custom-scrollbar select-text">
          <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-800 text-slate-400 font-semibold">
            <span>실시간 P2P 진단 로그</span>
            <button onClick={() => setLogs([])} className="hover:text-white text-[10px]">
              로그 비우기
            </button>
          </div>
          {logs.length === 0 ? (
            <div className="text-slate-600">아직 기록된 로그가 없습니다.</div>
          ) : (
            logs.map((log, idx) => (
              <div key={idx} className="leading-tight py-0.5">
                {log}
              </div>
            ))
          )}
        </div>
      )}

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
