import { useState, KeyboardEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import api from '@/services/api-client';

interface TagsEditorProps {
  entityId: string;
  entityType: 'contact' | 'lead' | 'debt-case';
  initialTags?: string[];
}

const BADGE_COLORS = [
  'bg-blue-100 text-blue-800',
  'bg-green-100 text-green-800',
  'bg-purple-100 text-purple-800',
  'bg-orange-100 text-orange-800',
  'bg-pink-100 text-pink-800',
  'bg-teal-100 text-teal-800',
];

function getBadgeColor(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  return BADGE_COLORS[Math.abs(hash) % BADGE_COLORS.length];
}

export function TagsEditor({ entityId, entityType, initialTags = [] }: TagsEditorProps) {
  const [tags, setTags] = useState<string[]>(initialTags);
  const [inputValue, setInputValue] = useState('');
  const queryClient = useQueryClient();

  const entityPath = entityType === 'debt-case' ? 'debt-cases' : `${entityType}s`;

  const mutation = useMutation({
    mutationFn: async (newTags: string[]) => {
      await api.patch(`/${entityPath}/${entityId}`, { tags: newTags });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [entityPath, entityId] });
    },
    onError: (err: Error) => {
      toast.error(`Lỗi lưu thẻ: ${err.message}`);
    },
  });

  function addTag(value: string) {
    const tag = value.trim();
    if (!tag || tags.includes(tag)) return;
    const newTags = [...tags, tag];
    setTags(newTags);
    setInputValue('');
    mutation.mutate(newTags);
  }

  function removeTag(tag: string) {
    const newTags = tags.filter((t) => t !== tag);
    setTags(newTags);
    mutation.mutate(newTags);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag(inputValue);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${getBadgeColor(tag)}`}
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            className="ml-0.5 hover:opacity-70 focus:outline-none"
            aria-label={`Xóa thẻ ${tag}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <Input
        className="h-6 w-28 px-2 text-xs"
        placeholder="Thêm thẻ..."
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (inputValue.trim()) addTag(inputValue); }}
      />
    </div>
  );
}
