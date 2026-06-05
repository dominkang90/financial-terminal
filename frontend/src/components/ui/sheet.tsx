import * as Dialog from "@radix-ui/react-dialog";
import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Sheet = Dialog.Root;
export const SheetTrigger = Dialog.Trigger;
export const SheetClose = Dialog.Close;
export const SheetPortal = Dialog.Portal;

export const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof Dialog.Overlay>,
  React.ComponentPropsWithoutRef<typeof Dialog.Overlay>
>(({ className, ...props }, ref) => (
  <Dialog.Overlay ref={ref} className={cn("fixed inset-0 z-50 bg-black/70 backdrop-blur-sm", className)} {...props} />
));
SheetOverlay.displayName = Dialog.Overlay.displayName;

export const SheetContent = React.forwardRef<
  React.ElementRef<typeof Dialog.Content>,
  React.ComponentPropsWithoutRef<typeof Dialog.Content> & { side?: "bottom" | "right" }
>(({ className, children, side = "right", ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <Dialog.Content
      ref={ref}
      className={cn(
        "fixed z-50 border border-white/10 bg-[#0c1324] text-white shadow-2xl outline-none",
        side === "bottom"
          ? "inset-x-0 bottom-0 max-h-[88vh] rounded-t-[28px] border-b-0"
          : "right-0 top-0 h-full w-full max-w-2xl border-l",
        className,
      )}
      {...props}
    >
      {children}
      <Dialog.Close className="absolute right-4 top-4 rounded-full border border-white/10 bg-white/5 p-2 text-white/65 transition hover:text-white">
        <X size={16} />
      </Dialog.Close>
    </Dialog.Content>
  </SheetPortal>
));
SheetContent.displayName = Dialog.Content.displayName;

export const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col gap-1 p-5 pb-0", className)} {...props} />
);

export const SheetTitle = React.forwardRef<
  React.ElementRef<typeof Dialog.Title>,
  React.ComponentPropsWithoutRef<typeof Dialog.Title>
>(({ className, ...props }, ref) => <Dialog.Title ref={ref} className={cn("text-base font-semibold", className)} {...props} />);
SheetTitle.displayName = Dialog.Title.displayName;

export const SheetDescription = React.forwardRef<
  React.ElementRef<typeof Dialog.Description>,
  React.ComponentPropsWithoutRef<typeof Dialog.Description>
>(({ className, ...props }, ref) => <Dialog.Description ref={ref} className={cn("text-sm text-white/55", className)} {...props} />);
SheetDescription.displayName = Dialog.Description.displayName;
