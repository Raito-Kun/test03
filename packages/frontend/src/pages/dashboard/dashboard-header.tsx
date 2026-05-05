import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Download, Plus, ChevronDown, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSocket } from "@/lib/socket";
import { useAuthStore } from "@/stores/auth-store";

// Generates a cosmetic session code on mount, e.g. "6FC4·E33C"
function makeSessionCode(): string {
  const a = Math.random().toString(16).slice(2, 6).toUpperCase();
  const b = Math.random().toString(16).slice(2, 6).toUpperCase();
  return `${a}·${b}`;
}

function useSessionClock() {
  const [elapsed, setElapsed] = useState(0);
  const start = useRef(Date.now());
  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  return `T+${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

interface DashboardHeaderProps {
  sessionDate: string; // e.g. "20/04/2026"
}

export function DashboardHeader({ sessionDate }: DashboardHeaderProps) {
  const qc = useQueryClient();
  const [sessionCode] = useState(makeSessionCode);
  const [live, setLive] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const clock = useSessionClock();
  const user = useAuthStore((s) => s.user);

  // sipExtension from authenticated user; branch is not in User model so we use a static label
  const ext = user?.sipExtension ?? "---";

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onConnect = () => setLive(true);
    const onDisconnect = () => setLive(false);
    setLive(socket.connected);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  function handleRefresh() {
    qc.invalidateQueries({ queryKey: ["dashboard-overview"] });
    qc.invalidateQueries({ queryKey: ["dashboard-agents"] });
  }

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      {/* Left: branding + meta chips */}
      <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
        {/* Brand */}
        <span className="font-mono text-sm font-bold text-primary tracking-wide">
          Call CRM
        </span>

        <span className="text-border select-none">|</span>

        {/* Session code — subtle mono hint */}
        <span className="font-mono text-[10px] tracking-widest text-muted-foreground/60 hidden md:inline select-none">
          § {sessionCode}
        </span>

        {/* Ext chip — from authenticated user's sipExtension */}
        {ext !== "---" && (
          <span className="inline-flex items-center gap-1 font-mono text-[11px] border border-border rounded-full px-2.5 py-0.5 text-muted-foreground bg-muted/50">
            Ext: {ext}
          </span>
        )}

        {/* ACTIVE CLUSTER pulse pill */}
        <span
          className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider rounded-full px-2.5 py-0.5 border ${
            live
              ? "bg-emerald-50 text-emerald-700 border-emerald-300"
              : "bg-rose-50 text-rose-600 border-rose-300"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              live ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
            }`}
          />
          {live ? "ACTIVE CLUSTER" : "OFFLINE"}
        </span>

        {/* Clock — hidden on small screens */}
        <span className="font-mono text-[10px] text-muted-foreground hidden lg:inline">
          {sessionDate} · {clock}
        </span>
      </div>

      {/* Right: bell + actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Bell notifications */}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          aria-label="Thông báo"
        >
          <Bell className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="font-mono text-[10px] uppercase tracking-wider h-7 px-2"
          onClick={handleRefresh}
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          REFRESH
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="font-mono text-[10px] uppercase tracking-wider h-7 px-2"
          onClick={() => window.open("/reports", "_blank")}
        >
          <Download className="h-3 w-3 mr-1" />
          EXPORT
        </Button>

        <div className="relative">
          <Button
            size="sm"
            className="font-mono text-[10px] uppercase tracking-wider h-7 px-2 bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={() => setAddOpen((v) => !v)}
          >
            <Plus className="h-3 w-3 mr-1" />
            THÊM
            <ChevronDown className="h-3 w-3 ml-1" />
          </Button>
          {addOpen && (
            <div className="absolute right-0 top-8 z-50 bg-popover border border-border rounded-sm shadow-md min-w-[140px]">
              {[
                { label: "Liên hệ", href: "/contacts" },
                { label: "Lead", href: "/leads" },
                { label: "Phiếu ghi", href: "/tickets" },
              ].map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="block px-3 py-2 font-mono text-[11px] hover:bg-accent transition-colors"
                  onClick={() => setAddOpen(false)}
                >
                  {item.label}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
