import { useEffect, useRef, useState } from "react";
import { getSocket } from "@/lib/socket";

export type ActivityTone = "violet" | "orange" | "red" | "green" | "gray";

export interface ActivityEntry {
  id: string;
  tone: ActivityTone;
  timestamp: Date;
  text: string;
  sub?: string;
}

const RING_SIZE = 50;

function mkEntry(tone: ActivityTone, text: string, sub?: string): ActivityEntry {
  return {
    id: crypto.randomUUID(),
    tone,
    timestamp: new Date(),
    text,
    sub,
  };
}

// Seed fallback events shown before real socket events arrive
const SEED_EVENTS: ActivityEntry[] = [
  mkEntry("green", "Agent Nguyễn Văn A đăng nhập", "ext.101"),
  mkEntry("violet", "Cuộc gọi đến từ 0981234567", "inbound/queue"),
  mkEntry("orange", "Agent Trần Thị B chuyển trạng thái: Nghỉ", "status-change"),
  mkEntry("red", "Cuộc gọi nhỡ: 0909123456", "missed/route"),
  mkEntry("green", "Cuộc gọi kết thúc · 3:42 phút", "call-ended"),
  mkEntry("violet", "Lead mới được tạo tự động", "crm/lead"),
];

export function useActivityLog() {
  const [entries, setEntries] = useState<ActivityEntry[]>(SEED_EVENTS);
  const initialized = useRef(false);

  function push(entry: ActivityEntry) {
    setEntries((prev) => {
      const next = [entry, ...prev];
      if (next.length > RING_SIZE) next.length = RING_SIZE;
      return next;
    });
  }

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const socket = getSocket();
    if (!socket) return;

    const onCallRinging = (data: { phone?: string; contactName?: string; direction?: string }) => {
      const label = data.direction === "inbound" ? "Cuộc gọi đến" : "Cuộc gọi ra";
      push(mkEntry("violet", `${label}: ${data.contactName || data.phone || "—"}`, "call/ringing"));
    };

    const onCallAnswered = (data: { phone?: string; contactName?: string }) => {
      push(mkEntry("green", `Cuộc gọi được nghe: ${data.contactName || data.phone || "—"}`, "call/answered"));
    };

    const onCallEnded = () => {
      push(mkEntry("gray", "Cuộc gọi kết thúc", "call/ended"));
    };

    const onAgentStatus = (data: { userId?: string; status?: string; fullName?: string }) => {
      const tone: ActivityTone = data.status === "offline" ? "red" : data.status === "on_call" ? "violet" : "orange";
      push(mkEntry(tone, `Agent ${data.fullName || data.userId}: ${data.status || "—"}`, "status-change"));
    };

    const onNotification = (data: { title?: string; message?: string }) => {
      push(mkEntry("green", data.title || "Thông báo mới", data.message));
    };

    socket.on("call:ringing", onCallRinging);
    socket.on("call:answered", onCallAnswered);
    socket.on("call:ended", onCallEnded);
    socket.on("agent:status_changed", onAgentStatus);
    socket.on("notification:new", onNotification);

    return () => {
      socket.off("call:ringing", onCallRinging);
      socket.off("call:answered", onCallAnswered);
      socket.off("call:ended", onCallEnded);
      socket.off("agent:status_changed", onAgentStatus);
      socket.off("notification:new", onNotification);
    };
  }, []);

  return entries;
}
