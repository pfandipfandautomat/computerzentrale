import { useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

interface ParamConfig<T> {
  /** URL parameter key */
  key: string
  /** Get current value from store */
  get: () => T
  /** Set value in store */
  set: (value: T) => void
  /** Convert value to URL string (default: String(value)) */
  serialize?: (value: T) => string
  /** Convert URL string to value (default: value as T) */
  deserialize?: (value: string) => T
  /** Default value when param is missing */
  defaultValue?: T
}

interface UseUrlParamsConfig {
  params: ParamConfig<any>[]
}

/**
 * Hook to sync URL search params with Zustand store state.
 * 
 * Features:
 * - Reads URL params on mount and updates store (deep linking)
 * - Updates URL when store state changes
 * - Debounces URL updates to prevent excessive history entries
 * - Removes params from URL when they match default values
 * 
 * @example
 * ```tsx
 * useUrlParams({
 *   params: [
 *     {
 *       key: 'tab',
 *       get: () => store.activeTab,
 *       set: store.setActiveTab,
 *       defaultValue: 'docker',
 *     },
 *     {
 *       key: 'host',
 *       get: () => store.selectedHostId,
 *       set: store.setSelectedHostId,
 *     },
 *   ],
 * })
 * ```
 */
export function useUrlParams(config: UseUrlParamsConfig): void {
  const [searchParams, setSearchParams] = useSearchParams()
  const isInitialMount = useRef(true)
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Read URL params on mount and update store
  useEffect(() => {
    if (!isInitialMount.current) return
    isInitialMount.current = false
    
    config.params.forEach(param => {
      const urlValue = searchParams.get(param.key)
      
      if (urlValue !== null) {
        // URL has a value, deserialize and set in store
        const deserialize = param.deserialize || ((v: string) => v as any)
        const value = deserialize(urlValue)
        param.set(value)
      } else if (param.defaultValue !== undefined) {
        // No URL value, but we have a default - ensure store has default
        const currentValue = param.get()
        if (currentValue === null || currentValue === undefined) {
          param.set(param.defaultValue)
        }
      }
    })
  }, []) // Only run on mount
  
  // Build current URL params from store state
  const buildUrlParams = useCallback(() => {
    const newParams = new URLSearchParams()
    
    config.params.forEach(param => {
      const value = param.get()
      const serialize = param.serialize || ((v: any) => String(v))
      
      // Skip null/undefined values
      if (value === null || value === undefined) return
      
      // Skip if value equals default (keep URL clean)
      if (param.defaultValue !== undefined && value === param.defaultValue) return
      
      newParams.set(param.key, serialize(value))
    })
    
    return newParams
  }, [config.params])
  
  // Update URL when store state changes (debounced)
  useEffect(() => {
    // Skip initial mount - we just read from URL
    if (isInitialMount.current) return
    
    // Clear any pending update
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current)
    }
    
    // Debounce URL updates
    updateTimeoutRef.current = setTimeout(() => {
      const newParams = buildUrlParams()
      const currentParamsString = searchParams.toString()
      const newParamsString = newParams.toString()
      
      // Only update if params actually changed
      if (currentParamsString !== newParamsString) {
        setSearchParams(newParams, { replace: true })
      }
    }, 100)
    
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }
    }
  }, [
    // Re-run when any param value changes
    ...config.params.map(p => p.get()),
    buildUrlParams,
    searchParams,
    setSearchParams,
  ])
}

/**
 * Helper to create a param config for a management tab
 */
export function createTabParam(
  get: () => string,
  set: (value: string) => void,
  defaultValue: string = 'docker'
): ParamConfig<string> {
  return {
    key: 'tab',
    get,
    set,
    defaultValue,
  }
}

/**
 * Helper to create a param config for a selected host ID
 */
export function createHostParam(
  get: () => string | null,
  set: (value: string | null) => void
): ParamConfig<string | null> {
  return {
    key: 'host',
    get,
    set,
    serialize: (v) => v || '',
    deserialize: (v) => v || null,
  }
}
