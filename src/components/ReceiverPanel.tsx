import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { Copy, Check, Download, X } from 'lucide-react';
import type { ReceivedEntry } from '../storage';

interface ReceiverPanelProps {
  entries: ReceivedEntry[];
  activePeerId: string | null;
  onlinePeerIds: Set<string>;
  unreadPeerIds: Set<string>;
  onSelect: (peerId: string) => void;
  onRemove: (peerId: string) => void;
}

async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Clipboard API 미지원/거부 시 execCommand 폴백
    const temp = document.createElement('textarea');
    temp.value = text;
    temp.setAttribute('readonly', '');
    temp.style.position = 'fixed';
    temp.style.opacity = '0';
    document.body.appendChild(temp);
    temp.select();
    document.execCommand('copy');
    document.body.removeChild(temp);
  }
}

// 하단 패널: 상대방(기기별 탭)이 보낸 텍스트 수신창
export const ReceiverPanel = memo(function ReceiverPanel({
  entries,
  activePeerId,
  onlinePeerIds,
  unreadPeerIds,
  onSelect,
  onRemove,
}: ReceiverPanelProps) {
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeEntry = entries.find((e) => e.peerId === activePeerId) ?? null;
  const text = activeEntry?.text ?? '';

  useEffect(() => () => {
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
  }, []);

  const handleCopy = useCallback(async () => {
    if (!text) return;
    await copyToClipboard(text);
    setCopied(true);
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <section className="flex-1 flex flex-col min-h-0 bg-slate-900 border border-slate-800/90 hover:border-slate-700/80 rounded-xl overflow-hidden shadow-lg shadow-black/20 transition-all duration-200">
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800/50 border-b border-slate-800/80 transition-colors">
        <div className="flex items-center gap-2">
          <Download className="w-4 h-4 text-emerald-400" />
          <h2 className="text-xs sm:text-sm font-semibold tracking-wide text-slate-200">
            상대방이 보낸 텍스트
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-[11px] text-slate-400 font-medium bg-slate-800/70 px-2 py-0.5 rounded border border-slate-700/40">
            읽기 전용 (Read-only)
          </span>
          {/* 선택된 기기의 수신 텍스트 복사 버튼 */}
          <button
            type="button"
            onClick={handleCopy}
            disabled={!text}
            title="받은 텍스트 전체 복사"
            className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-medium text-slate-300 hover:text-white bg-slate-800/70 hover:bg-slate-700/80 border border-slate-700/60 px-2.5 py-1 rounded-md transition-all duration-150 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">복사됨!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>복사</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 기기별 탭 */}
      {entries.length > 0 && (
        <div className="flex-none flex items-center gap-1.5 px-2.5 pt-2 overflow-x-auto custom-scrollbar" role="tablist">
          {entries.map((entry) => {
            const isActive = entry.peerId === activePeerId;
            const isOnline = onlinePeerIds.has(entry.peerId);
            const isUnread = unreadPeerIds.has(entry.peerId);
            return (
              <div
                key={entry.peerId}
                className={`group flex-none flex items-center rounded-md border text-[11px] sm:text-xs font-mono transition-all duration-150 ${
                  isActive
                    ? 'bg-indigo-600/20 border-indigo-500/60 text-indigo-200'
                    : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => onSelect(entry.peerId)}
                  title={isOnline ? '연결됨' : '연결 끊김 (마지막으로 받은 텍스트)'}
                  className="flex items-center gap-1.5 pl-2.5 pr-1 py-1 tracking-wider active:scale-95 transition-transform"
                >
                  <span className={`inline-flex h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                  <span>{entry.peerId.toUpperCase()}</span>
                  {isUnread && <span className="inline-flex h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" title="새 텍스트" />}
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(entry.peerId)}
                  title="이 기기의 수신 텍스트 지우기"
                  className="p-1 mr-0.5 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-700/70 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex-1 min-h-0 p-2.5 bg-slate-950/40">
        <textarea
          readOnly
          value={text}
          placeholder="연결된 상대방이 입력한 텍스트가 실시간으로 여기에 표시됩니다. (여러 기기 연결 시 기기별 탭으로 구분)"
          className="w-full h-full resize-none bg-transparent text-slate-300 text-sm font-mono p-2 focus:outline-none placeholder-slate-600 leading-relaxed cursor-default custom-scrollbar transition-opacity duration-150"
          spellCheck={false}
        />
      </div>
    </section>
  );
});
