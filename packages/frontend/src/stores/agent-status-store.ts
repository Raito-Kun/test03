import { create } from 'zustand';
import type { AgentStatus } from '@shared/constants/enums';

interface AgentInfo {
  userId: string;
  fullName: string;
  status: AgentStatus;
  changedAt: string;
}

interface AgentStatusState {
  myStatus: AgentStatus;
  agents: AgentInfo[];
  setMyStatus: (status: AgentStatus) => void;
  setAgents: (agents: AgentInfo[]) => void;
  updateAgent: (userId: string, status: AgentStatus) => void;
}

export const useAgentStatusStore = create<AgentStatusState>((set) => ({
  myStatus: 'offline',
  agents: [],
  setMyStatus: (status) => set({ myStatus: status }),
  setAgents: (agents) => set({ agents }),
  updateAgent: (userId, status) =>
    set((state) => ({
      agents: state.agents.map((a) =>
        a.userId === userId ? { ...a, status, changedAt: new Date().toISOString() } : a,
      ),
    })),
}));
