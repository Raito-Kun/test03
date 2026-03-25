import { useCallStore } from '@/stores/call-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Phone, PhoneOff } from 'lucide-react';

export function InboundCallPopup() {
  const popup = useCallStore((s) => s.inboundPopup);
  const dismiss = useCallStore((s) => s.dismissInboundPopup);

  if (!popup) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
      <Card className="w-80 animate-in zoom-in-95">
        <CardContent className="pt-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <Phone className="h-8 w-8 animate-pulse text-green-600" />
          </div>
          <p className="text-lg font-semibold">Cuộc gọi đến</p>
          <p className="text-sm font-medium">{popup.contactName}</p>
          <p className="mb-4 text-sm text-muted-foreground">{popup.phone}</p>
          <div className="flex justify-center gap-3">
            <Button variant="destructive" size="sm" onClick={dismiss}>
              <PhoneOff className="mr-1 h-4 w-4" /> Từ chối
            </Button>
            <Button variant="default" size="sm" className="bg-green-600 hover:bg-green-700" onClick={dismiss}>
              <Phone className="mr-1 h-4 w-4" /> Nghe
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
