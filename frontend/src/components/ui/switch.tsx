import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-5 w-10 shrink-0 cursor-pointer items-center rounded-full border border-border/40 shadow-sm transition-all duration-300 ease-out-quart focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
      // Unchecked state - muted technical look
      "bg-secondary/40 hover:bg-secondary/60 hover:border-border/60",
      // Checked state - vibrant glow
      "data-[state=checked]:bg-primary/20 data-[state=checked]:border-primary/50 data-[state=checked]:shadow-[0_0_12px_-3px_hsl(var(--primary)/0.4)] data-[state=checked]:hover:border-primary/70 data-[state=checked]:hover:shadow-[0_0_16px_-2px_hsl(var(--primary)/0.5)]",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-3.5 w-3.5 rounded-full shadow-lg transition-all duration-300 ease-out-quart",
        // Unchecked state
        "bg-muted-foreground/60 translate-x-0.5",
        // Checked state - bright with inner glow
        "data-[state=checked]:bg-primary data-[state=checked]:translate-x-5 data-[state=checked]:shadow-[0_0_8px_hsl(var(--primary)/0.6),inset_0_1px_2px_rgba(255,255,255,0.2)]"
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
