import * as React from "react"
import { cn } from "@/lib/utils"
import { StatusIndicator } from "@/components/ui/status-indicator"

// Root sidebar container
const Sidebar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "w-64 border-r border-border/50 bg-card/50 backdrop-blur-sm flex flex-col h-full",
      className
    )}
    {...props}
  />
))
Sidebar.displayName = "Sidebar"

// Header section with title and optional action
interface SidebarHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  icon?: React.ReactNode
  action?: React.ReactNode
}

const SidebarHeader = React.forwardRef<HTMLDivElement, SidebarHeaderProps>(
  ({ className, title, icon, action, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex items-center justify-between px-4 py-4 border-b border-border/50",
        className
      )}
      {...props}
    >
      <h2 className="text-base font-semibold flex items-center gap-2.5 text-foreground">
        {icon}
        {title}
      </h2>
      {action}
    </div>
  )
)
SidebarHeader.displayName = "SidebarHeader"

// Search section
interface SidebarSearchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode
}

const SidebarSearch = React.forwardRef<HTMLInputElement, SidebarSearchProps>(
  ({ className, icon, ...props }, ref) => (
    <div className="px-3 py-3 border-b border-border/50">
      <div className="relative">
        {icon && (
          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          className={cn(
            "flex h-9 w-full rounded-md border border-border/50 bg-background/50 px-3 py-1 text-sm",
            "placeholder:text-muted-foreground/60",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background focus:border-transparent",
            "transition-colors",
            icon && "pl-8",
            className
          )}
          {...props}
        />
      </div>
    </div>
  )
)
SidebarSearch.displayName = "SidebarSearch"

// Navigation section for tab-like buttons
const SidebarNav = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement>
>(({ className, ...props }, ref) => (
  <nav
    ref={ref}
    className={cn("px-3 py-3 space-y-1.5", className)}
    {...props}
  />
))
SidebarNav.displayName = "SidebarNav"

// Navigation item/tab button
interface SidebarNavItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode
  label: string
  badge?: React.ReactNode
  subtitle?: string
  isActive?: boolean
  iconColor?: string
}

const SidebarNavItem = React.forwardRef<HTMLButtonElement, SidebarNavItemProps>(
  ({ className, icon, label, badge, subtitle, isActive, iconColor, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "w-full text-left px-3 py-2.5 rounded-lg border transition-all duration-150",
        "hover:bg-secondary/80 hover:border-border",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        isActive
          ? "bg-secondary/80 border-primary/40 shadow-sm shadow-primary/5"
          : "bg-transparent border-transparent",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {icon && (
            <span className={cn("flex-shrink-0", isActive ? iconColor : "text-muted-foreground")}>
              {icon}
            </span>
          )}
          <span className={cn(
            "text-sm font-medium",
            isActive ? "text-foreground" : "text-foreground/80"
          )}>
            {label}
          </span>
        </div>
        {badge}
      </div>
      {subtitle && (
        <p className={cn(
          "text-xs mt-1 ml-6",
          isActive ? "text-muted-foreground" : "text-muted-foreground/70"
        )}>
          {subtitle}
        </p>
      )}
    </button>
  )
)
SidebarNavItem.displayName = "SidebarNavItem"

// Divider with optional label
interface SidebarDividerProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string
}

const SidebarDivider = React.forwardRef<HTMLDivElement, SidebarDividerProps>(
  ({ className, label, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("px-3 py-2", className)}
      {...props}
    >
      {label ? (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border/50" />
          <span className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wider whitespace-nowrap">
            {label}
          </span>
          <div className="flex-1 h-px bg-border/50" />
        </div>
      ) : (
        <div className="h-px bg-border/50" />
      )}
    </div>
  )
)
SidebarDivider.displayName = "SidebarDivider"

// Scrollable content area
const SidebarContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex-1 px-3 py-2 space-y-1.5 overflow-y-auto scrollbar-thin", className)}
    {...props}
  />
))
SidebarContent.displayName = "SidebarContent"

// Item card for list items (nodes, hosts, etc.)
interface SidebarItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode
  iconColor?: string
  title: string
  subtitle?: string
  status?: 'online' | 'offline' | 'unknown'
  badge?: React.ReactNode
  tags?: React.ReactNode
  isSelected?: boolean
}

const SidebarItem = React.forwardRef<HTMLButtonElement, SidebarItemProps>(
  ({ className, icon, iconColor, title, subtitle, status, badge, tags, isSelected, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "w-full text-left p-3 rounded-lg border transition-all duration-150",
        "hover:bg-secondary/60 hover:border-border/80",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "min-h-[72px]",
        isSelected
          ? "bg-secondary/70 border-primary/40 shadow-sm"
          : "bg-card/30 border-border/30",
        className
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          {icon && (
            <span className={cn("flex-shrink-0", iconColor)}>
              {icon}
            </span>
          )}
          <span className="text-sm font-medium truncate">{title}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {badge}
          {status && (
            <StatusIndicator status={status} size="md" />
          )}
        </div>
      </div>
      {subtitle && (
        <p className="text-xs text-muted-foreground truncate pl-6">{subtitle}</p>
      )}
      {tags && (
        <div className="flex gap-1 mt-2 pl-6">{tags}</div>
      )}
    </button>
  )
)
SidebarItem.displayName = "SidebarItem"

// Empty state
interface SidebarEmptyProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}

const SidebarEmpty = React.forwardRef<HTMLDivElement, SidebarEmptyProps>(
  ({ className, icon, title, description, action, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("text-center py-8 px-4", className)}
      {...props}
    >
      {icon && (
        <div className="text-muted-foreground/40 mb-3 flex justify-center">
          {icon}
        </div>
      )}
      <p className="text-sm text-muted-foreground">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground/70 mt-1">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
)
SidebarEmpty.displayName = "SidebarEmpty"

export {
  Sidebar,
  SidebarHeader,
  SidebarSearch,
  SidebarNav,
  SidebarNavItem,
  SidebarDivider,
  SidebarContent,
  SidebarItem,
  SidebarEmpty,
}
