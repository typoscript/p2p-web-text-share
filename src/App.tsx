import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import Peer from 'peerjs';
import type { DataConnection, PeerOptions } from 'peerjs';
import { loadIceConfig, getSelectedCandidateType, summarizeCandidates, formatCandidateCounts, diagnoseFailure } from './iceConfig';
import { Copy, Check, Link2, Users, Send, Sparkles, Share2, Loader2, Terminal, ChevronDown, ChevronUp, QrCode } from 'lucide-react';
import { QrInviteModal } from './components/QrInviteModal';
import { Toast } from './components/Toast';
import type { ToastState, ToastVariant } from './components/Toast';
import { ReceiverPanel } from './components/ReceiverPanel';
import { loadMyText, saveMyText, loadReceived, saveReceived } from './storage';
import type { ReceivedEntry } from './storage';

// 알림 토스트 기본 표시 시간
const TOAST_DURATION_MS = 2000;

// 가독성 높은 Base32 문자셋 (0/O, 1/I/L 혼동 문자 제외)
const CODE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

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
  showDebug: boolean;
  onToggleDebug: () => void;
  onCopyId: () => void;
  onCopyInviteLink: () => void;
  onShowQr: () => void;
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
  showDebug,
  onToggleDebug,
  onCopyId,
  onCopyInviteLink,
  onShowQr,
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

            {/* QR 코드 초대 버튼 */}
            <button
              type="button"
              onClick={onShowQr}
              disabled={!displayId}
              title="QR 코드로 초대"
              className="p-1 text-slate-400 hover:text-indigo-300 hover:bg-slate-700/70 disabled:opacity-30 rounded transition-all duration-150 active:scale-90"
            >
              <QrCode className="w-4 h-4" />
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

