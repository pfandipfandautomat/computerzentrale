import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastTitle,
} from "@/components/ui/toast"
import { useToast } from "@/components/ui/use-toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <div className="fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col gap-2 p-4 md:max-w-[420px]">
      {toasts.map(function ({ id, title, description, action, variant, onOpenChange, ...props }) {
        return (
          <Toast 
            key={id} 
            variant={variant}
            className="animate-in slide-in-from-bottom-5 fade-in-0 duration-300"
            {...props}
          >
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose onClose={() => onOpenChange?.(false)} />
          </Toast>
        )
      })}
    </div>
  )
}
