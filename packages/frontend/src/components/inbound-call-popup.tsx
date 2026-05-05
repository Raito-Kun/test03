import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, X, UserPlus, Users, RefreshCw, Copy, FolderSync } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useInboundCallStore } from '@/stores/inbound-call-store';
import { useCallStore } from '@/stores/call-store';

const ACTION_ITEMS = [
  { icon: UserPlus, label: 'Thêm khách hàng' },
  { icon: Users, label: 'Phân bổ công việc chuyên viên trong hàng đợi' },
  { icon: RefreshCw, label: 'Tự động phân bổ lại chuyên viên' },
  { icon: Copy, label: 'Sao chép liên hệ từ chiến dịch khác' },
  { icon: FolderSync, label: 'Cập nhật nhóm khách hàng' },
];

function InboundCallCard({
  callerName,
  phone,
  onAnswer,
  onEnd,
}: {
  callerName: string;
  phone: string;
  onAnswer: () => void;
  onEnd: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 40 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="fixed bottom-4 right-4 z-50 w-72"
    >
      <Card className="shadow-xl border-border">
        <CardHeader className="pb-2 pt-3 px-4 flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Phone className="h-4 w-4 animate-pulse text-green-600" />
            Cuộc gọi đến
          </div>
          <button
            onClick={onEnd}
            className="rounded p-0.5 text-muted-foreground hover:text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </CardHeader>

        <CardContent className="px-4 pb-4 space-y-3">
          {/* Caller info */}
          <div>
            <p className="font-semibold text-foreground">{callerName}</p>
            <p className="text-sm text-muted-foreground">Mobile: {phone}</p>
          </div>

          {/* Answer / End buttons */}
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              onClick={onAnswer}
            >
              <Phone className="mr-1.5 h-3.5 w-3.5" />
              Trả lời
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
              onClick={onEnd}
            >
              <PhoneOff className="mr-1.5 h-3.5 w-3.5" />
              Kết thúc
            </Button>
          </div>

          {/* Action menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="w-full text-xs text-muted-foreground">
                Thao tác khác
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              {ACTION_ITEMS.map(({ icon: Icon, label }) => (
                <DropdownMenuItem key={label} className="text-xs gap-2">
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function InboundCallPopup() {
  const { call, showPopup, answerCall, endCall } = useInboundCallStore();

  // Backward-compat: also show for WebSocket-triggered inbound calls from call-store
  const legacyPopup = useCallStore((s) => s.inboundPopup);
  const dismissLegacy = useCallStore((s) => s.dismissInboundPopup);

  return (
    <AnimatePresence>
      {showPopup && call && (
        <InboundCallCard
          key="inbound-new"
          callerName={call.callerName}
          phone={call.phone}
          onAnswer={answerCall}
          onEnd={endCall}
        />
      )}
      {!showPopup && legacyPopup && (
        <InboundCallCard
          key="inbound-legacy"
          callerName={legacyPopup.contactName}
          phone={legacyPopup.phone}
          onAnswer={dismissLegacy}
          onEnd={dismissLegacy}
        />
      )}
    </AnimatePresence>
  );
}
