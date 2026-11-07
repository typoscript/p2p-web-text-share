import { useEffect, useState, memo } from 'react';
import QRCode from 'qrcode';
import { X, Check, Share2 } from 'lucide-react';

interface QrInviteModalProps {
  inviteUrl: string;
  displayId: string;
  copiedLink: boolean;
  onCopyInviteLink: () => void;
  onClose: () => void;
}

// 초대 링크 QR 코드 모달 (다른 기기 카메라로 스캔 시 ?join= 링크로 즉시 접속)
export const QrInviteModal = memo(function QrInviteModal({
  inviteUrl,
  displayId,
  copiedLink,
  onCopyInviteLink,
  onClose,
}: QrInviteModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(inviteUrl, { width: 480, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch((err) => console.error('QR 코드 생성 실패:', err));
    return () => {
      cancelled = true;
    };
  }, [inviteUrl]);

  // ESC 키로 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="QR 코드로 초대"
    >
      <div
        className="relative w-full max-w-xs bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl shadow-black/50 p-5 flex flex-col items-center gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          title="닫기"
          className="absolute top-3 right-3 p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors active:scale-90"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center">
          <h2 className="text-sm font-semibold text-slate-100">QR 코드로 초대</h2>
          <p className="mt-1 text-xs text-slate-400">다른 기기의 카메라로 스캔하면 바로 연결됩니다.</p>
        </div>

        <div className="bg-white rounded-xl p-3 w-56 h-56 flex items-center justify-center">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt={`${displayId} 초대 QR 코드`} className="w-full h-full [image-rendering:pixelated]" />
          ) : (
            <span className="text-xs text-slate-400">생성 중...</span>
          )}
        </div>

        <code className="font-mono text-lg font-bold text-indigo-400 tracking-[0.3em]">{displayId}</code>

        <button
          type="button"
          onClick={onCopyInviteLink}
          className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700/60 px-3 py-2 rounded-lg transition-all duration-150 active:scale-95"
        >
          {copiedLink ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">초대 링크 복사됨!</span>
            </>
          ) : (
            <>
              <Share2 className="w-3.5 h-3.5" />
              <span>초대 링크 복사</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
});
