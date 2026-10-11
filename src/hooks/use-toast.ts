"use client"

import * as React from "react"

import type {
  ToastActionElement,
  ToastProps,
} from "@/components/ui/toast"

const TOAST_LIMIT = 1
const TOAST_REMOVE_DELAY = 1_000_000

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

type Action =
  | {
      type: "ADD_TOAST"
      toast: ToasterToast
    }
  | {
      type: "UPDATE_TOAST"
      toast: Partial<ToasterToast> & Pick<ToasterToast, "id">
    }
  | {
      type: "DISMISS_TOAST"
      toastId?: string
    }
  | {
      type: "REMOVE_TOAST"
      toastId?: string
    }

interface State {
  toasts: ToasterToast[]
}

type Toast = Omit<ToasterToast, "id">

type ToastController = {
  id: string
  dismiss: () => void
  update: (props: Partial<ToasterToast>) => void
}

type ToastListener = (state: State) => void

const toastTimeouts = new Map<
  string,
  ReturnType<typeof setTimeout>
>()

const listeners = new Set<ToastListener>()

let memoryState: State = {
  toasts: [],
}

let count = 0

function genId(): string {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

function clearToastTimeout(toastId: string): void {
  const timeout = toastTimeouts.get(toastId)

  if (!timeout) {
    return
  }

  clearTimeout(timeout)
  toastTimeouts.delete(toastId)
}

function addToRemoveQueue(toastId: string): void {
  if (toastTimeouts.has(toastId)) {
    return
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)

    dispatch({
      type: "REMOVE_TOAST",
      toastId,
    })
  }, TOAST_REMOVE_DELAY)

  toastTimeouts.set(toastId, timeout)
}

export const reducer = (
  state: State,
  action: Action,
): State => {
  switch (action.type) {
    case "ADD_TOAST": {
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(
          0,
          TOAST_LIMIT,
        ),
      }
    }

    case "UPDATE_TOAST": {
      return {
        ...state,
        toasts: state.toasts.map((toastItem) =>
          toastItem.id === action.toast.id
            ? {
                ...toastItem,
                ...action.toast,
              }
            : toastItem,
        ),
      }
    }

    case "DISMISS_TOAST": {
      const { toastId } = action

      if (toastId !== undefined) {
        addToRemoveQueue(toastId)
      } else {
        state.toasts.forEach((toastItem) => {
          addToRemoveQueue(toastItem.id)
        })
      }

      return {
        ...state,
        toasts: state.toasts.map((toastItem) =>
          toastId === undefined || toastItem.id === toastId
            ? {
                ...toastItem,
                open: false,
              }
            : toastItem,
        ),
      }
    }

    case "REMOVE_TOAST": {
      if (action.toastId === undefined) {
        state.toasts.forEach((toastItem) => {
          clearToastTimeout(toastItem.id)
        })

        return {
          ...state,
          toasts: [],
        }
      }

      clearToastTimeout(action.toastId)

      return {
        ...state,
        toasts: state.toasts.filter(
          (toastItem) => toastItem.id !== action.toastId,
        ),
      }
    }

    default: {
      const exhaustiveCheck: never = action
      return exhaustiveCheck
    }
  }
}

function dispatch(action: Action): void {
  const nextState = reducer(memoryState, action)

  if (nextState === memoryState) {
    return
  }

  memoryState = nextState

  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

function toast({
  ...props
}: Toast): ToastController {
  const id = genId()

  const dismiss = (): void => {
    dispatch({
      type: "DISMISS_TOAST",
      toastId: id,
    })
  }

  const update = (
    updatedProps: Partial<ToasterToast>,
  ): void => {
    dispatch({
      type: "UPDATE_TOAST",
      toast: {
        ...updatedProps,
        id,
      },
    })
  }

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,

      onOpenChange: (open) => {
        if (!open) {
          dismiss()
        }

        props.onOpenChange?.(open)
      },
    },
  })

  return {
    id,
    dismiss,
    update,
  }
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState)

  React.useEffect(() => {
    const listener: ToastListener = (nextState) => {
      setState(nextState)
    }

    listeners.add(listener)

    // Synchronize in case a toast was created
    // between the initial render and effect subscription.
    setState(memoryState)

    return () => {
      listeners.delete(listener)
    }
  }, [])

  const dismiss = React.useCallback(
    (toastId?: string) => {
      dispatch({
        type: "DISMISS_TOAST",
        toastId,
      })
    },
    [],
  )

  return {
    ...state,
    toast,
    dismiss,
  }
}

export {
  useToast,
  toast,
}

export type {
  Toast,
  ToastController,
  ToasterToast,
  State,
  Action,
}