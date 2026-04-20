import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { StatusBar, type StatusCell } from '@/components/ops/status-bar';
import { useAuthStore } from '@/stores/auth-store';
import { useRegistrationStatus } from '@/components/extension-status-indicator';
import { getSocket } from '@/lib/socket';
import { getPageLabel } from '@/lib/route-labels';

const VERSION = import.meta.env.VITE_APP_VERSION ?? '1.0.0';
const BUILD_ID = import.meta.env.VITE_BUILD_ID ?? 'dev';

function useMockMetrics() {
  const [cpu, setCpu] = useState(17);
  const [lat, setLat] = useState(21);
  const [queue, setQueue] = useState(4);
  const [rx, setRx] = useState(176);
  const [tx, setTx] = useState(95);

  useEffect(() => {
    const id = setInterval(() => {
      setCpu((v) => Math.max(5, Math.min(95, v + (Math.random() - 0.5) * 6)));
      setLat((v) => Math.max(5, Math.min(250, v + (Math.random() - 0.5) * 8)));
      setQueue((v) => Math.max(0, Math.min(20, v + Math.round((Math.random() - 0.5) * 2))));
      setRx((v) => Math.max(10, Math.min(999, v + (Math.random() - 0.5) * 20)));
      setTx((v) => Math.max(5, Math.min(500, v + (Math.random() - 0.5) * 10)));
    }, 4000);
    return () => clearInterval(id);
  }, []);

  return { cpu, lat, queue, rx, tx };
}

function useSocketConnected() {
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const check = () => {
      const s = getSocket();
      setConnected(s?.connected ?? false);
    };
    check();
    const id = setInterval(check, 3000);
    return () => clearInterval(id);
  }, []);
  return connected;
}

function useLocalTime() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const fmt = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
    };
    fmt();
    const id = setInterval(fmt, 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

export function OpsStatusBar() {
  const { pathname } = useLocation();
  const user = useAuthStore((s) => s.user);
  const { data: regStatus } = useRegistrationStatus();
  const connected = useSocketConnected();
  const { cpu, lat, queue, rx, tx } = useMockMetrics();
  const localTime = useLocalTime();

  const ext = user?.sipExtension;
  const pbxValue = ext
    ? `eyebeam://${ext} ${regStatus?.registered ? '✓' : '✗'}`
    : '—';

  const cells: StatusCell[] = [
    { label: 'SYS', value: connected ? 'ONLINE' : 'OFFLINE', tone: connected ? 'ok' : 'err' },
    { label: 'CPU', value: `${Math.round(cpu)}%`, tone: cpu > 80 ? 'warn' : 'neutral' },
    { label: 'LAT', value: `${Math.round(lat)}ms`, tone: lat > 150 ? 'warn' : 'neutral' },
    { label: 'QUEUE', value: String(queue).padStart(2, '0'), tone: queue > 10 ? 'warn' : 'neutral' },
    { label: 'RX/TX', value: `${Math.round(rx)}↓ ${Math.round(tx)}↑ kb/s`, tone: 'neutral' },
    { label: 'PBX', value: pbxValue, tone: regStatus?.registered ? 'ok' : ext ? 'warn' : 'neutral' },
    { label: 'PAGE', value: getPageLabel(pathname).toUpperCase(), tone: 'neutral' },
    { label: 'BUILD', value: `${VERSION}-ops`, tone: 'neutral' },
    { label: '#', value: BUILD_ID.slice(0, 7), tone: 'neutral' },
    { label: 'TZ', value: 'ICT+07', tone: 'neutral' },
    { label: 'UTC', value: localTime, tone: 'neutral' },
  ];

  return <StatusBar cells={cells} />;
}
