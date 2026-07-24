// apps/web/src/components/Modal.tsx
"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  children: ReactNode;
}

export function Modal({ open, onClose, title, eyebrow, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-0 backdrop-blur-md sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            className="glass-panel relative max-h-[92vh] w-full overflow-y-auto rounded-t-[28px] border-white/10 p-5 sm:max-w-xl sm:rounded-[28px] sm:p-7"
            initial={{ opacity: 0, y: 28, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                {eyebrow ? <p className="data-label mb-2">{eyebrow}</p> : null}
                <h2
                  id="modal-title"
                  className="font-display text-2xl font-semibold text-white"
                >
                  {title}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="soft-button size-10 shrink-0 p-0"
                aria-label="Close dialog"
              >
                <X className="size-4" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
