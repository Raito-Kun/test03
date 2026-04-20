import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Download, Plus, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSocket } from "@/lib/socket";

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
      {/* Left: session code + title + clock */}
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-mono text-[11px] tracking-widest text-muted-foreground select-none">
          § DASH · {sessionCode}
        </span>
        <span className="font-mono text-[11px] text-muted-foreground">|</span>
        <h1 className="font-mono text-sm font-semibold uppercase tracking-wider text-foreground">
          Tổng quan
        </h1>
        <span className="font-mono text-[11px] text-muted-foreground hidden sm:inline">
          Phiên làm việc {sessionDate} · {clock}
        </span>
      </div>

      {/* Right: LIVE + actions */}
      <div className="flex items-center gap-2 shrink-0">
        {/* LIVE indicator */}
        <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider">
          <span
            className={`w-1.5 h-1.5 rounded-full ${live ? "bg-green-500 animate-pulse" : "bg-rose-500"}`}
          />
          <span className={live ? "text-green-600" : "text-rose-500"}>
            {live ? "LIVE" : "OFFLINE"}
          </span>
        </div>

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
            className="font-mono text-[10px] uppercase tracking-wider h-7 px-2 bg-violet-600 hover:bg-violet-700 text-white"
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
