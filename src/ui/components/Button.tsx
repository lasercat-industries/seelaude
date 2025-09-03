import React, { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utilities/cn';

const buttonVariants = cva(
  'font-semibold shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 transition-colors',
  {
    variants: {
      variant: {
        primary: 'bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:outline-indigo-600',
        secondary: 'bg-white text-gray-900 ring-1 ring-gray-300 ring-inset hover:bg-gray-50',
      },
      size: {
        xs: 'rounded-sm px-2 py-1 text-xs',
        sm: 'rounded-sm px-2 py-1 text-sm',
        md: 'rounded-md px-2.5 py-1.5 text-sm',
        lg: 'rounded-md px-3 py-2 text-sm',
        xl: 'rounded-md px-3.5 py-2.5 text-sm',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />
    );
  },
);

Button.displayName = 'Button';

export { Button, buttonVariants };
