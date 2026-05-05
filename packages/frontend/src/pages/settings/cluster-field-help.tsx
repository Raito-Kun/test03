import { HelpCircle } from 'lucide-react';
import {
  Popover, PopoverContent, PopoverTrigger, PopoverHeader, PopoverTitle,
} from '@/components/ui/popover';

/** Help content definition */
interface HelpEntry {
  title: string;
  description: string;
  steps?: string[];
  code?: string;
  examples?: string;
  defaultValue?: string;
}

/** All field help texts */
const FIELD_HELP: Record<string, HelpEntry> = {
  eslHost: {
    title: 'IP tổng đài (ESL Host)',
    description: 'Địa chỉ IP của máy chủ FusionPBX/FreeSWITCH',
    steps: [
      'SSH vào FusionPBX → chạy: hostname -I',
      'Hoặc vào FusionPBX GUI → System → Network Settings',
    ],
    examples: '10.10.101.189, 192.168.1.100',
  },
  eslPort: {
    title: 'ESL Port',
    description: 'Cổng Event Socket Library, mặc định là 8021',
    steps: [
      'SSH FusionPBX → xem file cấu hình:',
    ],
    code: 'cat /etc/freeswitch/autoload_configs/event_socket.conf.xml',
    defaultValue: '8021',
  },
  eslPassword: {
    title: 'ESL Password',
    description: 'Mật khẩu kết nối ESL (Event Socket)',
    steps: [
      'SSH FusionPBX → xem file cấu hình:',
    ],
    code: 'cat /etc/freeswitch/autoload_configs/event_socket.conf.xml',
    defaultValue: 'ClueCon (mặc định FusionPBX)',
  },
  pbxIp: {
    title: 'PBX IP',
    description: 'IP thực của máy chủ PBX (dùng cho routing nội bộ)',
    steps: [
      'Thường giống ESL Host, trừ khi dùng NAT/proxy',
    ],
    examples: '10.10.101.189',
  },
  sipDomain: {
    title: 'SIP Domain',
    description: 'Tên domain SIP trong FusionPBX',
    steps: [
      'Vào FusionPBX GUI → Accounts → Domains',
      'Copy tên domain',
    ],
    examples: 'crm, bayer-cct, sip.example.com',
  },
  sipWssUrl: {
    title: 'SIP WebSocket URL',
    description: 'URL WebSocket để kết nối SIP qua trình duyệt (WebRTC)',
    steps: [
      'Vào FusionPBX GUI → Advanced → SIP Profiles → internal',
      'Xem ws-binding và wss-binding',
    ],
    examples: 'wss://10.10.101.189:7443',
    defaultValue: 'Để trống nếu không dùng WebRTC',
  },
  gatewayName: {
    title: 'Gateway/Trunk name',
    description: 'Tên gateway/trunk để gọi ra ngoài (PSTN)',
    steps: [
      'SSH FusionPBX → chạy:',
    ],
    code: "fs_cli -x 'sofia status gateway'",
    examples: '368938db-bc9d-48ba-b9d3-e18bc3000623',
  },
  recordingPath: {
    title: 'Đường dẫn ghi âm',
    description: 'Đường dẫn thư mục ghi âm trên máy FusionPBX',
    steps: [
      'Kiểm tra:',
    ],
    code: 'ls /var/lib/freeswitch/recordings/',
    defaultValue: '/var/lib/freeswitch/recordings/',
  },
  cdrReportUrl: {
    title: 'CDR Report URL',
    description: 'URL webhook nhận CDR từ FusionPBX sau mỗi cuộc gọi',
    steps: [
      'Cấu hình trong FusionPBX: Advanced → XML CDR → URL',
    ],
    defaultValue: 'http://[CRM_IP]/api/v1/webhooks/cdr',
  },
};

/** Small "?" icon button with help popover */
export function FieldHelp({ field }: { field: string }) {
  const help = FIELD_HELP[field];
  if (!help) return null;

  return (
    <Popover>
      <PopoverTrigger
        className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
        aria-label={`Hướng dẫn: ${help.title}`}
      >
        <HelpCircle className="h-3 w-3" />
      </PopoverTrigger>
      <PopoverContent side="right" sideOffset={8} className="w-80 p-0">
        <PopoverHeader className="px-4 pt-3 pb-2 border-b border-dashed border-border bg-muted/30">
          <PopoverTitle className="text-sm font-semibold">{help.title}</PopoverTitle>
        </PopoverHeader>
        <div className="px-4 py-3 space-y-2.5 text-xs">
          <p className="text-muted-foreground">{help.description}</p>

          {help.steps && help.steps.length > 0 && (
            <div className="space-y-1">
              <p className="font-medium text-foreground">Cách lấy:</p>
              <ul className="list-disc pl-4 text-muted-foreground space-y-0.5">
                {help.steps.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}

          {help.code && (
            <pre className="bg-muted rounded px-2.5 py-1.5 font-mono text-[11px] text-foreground overflow-x-auto">
              {help.code}
            </pre>
          )}

          {help.defaultValue && (
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Mặc định:</span> {help.defaultValue}
            </p>
          )}

          {help.examples && (
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Ví dụ:</span>{' '}
              <code className="bg-muted rounded px-1 py-0.5 font-mono text-[11px]">{help.examples}</code>
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
