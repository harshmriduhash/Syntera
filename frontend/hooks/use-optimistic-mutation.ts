/**
 * Generic Optimistic Mutation Hook
 * Provides reusable optimistic update patterns for React Query mutations
 */

'use client'

import { useMutation, useQueryClient, type UseMutationOptions, type UseMutationResult } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { QueryKey } from '@tanstack/react-query'

export interface OptimisticUpdateContext<TData, TVariables> {
  previousData?: TData
  previousList?: TData[]
  previousItem?: TData
  [key: string]: unknown
}

export interface OptimisticMutationOptions<TData, TError, TVariables, TContext, TListData = TData> {
  /**
   * Query keys to invalidate on success
   */
  invalidateQueries?: QueryKey[]
  
  /**
   * Function to extract query keys from mutation variables
   */
  getInvalidateQueries?: (variables: TVariables) => QueryKey[]
  
  /**
   * Success message to show in toast
   */
  successMessage?: string | ((data: TData, variables: TVariables) => string)
  
  /**
   * Error message prefix (default: 'Failed to')
   */
  errorMessagePrefix?: string
  
  /**
   * Whether to show success toast (default: true)
   */
  showSuccessToast?: boolean
  
  /**
   * Whether to show error toast (default: true)
   */
  showErrorToast?: boolean
  
  /**
   * Optimistic update function for list queries
   * TListData allows different type for list items (e.g., Agent[] when TData is void)
   */
  optimisticUpdateList?: (old: TListData[] | undefined, variables: TVariables) => TListData[]
  
  /**
   * Optimistic update function for item queries
   */
  optimisticUpdateItem?: (old: TData | undefined, variables: TVariables) => TData | undefined
  
  /**
   * Query keys to cancel before optimistic update
   */
  cancelQueries?: QueryKey[]
  
  /**
   * Function to extract query keys to cancel from mutation variables
   */
  getCancelQueries?: (variables: TVariables) => QueryKey[]
  
  /**
   * Function to create optimistic data from variables
   */
  createOptimisticData?: (variables: TVariables) => TData
  
  /**
   * Function to extract item ID from variables (for individual query updates)
   */
  getItemId?: (variables: TVariables) => string | undefined
  
  /**
   * Query key pattern for list (e.g., ['agents'])
   */
  listQueryKey?: QueryKey
  
  /**
   * Function to get item query key from variables (e.g., ['agents', id])
   */
  getItemQueryKey?: (variables: TVariables) => QueryKey | undefined
  
  /**
   * Whether to remove item query on success (for delete operations)
   */
  removeItemQueryOnSuccess?: boolean
}

/**
 * Generic optimistic mutation hook
 * 
 * @example
 * ```tsx
 * const createAgent = useOptimisticMutation({
 *   mutationFn: createAgentAPI,
 *   listQueryKey: ['agents'],
 *   getItemQueryKey: (vars) => ['agents', vars.id],
 *   successMessage: 'Agent created successfully',
 *   optimisticUpdateList: (old, vars) => [
 *     { ...vars, id: `temp-${Date.now()}`, ...optimisticData },
 *     ...(old || [])
 *   ],
 * })
 * ```
 */
export function useOptimisticMutation<
  TData = unknown,
  TError = Error,
  TVariables = void,
  TContext = OptimisticUpdateContext<TData, TVariables>,
  TListData = TData
