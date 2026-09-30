import { createContext, useContext } from 'react';
import { ReactNode } from 'react';
import { NearbyRuntime } from '../hooks/useNearbyController';

const NearbyRuntimeContext = createContext<NearbyRuntime | null>(null);

export function NearbyRuntimeProvider({ value, children }: { value: NearbyRuntime; children: ReactNode }) {
  return (
    <NearbyRuntimeContext.Provider value={value}>
      {children}
    </NearbyRuntimeContext.Provider>
  );
}

export function useNearbyRuntime(): NearbyRuntime {
  const value = useContext(NearbyRuntimeContext);
  if (!value) {
    throw new Error('useNearbyRuntime must be used inside NearbyRuntimeProvider');
  }
  return value;
}
