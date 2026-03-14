import * as React from "react"
import { cn } from "@/lib/utils"

interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode
  iconColor?: string
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

const PageHeader = React.forwardRef<HTMLDivElement, PageHeaderProps>(
  ({ className, icon, iconColor, title, subtitle, actions, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-start justify-between", className)}
      {...props}
    >
      <div className="flex items-center gap-3">
        {icon && (
          <div className={cn("flex-shrink-0", iconColor)}>
            {icon}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      
      {actions && (
        <div className="flex items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  )
)
PageHeader.displayName = "PageHeader"

export { PageHeader }
