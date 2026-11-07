import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import Peer from 'peerjs';
import { Copy, Check, Link2, Users, Send, Download, AlertCircle, Sparkles } from 'lucide-react';

// 상단 헤더 컴포넌트
const Header = memo(function Header({
  myPeerId,
  peerInputId,
  setPeerInputId,
  connectedCount,
  copied,
  statusMessage,
  onCopyId,
  onConnect,
}) {
  return (
    <header className="flex-none bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-3 sm:px-6 transition-colors duration-200">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between max-w-7xl mx-auto">
        {/* 좌측: 내 기기 ID & 연결된 기기 수 */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 rounded-lg px-3 py-1.5 text-xs sm:text-sm transition-all duration-200">
            <span className="text-slate-400 font-medium">내 기기 ID:</span>
            <code className="font-mono font-semibold text-indigo-400 bg-slate-950/70 px-2 py-0.5 rounded border border-slate-800 select-all tracking-wide">
              {myPeerId || 'ID 발급 중...'}
            </code>
            <button
              type="button"
              onClick={onCopyId}
              disabled={!myPeerId}
              title="ID 클립보드 복사"
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-700/70 disabled:opacity-30 rounded transition-all duration-150 active:scale-90 ml-0.5"
            >
              {copied ? (
                <Check className="w-4 h-4 text-emerald-400 transition-transform duration-200 scale-110" />
              ) : (
                <Copy className="w-4 h-4 transition-transform duration-150" />
              )}
            </button>
            {copied && (
              <span className="text-[11px] sm:text-xs text-emerald-400 font-semibold animate-pulse">
                복사됨!
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
            <span>연결된 기기 수:</span>
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
            onChange={(e) => setPeerInputId(e.target.value)}
            placeholder="상대방 ID 입력"
            className="flex-1 sm:w-64 bg-slate-800/70 hover:bg-slate-800 focus:bg-slate-800/90 border border-slate-700/80 text-slate-100 text-xs sm:text-sm rounded-lg px-3 py-1.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 placeholder-slate-500 font-mono shadow-inner"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 active:scale-95 text-white text-xs sm:text-sm font-medium px-3.5 py-1.5 rounded-lg transition-all duration-200 shadow-sm shadow-indigo-950 whitespace-nowrap cursor-pointer"
          >
            <Link2 className="w-4 h-4 transition-transform group-hover:rotate-45" />
            <span>연결하기</span>
          </button>
        </form>
      </div>

      {/* 상태/알림 메시지 토스트 (부드러운 전환 효과) */}
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
  const [copied, setCopied] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const [myText, setMyText] = useState('');
  const [receivedText, setReceivedText] = useState('');

  const peerRef = useRef(null);
  const connectionsRef = useRef([]);
  const myTextRef = useRef('');
  const toastTimerRef = useRef(null);

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
        showToast(`${peerId} 기기와의 연결이 종료되었습니다.`, 3000);
      }
      return next;
    });
  }, [showToast]);

  // 열려 있는 모든 피어에게 브로드캐스트 (실패하거나 끊긴 연결 자동 감지 및 제거)
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
        // 이미 닫힌 상태인 connection 감지
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

  // Connection 이벤트 리스너 등록 및 다중 계층 연결 끊김 방어 로직
  const setupConnection = useCallback((conn) => {
    const handleOpen = () => {
      setConnections((prev) => {
        if (prev.some((c) => c.peer === conn.peer)) {
          return prev;
        }
        return [...prev, conn];
      });
      showToast(`${conn.peer} 기기와 연결되었습니다!`, 3000);

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

    // 1) PeerJS Connection 레벨 닫힘/에러 처리
    conn.on('close', () => {
      removeConnection(conn.peer, conn);
    });

    conn.on('error', (err) => {
      console.error(`Connection error with ${conn.peer}:`, err);
      removeConnection(conn.peer, conn);
    });

    // 2) 브라우저 WebRTC DataChannel 레벨 닫힘 방어
    if (conn.dataChannel) {
      conn.dataChannel.addEventListener('close', () => {
        removeConnection(conn.peer, conn);
      });
      conn.dataChannel.addEventListener('error', () => {
        removeConnection(conn.peer, conn);
      });
    }

    // 3) WebRTC PeerConnection 상태 변경 감지 (상대방 탭 종료, 네트워크 단절 즉시 감지)
    if (conn.peerConnection) {
      conn.peerConnection.addEventListener('connectionstatechange', () => {
        const state = conn.peerConnection?.connectionState;
        if (state === 'disconnected' || state === 'failed' || state === 'closed') {
          removeConnection(conn.peer, conn);
        }
      });
    }
  }, [removeConnection, showToast]);

  // Peer 인스턴스 초기화
  useEffect(() => {
    const peer = new Peer();
    peerRef.current = peer;

    peer.on('open', (id) => {
      setMyPeerId(id);
    });

    // 상대방 연결 요청 수락
    peer.on('connection', (conn) => {
      setupConnection(conn);
    });

    peer.on('error', (err) => {
      console.error('PeerJS error:', err);
      if (err.type === 'peer-unavailable') {
        showToast('입력하신 ID의 상대를 찾을 수 없습니다.', 4000);
      } else {
        showToast(`P2P 오류: ${err.message || err.type}`, 4000);
      }
    });

    // 페이지 언로드 시 연결 정리
    const handleBeforeUnload = () => {
      peer.destroy();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      peer.destroy();
      peerRef.current = null;
    };
  }, [setupConnection, showToast]);

  // ID 복사
  const handleCopyId = useCallback(async () => {
    if (!myPeerId) return;
    try {
      await navigator.clipboard.writeText(myPeerId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy ID:', err);
    }
  }, [myPeerId]);

  // 상대방 ID로 연결 요청 및 예외 처리
  const handleConnect = useCallback((e) => {
    e.preventDefault();
    const targetId = peerInputId.trim();

    // 1) 입력값이 비어있을 때
    if (!targetId) {
      showToast('연결할 상대방의 ID를 입력해 주세요.', 3000);
      return;
    }

    // 2) 내 본인의 ID를 입력했을 때 ("자기 자신과는 연결할 수 없습니다" 경고)
    if (targetId === myPeerId) {
      showToast('자기 자신과는 연결할 수 없습니다.', 3500);
      return;
    }

    // 3) 이미 연결된 ID를 중복으로 연결하려고 할 때
    if (connectionsRef.current.some((c) => c.peer === targetId)) {
      showToast('이미 연결되어 있는 기기입니다.', 3500);
      return;
    }

    // PeerJS 미준비 상태 점검
    if (!peerRef.current || peerRef.current.destroyed) {
      showToast('P2P 서비스가 아직 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.', 3000);
      return;
    }

    // 연결 시도
    const conn = peerRef.current.connect(targetId, {
      reliable: true,
    });

    setupConnection(conn);
    setPeerInputId('');
    showToast(`${targetId} 기기에 연결 요청 중...`, 3000);
  }, [peerInputId, myPeerId, setupConnection, showToast]);

  return (
    <div className="flex flex-col h-[100dvh] w-screen bg-slate-950 text-slate-100 overflow-hidden select-none transition-colors duration-200">
      {/* 상단 헤더 */}
      <Header
        myPeerId={myPeerId}
        peerInputId={peerInputId}
        setPeerInputId={setPeerInputId}
        connectedCount={connections.length}
        copied={copied}
        statusMessage={statusMessage}
        onCopyId={handleCopyId}
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
