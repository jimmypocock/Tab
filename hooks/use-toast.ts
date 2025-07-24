import { useState, useCallback } from 'react'

export interface Toast {
  id: string
  title?: string
  description?: string
  variant?: 'default' | 'destructive' | 'success'
  duration?: number
}

interface ToastState {
  toasts: Toast[]
}

const initialState: ToastState = {
  toasts: [],
}

let toastCount = 0

function genId() {
  toastCount = (toastCount + 1) % Number.MAX_SAFE_INTEGER
  return toastCount.toString()
}

export function useToast() {
  const [state, setState] = useState<ToastState>(initialState)

  const toast = useCallback(
    ({ ...props }: Omit<Toast, 'id'>) => {
      const id = genId()

      const newToast: Toast = {
        id,
        ...props,
      }

      setState((state) => ({
        toasts: [...state.toasts, newToast],
      }))

      // Auto-remove toast after duration
      const duration = props.duration ?? 5000
      if (duration > 0) {
        setTimeout(() => {
          setState((state) => ({
            toasts: state.toasts.filter((t) => t.id !== id),
          }))
        }, duration)
      }

      return {
        id,
        dismiss: () => {
          setState((state) => ({
            toasts: state.toasts.filter((t) => t.id !== id),
          }))
        },
      }
    },
    []
  )

  const dismiss = useCallback((toastId?: string) => {
    setState((state) => ({
      toasts: toastId
        ? state.toasts.filter((t) => t.id !== toastId)
        : [],
    }))
  }, [])

  return {
    ...state,
    toast,
    dismiss,
  }
}