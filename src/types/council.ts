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
