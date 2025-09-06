import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * A utility function that combines the `clsx` and `twMerge` libraries to create a
 * class name string.
 */
export const cn = (...inputs: (string | string[] | undefined)[]) => {
  return twMerge(clsx(...inputs));
};
