"use client"

import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"
import { Check, ChevronDown, ChevronUp } from "lucide-react"

import { cn } from "./utils"

interface SelectContextValue {
  value?: string
  onValueChange?: (value: string) => void
  open: boolean
  setOpen: (open: boolean) => void
  registerItem: (value: string, label: React.ReactNode) => void
  unregisterItem: (value: string) => void
  itemLabels: Map<string, React.ReactNode>
  disabled?: boolean
}

const SelectContext = React.createContext<SelectContextValue | null>(null)

function useSelectContext() {
  const context = React.useContext(SelectContext)
  if (!context) {
    throw new Error("Select components must be used within a Select provider")
  }
  return context
}

function extractLabels(children: React.ReactNode, map: Map<string, React.ReactNode> = new Map()): Map<string, React.ReactNode> {
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return
    const props = child.props as Record<string, any> | undefined
    if (props && props.value !== undefined) {
      map.set(String(props.value), props.children)
    }
    if (props && props.children) {
      extractLabels(props.children, map)
    }
  })
  return map
}

export interface SelectProps<T extends string = string> {
  value?: T
  defaultValue?: T
  onValueChange?: (value: T) => void
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  disabled?: boolean
  name?: string
  required?: boolean
  children?: React.ReactNode
  modal?: boolean
}

function Select<T extends string = string>({
  value: controlledValue,
  defaultValue,
  onValueChange,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  disabled = false,
  children,
  modal = false,
}: SelectProps<T>) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState<string | undefined>(defaultValue)
  const isControlledValue = controlledValue !== undefined
  const currentValue = isControlledValue ? controlledValue : uncontrolledValue

  const [uncontrolledOpen, setUncontrolledOpen] = React.useState<boolean>(defaultOpen)
  const isControlledOpen = controlledOpen !== undefined
  const isOpen = isControlledOpen ? controlledOpen : uncontrolledOpen

  const [itemLabels, setItemLabels] = React.useState<Map<string, React.ReactNode>>(() => new Map())
  const itemLabelsRef = React.useRef<Map<string, React.ReactNode>>(new Map())

  const extractedMap = React.useMemo(() => {
    return extractLabels(children)
  }, [children])

  const mergedItemLabels = React.useMemo(() => {
    const combined = new Map(extractedMap)
    itemLabels.forEach((v, k) => combined.set(k, v))
    return combined
  }, [extractedMap, itemLabels])

  const registerItem = React.useCallback((val: string, label: React.ReactNode) => {
    if (extractedMap.has(val)) return
    if (itemLabelsRef.current.get(val) === label) return
    itemLabelsRef.current.set(val, label)
    setItemLabels((prev) => {
      const next = new Map(prev)
      next.set(val, label)
      return next
    })
  }, [extractedMap])

  const unregisterItem = React.useCallback((val: string) => {
    if (!itemLabelsRef.current.has(val)) return
    itemLabelsRef.current.delete(val)
    setItemLabels((prev) => {
      if (!prev.has(val)) return prev
      const next = new Map(prev)
      next.delete(val)
      return next
    })
  }, [])

  const handleOpenChange = React.useCallback(
    (newOpen: boolean) => {
      if (!isControlledOpen) {
        setUncontrolledOpen(newOpen)
      }
      onOpenChange?.(newOpen)
    },
    [isControlledOpen, onOpenChange]
  )

  const handleValueChange = React.useCallback(
    (newVal: string) => {
      if (!isControlledValue) {
        setUncontrolledValue(newVal)
      }
      onValueChange?.(newVal as T)
    },
    [isControlledValue, onValueChange]
  )

  const contextValue = React.useMemo<SelectContextValue>(
    () => ({
      value: currentValue,
      onValueChange: handleValueChange,
      open: isOpen,
      setOpen: handleOpenChange,
      registerItem,
      unregisterItem,
      itemLabels: mergedItemLabels,
      disabled,
    }),
    [currentValue, handleValueChange, isOpen, handleOpenChange, registerItem, unregisterItem, mergedItemLabels, disabled]
  )

  return (
    <SelectContext.Provider value={contextValue}>
      <PopoverPrimitive.Root open={isOpen} onOpenChange={handleOpenChange} modal={modal}>
        {children}
      </PopoverPrimitive.Root>
    </SelectContext.Provider>
  )
}

const SelectGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} role="group" className={cn("p-1", className)} {...props} />
)
SelectGroup.displayName = "SelectGroup"

export interface SelectValueProps extends React.HTMLAttributes<HTMLSpanElement> {
  placeholder?: string
}

