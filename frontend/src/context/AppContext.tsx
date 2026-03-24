import React, { createContext, useContext, useState, useCallback } from 'react';
import { Case, Message, initialCases, initialMessages, activeUser } from '@/data/data';

interface AppContextType {
  cases: Case[];
  addCase: (c: Case) => void;
  messages: Message[];
  addMessage: (m: Message) => void;
  activeUser: typeof activeUser;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [cases, setCases] = useState<Case[]>(initialCases);
  const [messages, setMessages] = useState<Message[]>(initialMessages);

  const addCase = useCallback((c: Case) => {
    setCases(prev => [c, ...prev]);
  }, []);

  const addMessage = useCallback((m: Message) => {
    setMessages(prev => [...prev, m]);
  }, []);

  return (
    <AppContext.Provider value={{ cases, addCase, messages, addMessage, activeUser }}>
      {children}
    </AppContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
