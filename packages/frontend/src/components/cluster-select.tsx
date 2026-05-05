import { Server } from 'lucide-react';

interface ClusterOption {
  id: string;
  name: string;
  isActive: boolean;
}

interface Props {
  clusters: ClusterOption[];
  value: string;
  onChange: (id: string) => void;
}

export function ClusterSelect({ clusters, value, onChange }: Props) {
  return (
    <div className="flex items-center gap-2">
      <Server className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Cụm PBX:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border rounded-md px-3 py-1.5 text-sm bg-background min-w-[200px]"
      >
        {clusters.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}{c.isActive ? ' ● Active' : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