const SelectValue = React.forwardRef<HTMLSpanElement, SelectValueProps>(
  ({ className, placeholder, children, ...props }, ref) => {
    const { value, itemLabels } = useSelectContext()
    const display = children ?? (value !== undefined ? (itemLabels.get(value) ?? value) : placeholder)

    return (
      <span
        ref={ref}
        className={cn(
          "block truncate",
          value === undefined && placeholder && "text-muted-foreground",
          className
        )}
        {...props}
      >
        {display}
      </span>
    )
  }
)
SelectValue.displayName = "SelectValue"

const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => {
  const { disabled } = useSelectContext()

  return (
    <PopoverPrimitive.Trigger asChild disabled={disabled}>
      <button
        ref={ref}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        data-radix-select-trigger=""
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-white dark:bg-card px-3 py-2 text-xs text-foreground ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/30 focus:border-primary/60 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
          className
        )}
        {...props}
      >
        {children}
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
      </button>
    </PopoverPrimitive.Trigger>
  )
})
SelectTrigger.displayName = "SelectTrigger"

const SelectScrollUpButton = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1", className)}
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </div>
))
SelectScrollUpButton.displayName = "SelectScrollUpButton"

const SelectScrollDownButton = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1", className)}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </div>
))
SelectScrollDownButton.displayName = "SelectScrollDownButton"

const SelectContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content> & {
    position?: "item-aligned" | "popper"
  }
>(({ className, children, position = "popper", side = "bottom", align = "start", sideOffset = 4, avoidCollisions = true, collisionPadding = 12, onOpenAutoFocus, onCloseAutoFocus, ...props }, ref) => {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={ref}
        side={side}
        align={align}
        sideOffset={sideOffset}
        avoidCollisions={avoidCollisions}
        collisionPadding={collisionPadding}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          onOpenAutoFocus?.(e);
        }}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          onCloseAutoFocus?.(e);
        }}
        className={cn(
          "relative z-[100] max-h-[min(18rem,var(--radix-popover-content-available-height,18rem))] min-w-[8rem] overflow-y-auto rounded-xl border bg-popover text-popover-foreground shadow-lg outline-none pointer-events-auto data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 p-1",
          position === "popper" && "w-[var(--radix-popover-trigger-width)] min-w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)]",
          className
        )}
        {...props}
      >
        {children}
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  )
})
SelectContent.displayName = "SelectContent"

const SelectLabel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("py-1.5 pl-8 pr-2 text-xs font-semibold text-muted-foreground", className)}
    {...props}
  />
))
SelectLabel.displayName = "SelectLabel"

export interface SelectItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
  disabled?: boolean
}

const SelectItem = React.forwardRef<HTMLButtonElement, SelectItemProps>(
  ({ className, children, value, disabled = false, onClick, ...props }, ref) => {
    const { value: selectedValue, onValueChange, setOpen, registerItem, unregisterItem } =
      useSelectContext()
    const isSelected = selectedValue === value

    const labelKey = typeof children === "string" || typeof children === "number" ? String(children) : null

    React.useEffect(() => {
      registerItem(value, children)
      return () => {
        unregisterItem(value)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, labelKey, registerItem, unregisterItem])

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation()
      onClick?.(e)
      if (!disabled) {
        onValueChange?.(value)
        setOpen(false)
      }
    }

    return (
      <button
        ref={ref}
        type="button"
        role="option"
        aria-selected={isSelected}
        disabled={disabled}
        onClick={handleClick}
        className={cn(
          "relative flex w-full cursor-default select-none items-center rounded-lg py-2 pl-8 pr-3 text-xs outline-none transition-colors disabled:pointer-events-none disabled:opacity-50 text-left font-medium",
          className,
          isSelected
            ? "!bg-sidebar !text-white font-semibold hover:!bg-sidebar hover:!text-white focus:!bg-sidebar focus:!text-white shadow-xs"
            : "text-foreground hover:bg-slate-100 hover:text-foreground focus:bg-slate-100 focus:text-foreground dark:hover:bg-slate-800 dark:hover:text-slate-100 dark:focus:bg-slate-800 dark:focus:text-slate-100"
        )}
        {...props}
      >
        <span className="absolute left-2.5 flex h-3.5 w-3.5 items-center justify-center">
          {isSelected && <Check className="h-4 w-4 text-white stroke-[2.5]" />}
        </span>
        <span className={cn("truncate", isSelected && "!text-white font-semibold")}>{children}</span>
      </button>
    )
  }
)
SelectItem.displayName = "SelectItem"

const SelectSeparator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
))
SelectSeparator.displayName = "SelectSeparator"

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
}
