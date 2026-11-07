import { type ComponentPropsWithoutRef, forwardRef } from "react";

import { cn } from "cn";

/**
 * A lightweight scroll container that uses the browser's native scrollbar
 * with `scrollbar-width: thin` styling (via the `.custom-scrollbar` class).
 *
 * `className` / `children` / spread-props API.
 */
const NativeScrollArea = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<"div">
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="native-scroll-area"
    className={cn("overflow-auto custom-scrollbar", className)}
    {...props}
  >
    {children}
  </div>
));

NativeScrollArea.displayName = "NativeScrollArea";

export { NativeScrollArea };
