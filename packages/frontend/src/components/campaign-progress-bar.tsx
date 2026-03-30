interface CampaignProgressBarProps {
  campaignId: string;
  totalLeads: number;
  contactedLeads: number;
}

function getBarColor(percent: number): string {
  if (percent < 30) return 'bg-red-500';
  if (percent <= 70) return 'bg-yellow-500';
  return 'bg-green-500';
}

export function CampaignProgressBar({ totalLeads, contactedLeads }: CampaignProgressBarProps) {
  const percent = totalLeads > 0 ? Math.round((contactedLeads / totalLeads) * 100) : 0;
  const barColor = getBarColor(percent);

  return (
    <div className="w-full space-y-1">
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {contactedLeads}/{totalLeads} ({percent}%)
      </p>
    </div>
  );
}
