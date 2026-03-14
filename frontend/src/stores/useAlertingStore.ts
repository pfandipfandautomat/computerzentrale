import { create } from 'zustand';
import { api } from '@/services/api';

interface TelegramConfig {
  configured: boolean;
  botTokenSet?: boolean;
  botTokenPreview?: string;
  chatId?: string;
  enabled?: boolean;
  updatedAt?: string;
}

interface AlertRule {
  id: string;
  eventType: string;
  enabled: boolean;
  nodeId: string | null;
  threshold: number | null;
  message: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AlertEvent {
  id: string;
  eventType: string;
  nodeId: string | null;
  nodeName: string | null;
  message: string;
  details: Record<string, any> | null;
  severity: string;
  alertSent: boolean;
  createdAt: string;
}

interface EventType {
  id: string;
  label: string;
  description: string;
  severity: string;
}

interface AlertingState {
  // Telegram config
  telegramConfig: TelegramConfig | null;
  isLoadingTelegramConfig: boolean;
  
  // Alert rules
  rules: AlertRule[];
  isLoadingRules: boolean;
  
  // Events
  events: AlertEvent[];
  isLoadingEvents: boolean;
  
  // Event types (static reference data)
  eventTypes: EventType[];
  
  // Actions - Telegram
  fetchTelegramConfig: () => Promise<void>;
  saveTelegramConfig: (data: { botToken: string; chatId: string; enabled?: boolean }) => Promise<boolean>;
  testTelegramConnection: (botToken: string, chatId: string) => Promise<{ success: boolean; error?: string }>;
  
  // Actions - Rules
  fetchRules: () => Promise<void>;
  createRule: (data: { eventType: string; nodeId?: string; threshold?: number; message?: string }) => Promise<AlertRule | null>;
  updateRule: (id: string, data: Partial<AlertRule>) => Promise<boolean>;
  deleteRule: (id: string) => Promise<boolean>;
  toggleRule: (id: string) => Promise<boolean>;
  
  // Actions - Events
  fetchEvents: (limit?: number) => Promise<void>;
  clearEvents: () => Promise<boolean>;
  
  // Actions - Event Types
  fetchEventTypes: () => Promise<void>;
  
  // Utility
  fetchAll: () => Promise<void>;
}

export const useAlertingStore = create<AlertingState>((set, get) => ({
  // Initial state
  telegramConfig: null,
  isLoadingTelegramConfig: false,
  rules: [],
  isLoadingRules: false,
  events: [],
  isLoadingEvents: false,
  eventTypes: [],

  // Telegram actions
  fetchTelegramConfig: async () => {
    set({ isLoadingTelegramConfig: true });
    try {
      const config = await api.getTelegramConfig();
      set({ telegramConfig: config });
    } catch (error) {
      console.error('[AlertingStore] Failed to fetch telegram config:', error);
    } finally {
      set({ isLoadingTelegramConfig: false });
    }
  },

  saveTelegramConfig: async (data) => {
    try {
      await api.saveTelegramConfig(data);
      await get().fetchTelegramConfig();
      return true;
    } catch (error) {
      console.error('[AlertingStore] Failed to save telegram config:', error);
      return false;
    }
  },

  testTelegramConnection: async (botToken, chatId) => {
    try {
      return await api.testTelegramConnection({ botToken, chatId });
    } catch (error) {
      console.error('[AlertingStore] Failed to test telegram:', error);
      return { success: false, error: 'Failed to test connection' };
    }
  },

  // Rules actions
  fetchRules: async () => {
    set({ isLoadingRules: true });
    try {
      const rules = await api.getAlertRules();
      set({ rules });
    } catch (error) {
      console.error('[AlertingStore] Failed to fetch rules:', error);
    } finally {
      set({ isLoadingRules: false });
    }
  },

  createRule: async (data) => {
    try {
      const rule = await api.createAlertRule(data);
      set((state) => ({ rules: [...state.rules, rule] }));
      return rule;
    } catch (error) {
      console.error('[AlertingStore] Failed to create rule:', error);
      return null;
    }
  },

  updateRule: async (id, data) => {
    try {
      const updated = await api.updateAlertRule(id, data);
      set((state) => ({
        rules: state.rules.map((r) => (r.id === id ? updated : r)),
      }));
      return true;
    } catch (error) {
      console.error('[AlertingStore] Failed to update rule:', error);
      return false;
    }
  },

  deleteRule: async (id) => {
    try {
      await api.deleteAlertRule(id);
      set((state) => ({
        rules: state.rules.filter((r) => r.id !== id),
      }));
      return true;
    } catch (error) {
      console.error('[AlertingStore] Failed to delete rule:', error);
      return false;
    }
  },

  toggleRule: async (id) => {
    const rule = get().rules.find((r) => r.id === id);
    if (!rule) return false;
    return get().updateRule(id, { enabled: !rule.enabled });
  },

  // Events actions
  fetchEvents: async (limit = 100) => {
    set({ isLoadingEvents: true });
    try {
      const events = await api.getEvents(limit);
      set({ events });
    } catch (error) {
      console.error('[AlertingStore] Failed to fetch events:', error);
    } finally {
      set({ isLoadingEvents: false });
    }
  },

  clearEvents: async () => {
    try {
      await api.clearEvents();
      set({ events: [] });
      return true;
    } catch (error) {
      console.error('[AlertingStore] Failed to clear events:', error);
      return false;
    }
  },

  // Event types actions
  fetchEventTypes: async () => {
    try {
      const eventTypes = await api.getEventTypes();
      set({ eventTypes });
    } catch (error) {
      console.error('[AlertingStore] Failed to fetch event types:', error);
    }
  },

  // Fetch all data
  fetchAll: async () => {
    await Promise.all([
      get().fetchTelegramConfig(),
      get().fetchRules(),
      get().fetchEvents(),
      get().fetchEventTypes(),
    ]);
  },
}));
