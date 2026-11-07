// 새로고침/탭 복원 시 텍스트 유지를 위한 저장소 헬퍼
// - sessionStorage: 탭별 저장 (같은 브라우저에서 여러 탭을 열어도 새로고침 시 각 탭의 텍스트가 섞이지 않음)
// - localStorage: 탭을 닫았다가 다시 열 때 복원용 (가장 최근에 저장한 탭 기준)
// 사생활 보호 모드·저장 공간 초과 등으로 접근이 막혀도 앱은 정상 동작하도록 모든 접근을 try/catch로 감쌈

const MY_TEXT_KEY = 'p2ptxt:myText';
const RECEIVED_KEY = 'p2ptxt:received';

export interface ReceivedEntry {
  peerId: string;
  text: string;
  updatedAt: number;
}

function isReceivedEntry(value: unknown): value is ReceivedEntry {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.peerId === 'string' && typeof v.text === 'string' && typeof v.updatedAt === 'number';
}

// window.sessionStorage 접근 자체가 예외를 던지는 환경(차단된 저장소) 대비
function getStorages(): Storage[] {
  const storages: Storage[] = [];
  try { storages.push(window.sessionStorage); } catch { /* 사용 불가 */ }
  try { storages.push(window.localStorage); } catch { /* 사용 불가 */ }
  return storages;
}

function readItem(key: string): string | null {
  for (const storage of getStorages()) {
    try {
      const value = storage.getItem(key);
      if (value !== null) return value;
    } catch {
      // 다음 저장소로 진행
    }
  }
  return null;
}

function writeItem(key: string, value: string | null): void {
  for (const storage of getStorages()) {
    try {
      // 빈 값도 sessionStorage에는 기록해 두어야 새로고침 시 다른 탭의 localStorage 값으로 복원되지 않음
      if (value === null && storage !== window.sessionStorage) storage.removeItem(key);
      else storage.setItem(key, value ?? '');
    } catch (err) {
      console.warn(`저장 실패 (${key}):`, err);
    }
  }
}

export function loadMyText(): string {
  return readItem(MY_TEXT_KEY) ?? '';
}

export function saveMyText(text: string): void {
  writeItem(MY_TEXT_KEY, text || null);
}

export function loadReceived(): ReceivedEntry[] {
  try {
    const raw = readItem(RECEIVED_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isReceivedEntry) : [];
  } catch {
    return [];
  }
}

export function saveReceived(entries: ReceivedEntry[]): void {
  writeItem(RECEIVED_KEY, entries.length > 0 ? JSON.stringify(entries) : null);
}