export default function App() {
  const [myPeerId, setMyPeerId] = useState('');
  const [isPeerReady, setIsPeerReady] = useState(false);
  const [peerInputId, setPeerInputId] = useState('');
  const [connections, setConnections] = useState<DataConnection[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const [showQr, setShowQr] = useState(false);

  // 새로고침/iOS 탭 복원 시에도 이전 텍스트 유지
  const [myText, setMyText] = useState(loadMyText);
  const [received, setReceived] = useState<ReceivedEntry[]>(loadReceived);
  const [activePeerId, setActivePeerId] = useState<string | null>(() => {
    const restored = loadReceived();
    if (restored.length === 0) return null;
    return restored.reduce((a, b) => (b.updatedAt > a.updatedAt ? b : a)).peerId;
  });
  const [unreadPeerIds, setUnreadPeerIds] = useState<Set<string>>(() => new Set());

  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<DataConnection[]>([]);
  const myTextRef = useRef(myText);
  const activePeerIdRef = useRef(activePeerId);
  const toastTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const connectTimeoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 현재 진행 중인 발신 연결 (타임아웃/로딩 상태는 이 연결에만 적용)
  const pendingConnRef = useRef<DataConnection | null>(null);
  // 내가 발신한 연결 목록 (중복 연결 시 양측이 동일한 연결을 남기기 위한 판정용)
  const outgoingConnsRef = useRef(new WeakSet<DataConnection>());
  const autoConnectAttempted = useRef(false);

  // 실시간 디버그 로그 기록 헬퍼
  const addLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString();
    console.log(`[P2P LOG ${time}]`, msg);
    setLogs((prev) => [...prev.slice(-30), `[${time}] ${msg}`]);
  }, []);

  // 상단 플로팅 토스트 노출 헬퍼 (기본 2초 표시 후 페이드아웃)
  const showToast = useCallback((message: string, variant: ToastVariant = 'info', duration = TOAST_DURATION_MS) => {
    toastTimersRef.current.forEach(clearTimeout);
    const id = Date.now();
    // 처음엔 숨긴 상태로 렌더링한 뒤 다음 틱에 표시하여 슬라이드인 전환 적용
    setToast({ id, message, variant, visible: false });
    toastTimersRef.current = [
      setTimeout(() => setToast((t) => (t && t.id === id ? { ...t, visible: true } : t)), 20),
      setTimeout(() => setToast((t) => (t && t.id === id ? { ...t, visible: false } : t)), duration),
      setTimeout(() => setToast((t) => (t && t.id === id ? null : t)), duration + 300),
    ];
  }, []);

  useEffect(() => () => toastTimersRef.current.forEach(clearTimeout), []);

  useEffect(() => {
    myTextRef.current = myText;
  }, [myText]);

  useEffect(() => {
    activePeerIdRef.current = activePeerId;
  }, [activePeerId]);

  // localStorage 저장 (타이핑 중 과도한 쓰기를 막기 위해 300ms 디바운스)
  useEffect(() => {
    const timer = setTimeout(() => saveMyText(myText), 300);
    return () => clearTimeout(timer);
  }, [myText]);

  useEffect(() => {
    const timer = setTimeout(() => saveReceived(received), 300);
    return () => clearTimeout(timer);
  }, [received]);

  // 기기별 수신 텍스트 갱신 (처음 받은 기기는 자동 선택, 보고 있지 않은 탭은 새 텍스트 표시)
  const handleReceivedText = useCallback((peerId: string, text: string) => {
    setReceived((prev) => {
      const entry: ReceivedEntry = { peerId, text, updatedAt: Date.now() };
      return prev.some((e) => e.peerId === peerId)
        ? prev.map((e) => (e.peerId === peerId ? entry : e))
        : [...prev, entry];
    });
    if (!activePeerIdRef.current) {
      activePeerIdRef.current = peerId;
      setActivePeerId(peerId);
    } else if (activePeerIdRef.current !== peerId) {
      setUnreadPeerIds((prev) => (prev.has(peerId) ? prev : new Set(prev).add(peerId)));
    }
  }, []);

  const handleSelectPeer = useCallback((peerId: string) => {
    activePeerIdRef.current = peerId;
    setActivePeerId(peerId);
    setUnreadPeerIds((prev) => {
      if (!prev.has(peerId)) return prev;
      const next = new Set(prev);
      next.delete(peerId);
      return next;
    });
  }, []);

  const handleRemovePeerText = useCallback((peerId: string) => {
    const next = received.filter((e) => e.peerId !== peerId);
    setReceived(next);
    if (activePeerIdRef.current === peerId) {
      const fallback = next.length > 0 ? next[next.length - 1].peerId : null;
      activePeerIdRef.current = fallback;
      setActivePeerId(fallback);
    }
    setUnreadPeerIds((prev) => {
      if (!prev.has(peerId)) return prev;
      const next = new Set(prev);
      next.delete(peerId);
      return next;
    });
  }, [received]);

  // 연결 목록 갱신 (ref를 즉시 갱신하여 이벤트 핸들러 간 경쟁 상태 방지)
  const commitConnections = useCallback((next: DataConnection[]) => {
    connectionsRef.current = next;
    setConnections(next);
  }, []);

  // 진행 중인 발신 연결 상태 해제 (conn 지정 시 해당 연결이 진행 중일 때만 해제)
  const clearPending = useCallback((conn?: DataConnection) => {
    if (conn && pendingConnRef.current !== conn) return;
    if (connectTimeoutTimer.current) {
      clearTimeout(connectTimeoutTimer.current);
      connectTimeoutTimer.current = null;
    }
    pendingConnRef.current = null;
    setIsConnecting(false);
  }, []);

  // 특정 연결 제거 헬퍼 (같은 피어의 다른 연결은 건드리지 않도록 객체 단위로 비교)
  const removeConnection = useCallback((conn: DataConnection) => {
    if (!connectionsRef.current.includes(conn)) return;
    commitConnections(connectionsRef.current.filter((c) => c !== conn));
    showToast(`[${conn.peer.toUpperCase()}] 기기와의 연결이 끊어졌습니다.`, 'warning');
    addLog(`연결 종료됨: ${conn.peer}`);
  }, [commitConnections, showToast, addLog]);

  // 같은 피어와 연결이 2개 생겼을 때 양측이 동일하게 남길 연결 판정 키
  // (발신자 ID가 작은 쪽 → connectionId가 작은 쪽 우선, connectionId는 양측이 공유)
  const connectionRank = useCallback((conn: DataConnection) => {
    const initiatorId = outgoingConnsRef.current.has(conn) ? peerRef.current?.id ?? '' : conn.peer;
    return `${initiatorId}|${conn.connectionId}`;
  }, []);

  // 열려 있는 모든 피어에게 브로드캐스트
  const broadcastText = useCallback((textToSend: string) => {
    const deadConns: DataConnection[] = [];

    connectionsRef.current.forEach((conn) => {
      if (conn.open) {
        try {
          conn.send(textToSend);
        } catch (err) {
          console.error(`피어(${conn.peer}) 데이터 전송 실패:`, err);
          deadConns.push(conn);
        }
      } else {
        deadConns.push(conn);
      }
    });

    deadConns.forEach((conn) => removeConnection(conn));
  }, [removeConnection]);

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
      clearPending(conn);

      const existing = connectionsRef.current.find((c) => c.peer === conn.peer && c !== conn);
      if (existing) {
        // 중복 연결: 양측이 같은 규칙으로 하나만 남기고 나머지는 닫음
        if (connectionRank(conn) < connectionRank(existing)) {
          commitConnections(connectionsRef.current.map((c) => (c === existing ? conn : c)));
          existing.close();
          addLog(`[${targetDisplay}] 중복 연결 감지: 새 연결로 교체`);
        } else {
          addLog(`[${targetDisplay}] 중복 연결 감지: 기존 연결 유지`);
          conn.close();
          return;
        }
      } else {
        commitConnections([...connectionsRef.current, conn]);
        addLog(`🎉 [${targetDisplay}] 데이터 채널 OPEN 성공!`);
        showToast(`[${targetDisplay}] 기기와 연결되었습니다.`, 'success');
      }

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
      handleReceivedText(conn.peer, text);
    });

    // 연결 종료 및 에러 처리
    conn.on('close', () => {
      clearPending(conn);
      removeConnection(conn);
    });

    conn.on('error', (err) => {
      addLog(`[${targetDisplay}] Connection error: ${err.message || String(err)}`);
      clearPending(conn);
      removeConnection(conn);
      showToast(`[${targetDisplay}] P2P 오류 (${err.message || '네트워크'})`, 'error');
    });

    // WebRTC PeerConnection ICE 상태 감지
    if (conn.peerConnection) {
      // 내 쪽에서 수집된 후보 종류 기록 (host가 .local이면 mDNS로 내부 IP가 가려진 상태)
      const gathered: Record<string, number> = {};
      conn.peerConnection.addEventListener('icecandidate', (e) => {
        if (e.candidate) {
          const type = e.candidate.type ?? 'unknown';
          const key = type === 'host' && e.candidate.address?.endsWith('.local') ? 'host(mDNS)' : type;
          gathered[key] = (gathered[key] ?? 0) + 1;
        } else {
          addLog(`[${targetDisplay}] 내 ICE 후보 수집 완료: ${formatCandidateCounts(gathered)}`);
        }
      });

      conn.peerConnection.addEventListener('iceconnectionstatechange', () => {
        const iceState = conn.peerConnection?.iceConnectionState;
        addLog(`[${targetDisplay}] ICE State: ${iceState}`);
        if (iceState === 'connected' || iceState === 'completed') {
          const pc = conn.peerConnection;
          getSelectedCandidateType(pc)
            .then((type) => {
              const label = type === 'relay' ? 'TURN 릴레이' : type === 'srflx' || type === 'prflx' ? 'STUN 홀펀칭' : type === 'host' ? '같은 네트워크 직접' : '알 수 없음';
              addLog(`[${targetDisplay}] 연결 경로: ${label}${type ? ` (${type})` : ''}`);
            })
            .catch(() => {});
        }
        if (iceState === 'failed') {
          const pc = conn.peerConnection;
          summarizeCandidates(pc)
            .then((summary) => {
              addLog(`[${targetDisplay}] 후보 요약 - 내: ${formatCandidateCounts(summary.local)} / 상대: ${formatCandidateCounts(summary.remote)}`);
              addLog(`[${targetDisplay}] 추정 원인: ${diagnoseFailure(summary)}`);
            })
            .catch(() => {});
          clearPending(conn);
          removeConnection(conn);
          showToast(`[${targetDisplay}] 연결 실패 (로그에서 원인 확인)`, 'error');
        }
      });
    }
  }, [clearPending, commitConnections, connectionRank, removeConnection, handleReceivedText, showToast, addLog]);

  // 내부 연결 시도 공통 함수
  const initiateConnect = useCallback((targetId: string) => {
    if (!targetId) return;

    const myCurrentId = peerRef.current?.id;
    if (targetId === myCurrentId) {
      showToast('자기 자신과는 연결할 수 없습니다.', 'warning');
      return;
    }

    if (connectionsRef.current.some((c) => c.peer === targetId)) {
      showToast('이미 연결되어 있는 기기입니다.', 'warning');
      return;
    }

    if (!peerRef.current || peerRef.current.destroyed || peerRef.current.disconnected) {
      showToast('P2P 서버와 재연결 중입니다. 잠시 후 다시 시도해 주세요.', 'warning');
      peerRef.current?.reconnect();
      return;
    }

    const targetDisplay = targetId.toUpperCase();
    addLog(`발신 연결 요청: ${targetDisplay}`);

    // 이전 발신 시도가 남아 있으면 정리 (늦게 열려 중복 연결이 되는 것 방지)
    const previousPending = pendingConnRef.current;
    clearPending();
    previousPending?.close();

    // 표준 WebRTC DataConnection 수립
    // serialization: 'binary'는 16KB 초과 메시지를 자동 청크 분할하므로 긴 텍스트도 연결이 끊기지 않음
    // 주의: PeerJS 1.5의 유효 값은 'raw' | 'json' | 'binary' | 'binary-utf8' 뿐이며, 그 외 값은 connect()에서 예외 발생
    let conn: DataConnection | undefined;
    try {
      conn = peerRef.current.connect(targetId, {
        reliable: true,
        serialization: 'binary',
      });
    } catch (err) {
      addLog(`connect() 호출 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (!conn) {
      showToast(`[${targetDisplay}] 연결을 시작하지 못했습니다.`, 'error');
      return;
    }

    outgoingConnsRef.current.add(conn);
    pendingConnRef.current = conn;
    setIsConnecting(true);
    showToast(`[${targetDisplay}] 기기와 연결 중...`, 'loading', 15000);

    // 타임아웃 감지 (15초): 응답 없는 연결은 닫아서 뒤늦게 열리지 않도록 함
    const pendingConn = conn;
    connectTimeoutTimer.current = setTimeout(() => {
      if (pendingConnRef.current !== pendingConn) return;
      clearPending();
      addLog(`[${targetDisplay}] 15초 타임아웃 발생. (ICE: ${pendingConn.peerConnection?.iceConnectionState ?? '없음'})`);
      // 닫기 전에 후보 정보를 남겨 실제 기기 환경의 실패 원인을 파악할 수 있도록 함
      const pc = pendingConn.peerConnection;
      const closeConn = () => pendingConn.close();
      if (pc) {
        summarizeCandidates(pc)
          .then((summary) => {
            addLog(`[${targetDisplay}] 후보 요약 - 내: ${formatCandidateCounts(summary.local)} / 상대: ${formatCandidateCounts(summary.remote)}`);
            addLog(`[${targetDisplay}] 추정 원인: ${diagnoseFailure(summary)}`);
          })
          .catch(() => {})
          .finally(closeConn);
      } else {
        closeConn();
      }
      showToast(`[${targetDisplay}] 응답 시간 초과 (상대 화면이 켜져 있는지 확인)`, 'error');
    }, 15000);

    setupConnection(conn);
  }, [clearPending, setupConnection, showToast, addLog]);

  // Peer 인스턴스 초기화 (앱 마운트 시 단 1회 실행)
  useEffect(() => {
    let currentPeer: Peer | null = null;
    let cancelled = false;
    let iceConfig: RTCConfiguration = {};

    const initPeer = () => {
      if (cancelled) return;
      const shortId = generateShortCode(6).toLowerCase();
      addLog(`새 로컬 Peer ID 생성 중: ${shortId.toUpperCase()}`);

      const peerOptions: PeerOptions = { config: iceConfig };
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

        if (err.type === 'unavailable-id') {
          addLog('ID 충돌 발생, 새 ID로 재생성...');
          peer.destroy();
          initPeer();
          return;
        }

        // 진행 중인 발신 연결은 실패 처리 (타임아웃 메시지가 뒤늦게 중복 노출되지 않도록 타이머도 해제)
        const failedPending = pendingConnRef.current;
        clearPending();
        failedPending?.close();

        if (err.type === 'peer-unavailable') {
          showToast('해당 ID의 기기를 찾을 수 없습니다.', 'error');
        } else {
          showToast(`P2P 오류: ${err.message || err.type}`, 'error');
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

    // TURN 자격 증명을 먼저 불러온 뒤 Peer 생성 (실패 시 STUN만으로 진행)
    loadIceConfig().then(({ config, turnSource, turnServerCount }) => {
      iceConfig = config;
      if (turnSource === 'fetched' || turnSource === 'static') {
        addLog(`TURN 릴레이 주소 ${turnServerCount}개 적용 (${turnSource === 'fetched' ? '자격 증명 API' : '고정 설정'})`);
      } else if (turnSource === 'fetch-failed') {
        addLog('TURN 자격 증명 불러오기 실패: STUN만으로 연결합니다.');
      } else {
        addLog('TURN 미설정: STUN만으로 연결합니다. (LTE/5G 환경에서는 연결이 실패할 수 있음)');
      }
      initPeer();
    });

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
      cancelled = true;
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

  const inviteUrl = myPeerId
    ? `${window.location.origin}${window.location.pathname}?join=${myPeerId.toUpperCase()}`
    : '';

  // 원클릭 초대 링크 클립보드 복사
  const handleCopyInviteLink = useCallback(async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      console.error('Failed to copy invite link:', err);
    }
  }, [inviteUrl]);

  const handleShowQr = useCallback(() => setShowQr(true), []);
  const handleCloseQr = useCallback(() => setShowQr(false), []);

  const onlinePeerIds = useMemo(() => new Set(connections.map((c) => c.peer)), [connections]);

  // 폼 제출을 통한 상대방 연결
  const handleConnect = useCallback((e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const rawInput = peerInputId.trim();

    if (!rawInput) {
      showToast('연결할 상대방의 6자리 ID를 입력해 주세요.', 'warning');
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
        showDebug={showDebug}
        onToggleDebug={() => setShowDebug((prev) => !prev)}
        onCopyId={handleCopyId}
        onCopyInviteLink={handleCopyInviteLink}
        onShowQr={handleShowQr}
        onConnect={handleConnect}
      />

      {/* 상단 플로팅 알림 토스트 */}
      <Toast toast={toast} />

      {/* QR 코드 초대 모달 */}
      {showQr && inviteUrl && (
        <QrInviteModal
          inviteUrl={inviteUrl}
          displayId={myPeerId.toUpperCase()}
          copiedLink={copiedLink}
          onCopyInviteLink={handleCopyInviteLink}
          onClose={handleCloseQr}
        />
      )}

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
        <ReceiverPanel
          entries={received}
          activePeerId={activePeerId}
          onlinePeerIds={onlinePeerIds}
          unreadPeerIds={unreadPeerIds}
          onSelect={handleSelectPeer}
          onRemove={handleRemovePeerText}
        />
      </main>
    </div>
  );
}
