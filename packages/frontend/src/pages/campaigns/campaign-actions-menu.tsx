import { MoreVertical, UserPlus, Users, RefreshCw, Copy, FolderSync } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const ACTIONS = [
  { label: 'Thêm khách hàng', icon: UserPlus },
  { label: 'Phân bổ công việc chuyên viên trong hàng đợi', icon: Users },
  { label: 'Tự động phân bổ lại chuyên viên', icon: RefreshCw },
  { label: 'Sao chép liên hệ từ chiến dịch khác', icon: Copy },
  { label: 'Cập nhật nhóm khách hàng', icon: FolderSync },
] as const;

export function CampaignActionsMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <MoreVertical className="h-4 w-4 mr-1" /> Thao tác
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {ACTIONS.map(({ label, icon: Icon }) => (
          <DropdownMenuItem
            key={label}
            onClick={() => toast.info(`Chức năng "${label}" đang phát triển`)}
            className="gap-2"
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
