"use client";

import { useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

export interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function MobileDrawer({ open, onClose, children }: MobileDrawerProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleKeyDown]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="md:hidden" aria-label="Mobile navigation">
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-ink/40 transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-60 transform transition-transform duration-200 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {children}
      </div>
    </div>
  );
}
