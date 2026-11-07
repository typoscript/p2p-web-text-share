// WebRTC ICE 서버 구성 (STUN + 선택적 TURN 릴레이)
//
// TURN 설정은 빌드 시 환경 변수로 주입합니다. (값은 번들에 포함되어 공개되므로 무료/제한된 키만 사용)
// - VITE_TURN_CREDENTIALS_URL: RTCIceServer[] JSON을 반환하는 엔드포인트 (예: Metered TURN credentials API)
// - VITE_TURN_URLS / VITE_TURN_USERNAME / VITE_TURN_CREDENTIAL: 고정 TURN 서버 정보 (URL은 쉼표로 구분)
// 둘 다 없거나 불러오기에 실패하면 STUN만으로 동작합니다.

const STUN_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

const FETCH_TIMEOUT_MS = 4000;

export type TurnSource = 'none' | 'static' | 'fetched' | 'fetch-failed';

export interface IceConfigResult {
  config: RTCConfiguration;
  turnSource: TurnSource;
  turnServerCount: number;
}

function isIceServer(value: unknown): value is RTCIceServer {
  if (!value || typeof value !== 'object') return false;
  const urls = (value as { urls?: unknown }).urls;
  return typeof urls === 'string' || (Array.isArray(urls) && urls.every((u) => typeof u === 'string'));
}

// 응답 형식: RTCIceServer[] 또는 { iceServers: RTCIceServer | RTCIceServer[] }
function parseIceServers(data: unknown): RTCIceServer[] {
  const raw = Array.isArray(data) ? data : (data as { iceServers?: unknown } | null)?.iceServers;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.filter(isIceServer);
}

function countTurnUrls(servers: RTCIceServer[]): number {
  return servers
    .flatMap((s) => (Array.isArray(s.urls) ? s.urls : [s.urls]))
    .filter((u) => /^turns?:/i.test(u)).length;
}

function getStaticTurnServers(): RTCIceServer[] {
  const urls = import.meta.env.VITE_TURN_URLS?.trim();
  const username = import.meta.env.VITE_TURN_USERNAME?.trim();
  const credential = import.meta.env.VITE_TURN_CREDENTIAL?.trim();
  if (!urls || !username || !credential) return [];

  return [{
    urls: urls.split(',').map((u) => u.trim()).filter(Boolean),
    username,
    credential,
  }];
}

async function fetchTurnServers(url: string): Promise<RTCIceServer[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parseIceServers(await res.json());
  } finally {
    clearTimeout(timer);
  }
}

export async function loadIceConfig(): Promise<IceConfigResult> {
  const credentialsUrl = import.meta.env.VITE_TURN_CREDENTIALS_URL?.trim();
  let turnServers: RTCIceServer[] = [];
  let turnSource: TurnSource = 'none';

  if (credentialsUrl) {
    try {
      turnServers = await fetchTurnServers(credentialsUrl);
      turnSource = countTurnUrls(turnServers) > 0 ? 'fetched' : 'fetch-failed';
    } catch (err) {
      console.error('TURN 자격 증명 불러오기 실패:', err);
      turnSource = 'fetch-failed';
    }
  }

  // 엔드포인트가 없거나 실패한 경우 고정 TURN 정보로 대체
  if (countTurnUrls(turnServers) === 0) {
    const staticServers = getStaticTurnServers();
    if (staticServers.length > 0) {
      turnServers = [...turnServers, ...staticServers];
      turnSource = 'static';
    }
  }

  // 엔드포인트가 STUN도 함께 반환할 수 있으므로 기본 STUN은 항상 앞에 둠
  return {
    config: { iceServers: [...STUN_SERVERS, ...turnServers] },
    turnSource,
    turnServerCount: countTurnUrls(turnServers),
  };
}

// 실제 연결에 사용된 경로(host: 같은 네트워크 직접 / srflx: STUN 홀펀칭 / relay: TURN 릴레이)
export async function getSelectedCandidateType(pc: RTCPeerConnection): Promise<string | null> {
  const stats = await pc.getStats();
  let pair: { localCandidateId?: string } | undefined;

  stats.forEach((report) => {
    if (report.type === 'transport' && report.selectedCandidatePairId) {
      pair = stats.get(report.selectedCandidatePairId);
    }
  });
  // Safari 등 transport 통계가 없는 브라우저 대비
  if (!pair) {
    stats.forEach((report) => {
      if (!pair && report.type === 'candidate-pair' && report.state === 'succeeded' && report.nominated) {
        pair = report;
      }
    });
  }

  const local = pair?.localCandidateId ? stats.get(pair.localCandidateId) : undefined;
  return local?.candidateType ?? null;
}

export interface CandidateSummary {
  local: Record<string, number>;
  remote: Record<string, number>;
}

// 연결 실패 원인 진단용: 양측이 수집/교환한 ICE 후보 종류별 개수
export async function summarizeCandidates(pc: RTCPeerConnection): Promise<CandidateSummary> {
  const stats = await pc.getStats();
  const summary: CandidateSummary = { local: {}, remote: {} };
  stats.forEach((report) => {
    if (report.type !== 'local-candidate' && report.type !== 'remote-candidate') return;
    const bucket = report.type === 'local-candidate' ? summary.local : summary.remote;
    const type = String(report.candidateType ?? 'unknown');
    bucket[type] = (bucket[type] ?? 0) + 1;
  });
  return summary;
}

export function formatCandidateCounts(counts: Record<string, number>): string {
  const entries = Object.entries(counts);
  return entries.length > 0 ? entries.map(([type, n]) => `${type}×${n}`).join(', ') : '없음';
}

// 후보 구성으로 추정한 실패 원인 안내 문구
export function diagnoseFailure(summary: CandidateSummary): string {
  const localRelay = (summary.local.relay ?? 0) > 0;
  const remoteRelay = (summary.remote.relay ?? 0) > 0;
  const remoteCount = Object.values(summary.remote).reduce((a, b) => a + b, 0);

  if (remoteCount === 0) return '상대방 후보를 받지 못함 (상대 기기 화면 꺼짐/시그널링 지연 가능)';
  if (!localRelay && !remoteRelay) return 'TURN 릴레이 후보 없음: 서로 다른 네트워크(LTE 등)나 공유기 제한 환경에서는 TURN 설정이 필요합니다';
  return 'TURN 릴레이 후보가 있으나 연결 실패: TURN 자격 증명/방화벽을 확인하세요';
}