>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: OptimisticMutationOptions<TData, TError, TVariables, TContext, TListData> = {}
): UseMutationResult<TData, TError, TVariables, TContext> {
  const queryClient = useQueryClient()
  
  const {
    invalidateQueries = [],
    getInvalidateQueries,
    successMessage,
    errorMessagePrefix = 'Failed to',
    showSuccessToast = true,
    showErrorToast = true,
    optimisticUpdateList,
    optimisticUpdateItem,
    cancelQueries = [],
    getCancelQueries,
    createOptimisticData,
    getItemId,
    listQueryKey,
    getItemQueryKey,
    removeItemQueryOnSuccess = false,
  } = options

  const mutationOptions: UseMutationOptions<TData, TError, TVariables, TContext> = {
    mutationFn,
    
    onMutate: async (variables) => {
      // Cancel outgoing queries
      const queriesToCancel = [
        ...cancelQueries,
        ...(getCancelQueries ? getCancelQueries(variables) : []),
        ...(listQueryKey ? [listQueryKey] : []),
        ...(getItemQueryKey ? [getItemQueryKey(variables)].filter(Boolean) as QueryKey[] : []),
      ]
      
      if (queriesToCancel.length > 0) {
        await Promise.all(
          queriesToCancel.map((key) => queryClient.cancelQueries({ queryKey: key }))
        )
      }

      // Snapshot previous values
      const context: OptimisticUpdateContext<TData, TVariables> = {}
      
      if (listQueryKey) {
        const previousList = queryClient.getQueryData<TListData[]>(listQueryKey)
        context.previousList = previousList as unknown as TData[] | undefined
        
        // Apply optimistic update to list
        if (optimisticUpdateList) {
          queryClient.setQueryData<TListData[]>(listQueryKey, (old) => optimisticUpdateList(old, variables))
        } else if (createOptimisticData) {
          queryClient.setQueryData<TListData[]>(listQueryKey, (old = []) => [
            createOptimisticData(variables) as unknown as TListData,
            ...old,
          ])
        }
      }
      
      const itemId = getItemId?.(variables)
      const itemQueryKey = getItemQueryKey?.(variables)
      
      if (itemQueryKey) {
        const previousItem = queryClient.getQueryData<TData>(itemQueryKey)
        context.previousItem = previousItem
        
        // Apply optimistic update to item
        if (optimisticUpdateItem) {
          queryClient.setQueryData<TData>(itemQueryKey, (old) => optimisticUpdateItem(old, variables))
        } else if (createOptimisticData && itemId) {
          queryClient.setQueryData<TData>(itemQueryKey, createOptimisticData(variables))
        }
      }

      return context as TContext
    },
    
    onError: (error: TError, variables, context) => {
      // Rollback optimistic updates
      if (context && typeof context === 'object') {
        if (listQueryKey && 'previousList' in context) {
          queryClient.setQueryData(listQueryKey, (context as any).previousList)
        }
        
        const itemQueryKey = getItemQueryKey?.(variables)
        if (itemQueryKey && 'previousItem' in context) {
          queryClient.setQueryData(itemQueryKey, (context as any).previousItem)
        }
      }
      
      if (showErrorToast) {
        const errorMessage = error instanceof Error 
          ? error.message 
          : String(error)
        toast.error(errorMessage || `${errorMessagePrefix} perform operation`)
      }
    },
    
    onSuccess: (data, variables) => {
      // Replace optimistic data with real data (skip if data is void/undefined for delete operations)
      if (listQueryKey && data !== undefined) {
        queryClient.setQueryData<TListData[]>(listQueryKey, (old = []) => {
          // Remove temporary items and add real data
          const filtered = old.filter((item: any) => {
            const id = (item as any).id || (item as any)._id
            return !id?.toString().startsWith('temp-')
          })
          
          // If we have an ID in the response, replace the item; otherwise prepend
          const itemId = (data as any)?.id || (data as any)?._id
          if (itemId) {
            const existingIndex = filtered.findIndex((item: any) => {
              const id = (item as any).id || (item as any)._id
              return id === itemId
            })
            if (existingIndex >= 0) {
              filtered[existingIndex] = data
              return filtered
            }
          }
          
          return [data, ...filtered]
        })
      }
      
      const itemQueryKey = getItemQueryKey?.(variables)
      if (itemQueryKey) {
        if (removeItemQueryOnSuccess) {
          queryClient.removeQueries({ queryKey: itemQueryKey })
        } else if (data !== undefined) {
          queryClient.setQueryData(itemQueryKey, data)
        }
      }
      
      // Invalidate queries (skip itemQueryKey if we removed it)
      const queriesToInvalidate = [
        ...invalidateQueries,
        ...(getInvalidateQueries ? getInvalidateQueries(variables) : []),
        ...(listQueryKey ? [listQueryKey] : []),
        ...(itemQueryKey && !removeItemQueryOnSuccess ? [itemQueryKey] : []),
      ]
      
      queriesToInvalidate.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key })
      })
      
      if (showSuccessToast) {
        const message = typeof successMessage === 'function'
          ? successMessage(data, variables)
          : successMessage || 'Operation completed successfully'
        toast.success(message)
      }
    },
    
    onSettled: (_data, _error, variables) => {
      // Always refetch to ensure consistency
      const queriesToInvalidate = [
        ...invalidateQueries,
        ...(getInvalidateQueries ? getInvalidateQueries(variables) : []),
        ...(listQueryKey ? [listQueryKey] : []),
        ...(getItemQueryKey ? [getItemQueryKey(variables)].filter(Boolean) as QueryKey[] : []),
      ]
      
      queriesToInvalidate.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key })
      })
    },
  }

  return useMutation(mutationOptions)
}

/**
 * Simple mutation hook without optimistic updates
 * Just handles success/error toasts and cache invalidation
 * 
 * @example
 * ```tsx
 * const deleteAgent = useSimpleMutation({
 *   mutationFn: (id: string) => deleteAgentAPI(id),
 *   invalidateQueries: [['agents']],
 *   successMessage: 'Agent deleted successfully',
 * })
 * ```
 */
export function useSimpleMutation<
  TData = unknown,
  TError = Error,
  TVariables = void
>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: {
    invalidateQueries?: QueryKey[]
    getInvalidateQueries?: (variables: TVariables) => QueryKey[]
    successMessage?: string | ((data: TData, variables: TVariables) => string)
    errorMessagePrefix?: string
    showSuccessToast?: boolean
    showErrorToast?: boolean
  } = {}
): UseMutationResult<TData, TError, TVariables> {
  const queryClient = useQueryClient()
  
  const {
    invalidateQueries = [],
    getInvalidateQueries,
    successMessage,
    errorMessagePrefix = 'Failed to',
    showSuccessToast = true,
    showErrorToast = true,
  } = options

  return useMutation({
    mutationFn,
    onSuccess: (data, variables) => {
      const queriesToInvalidate = [
        ...invalidateQueries,
        ...(getInvalidateQueries ? getInvalidateQueries(variables) : []),
      ]
      
      queriesToInvalidate.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key })
      })
      
      if (showSuccessToast) {
        const message = typeof successMessage === 'function'
          ? successMessage(data, variables)
          : successMessage || 'Operation completed successfully'
        toast.success(message)
      }
    },
    onError: (error: TError) => {
      if (showErrorToast) {
        const errorMessage = error instanceof Error 
          ? error.message 
          : String(error)
        toast.error(errorMessage || `${errorMessagePrefix} perform operation`)
      }
    },
  })
}

