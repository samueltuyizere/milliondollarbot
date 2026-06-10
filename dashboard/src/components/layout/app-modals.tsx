"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BotControlPanel } from "@/components/bot/bot-control-panel";
import { ConfigPanel } from "@/components/config/config-panel";
import { useModals } from "@/context/modal-context";

export function AppModals() {
  const { modal, closeModal } = useModals();

  return (
    <>
      <Dialog open={modal === "bot"} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent
          className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0 bg-card"
          showCloseButton
        >
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
            <DialogTitle>Bot Control</DialogTitle>
            <DialogDescription>Start, stop, pause and monitor live status.</DialogDescription>
          </DialogHeader>
          <div className="px-5 py-4">
            <BotControlPanel active={modal === "bot"} />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={modal === "config"} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent
          className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0 bg-card"
          showCloseButton
        >
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
            <DialogTitle>Configuration</DialogTitle>
            <DialogDescription>Risk rules, strategy parameters and session settings.</DialogDescription>
          </DialogHeader>
          <div className="px-5 py-4">
            <ConfigPanel />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
