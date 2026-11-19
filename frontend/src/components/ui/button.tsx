import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-control border text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--pg-focus))] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--pg-window))] disabled:cursor-not-allowed disabled:opacity-55',
  {
    variants: {
      variant: {
        primary:
          'border-signal-cyan/35 bg-signal-cyan/10 text-signal-cyan hover:border-signal-cyan/60 hover:bg-signal-cyan/15',
        solid:
          'border-signal-cyan bg-signal-cyan font-semibold text-white hover:border-[rgb(var(--pg-primary-hover))] hover:bg-[rgb(var(--pg-primary-hover))] active:bg-[rgb(var(--pg-primary-pressed))]',
        outline:
          'border-ink-600 bg-ink-850 text-text-primary hover:border-signal-cyan/45 hover:bg-signal-cyan/[0.07]',
        ghost:
          'border-transparent bg-transparent text-text-secondary hover:bg-ink-800 hover:text-text-primary',
        danger:
          'border-signal-red/35 bg-signal-red/10 text-signal-red hover:border-signal-red/60 hover:bg-signal-red/15',
      },
      size: {
        sm: 'h-8 px-3 text-[12.5px]',
        md: 'h-9 px-4',
        lg: 'h-11 px-[18px] text-[14px]',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'outline', size: 'md' },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
)

Button.displayName = 'Button'
