// 6자리 단축 코드 <-> 실제 PeerJS ID 변환
// PeerJS 공용 클라우드 서버는 다른 서비스와 ID 공간을 공유하므로
// 실제 등록 ID에는 내부 네임스페이스를 붙이고, 화면/초대 링크에는 6자리 코드만 노출합니다.

export const PEER_ID_PREFIX = 'p2ptxt-';

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

// 새 PeerJS ID 생성 (예: p2ptxt-7k9p2x)
export function generatePeerId(): string {
  return PEER_ID_PREFIX + generateShortCode(6).toLowerCase();
}

// 사용자 입력(6자리 코드, 초대 링크, 전체 ID)을 PeerJS ID로 정규화 (대소문자는 소문자로 통일)
export function normalizePeerId(input: string): string {
  let clean = input.trim().toLowerCase();
  if (clean.includes('join=')) {
    clean = clean.split('join=')[1].split('&')[0];
  }
  if (clean.startsWith(PEER_ID_PREFIX)) {
    clean = clean.slice(PEER_ID_PREFIX.length);
  }
  return clean ? PEER_ID_PREFIX + clean : '';
}

// 화면 표시용 6자리 코드 (네임스페이스 제거 후 대문자)
export function toDisplayCode(peerId: string): string {
  const code = peerId.startsWith(PEER_ID_PREFIX) ? peerId.slice(PEER_ID_PREFIX.length) : peerId;
  return code.toUpperCase();
}
