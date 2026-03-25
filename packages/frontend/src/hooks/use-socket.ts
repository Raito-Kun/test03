import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/auth-store';
import { useCallStore } from '@/stores/call-store';
import { useAgentStatusStore } from '@/stores/agent-status-store';
import { toast } from 'sonner';

/** Connect Socket.IO on login, handle real-time events */
export function useSocket() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setActiveCall = useCallStore((s) => s.setActiveCall);
  const endCall = useCallStore((s) => s.endCall);
  const showInboundPopup = useCallStore((s) => s.showInboundPopup);
  const updateAgent = useAgentStatusStore((s) => s.updateAgent);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated) {
      disconnectSocket();
      return;
    }

    const socket = connectSocket();

    // Call events
    socket.on('call:ringing', (data) => {
      if (data.direction === 'inbound') {
        showInboundPopup({
          callId: data.callId,
          contactName: data.contactName || data.phone,
          phone: data.phone,
        });
      }
      setActiveCall({
        id: data.callId,
        contactName: data.contactName || data.phone,
        phone: data.phone,
        direction: data.direction,
        state: 'ringing',
        startedAt: Date.now(),
        campaignScript: data.campaignScript,
      });
    });

    socket.on('call:answered', (data) => {
      setActiveCall({
        id: data.callId,
        contactName: data.contactName || data.phone,
        phone: data.phone,
        direction: data.direction,
        state: 'answered',
        startedAt: Date.now(),
        campaignScript: data.campaignScript,
      });
    });

    socket.on('call:ended', () => {
      endCall();
    });

    // Agent status events
    socket.on('agent:status_changed', (data) => {
      updateAgent(data.userId, data.status);
    });

    // Notification events
    socket.on('notification:new', (data) => {
      toast(data.title, { description: data.message });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    });

    return () => {
      disconnectSocket();
    };
  }, [isAuthenticated]);
}
