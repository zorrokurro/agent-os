// Council types and API service
// Multi-model deliberation system for AgentOS

export interface Councillor {
  id: string;
  name: string;
  vendor: string;
  model: string;
  role: 'councillor' | 'chairman';
  status: 'idle' | 'thinking' | 'done' | 'error';
  response: string;
  error?: string;
}

export interface Deliberation {
  id: string;
  question: string;
  mode: 'general' | 'review' | 'design' | 'plan' | 'research';
  status: 'pending' | 'stage1' | 'stage2' | 'stage3' | 'complete' | 'error';
  councillors: Councillor[];
  chairman: Councillor | null;
  rankings: Record<string, number>; // councillor id -> borda score
  synthesis: string;
  createdAt: string;
  completedAt: string | null;
}

export interface CouncilState {
  deliberations: Deliberation[];
  activeDeliberation: string | null;
  isRunning: boolean;
}

// Default council lineup
export const DEFAULT_COUNCILLORS: Omit<Councillor, 'status' | 'response'>[] = [
  { id: 'builder', name: 'Builder', vendor: 'AgentOS', model: 'Builder Agent', role: 'councillor' },
  { id: 'optimizer', name: 'Optimizer', vendor: 'AgentOS', model: 'Optimizer Agent', role: 'councillor' },
  { id: 'curator', name: 'Curator', vendor: 'AgentOS', model: 'Curator Agent', role: 'councillor' },
  { id: 'news', name: 'News', vendor: 'AgentOS', model: 'News Agent', role: 'councillor' },
  { id: 'supervisor', name: 'Supervisor', vendor: 'AgentOS', model: 'Supervisor Agent', role: 'councillor' },
];

export const DEFAULT_CHAIRMAN: Omit<Councillor, 'status' | 'response'> = {
  id: 'supervisor_chairman',
  name: 'Supervisor (Chairman)',
  vendor: 'AgentOS',
  model: 'Supervisor Agent (Chairman Mode)',
  role: 'chairman',
};

// Mode descriptions
export const MODE_DESCRIPTIONS: Record<Deliberation['mode'], string> = {
  general: 'Open Q&A, opinions, explanations',
  review: 'Code review, security audit, find bugs',
  design: 'Architecture decisions, tech choices',
  plan: 'Implementation roadmaps',
  research: 'Deep dives, learning',
};

// Generate unique ID
export function generateId(): string {
  return `council_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

// Calculate Borda count from rankings
export function calculateBordaScores(
  rankings: Record<string, string[]> // councillor id -> ordered list of response ids (best first)
): Record<string, number> {
  const scores: Record<string, number> = {};
  const allIds = new Set<string>();

  for (const [, order] of Object.entries(rankings)) {
    for (const id of order) allIds.add(id);
  }

  for (const id of Array.from(allIds)) scores[id] = 0;

  for (const [, order] of Object.entries(rankings)) {
    const n = order.length;
    for (let i = 0; i < n; i++) {
      const responseId = order[i];
      scores[responseId] = (scores[responseId] || 0) + (n - i);
    }
  }

  return scores;
}
