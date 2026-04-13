"use client";

import { ReactNode } from "react";

interface SidebarProps {
  side: "left" | "right";
  show: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export function Sidebar({ side, show, children }: SidebarProps) {
  if (!show) return null;

  return (
    <aside
      className={`${
        side === "left" ? "sidebar-left pw-border-r" : "sidebar-right pw-border-l"
      } flex flex-col h-full`}
    >
      {children}
    </aside>
  );
}
