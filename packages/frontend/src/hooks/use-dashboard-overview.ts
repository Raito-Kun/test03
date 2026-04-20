import { useQuery } from "@tanstack/react-query";
import api from "@/services/api-client";
import { useSparklineBuffer } from "@/lib/use-sparkline-buffer";

export interface OverviewData {
  calls: {
    totalToday: number;
    answeredToday: number;
    answerRatePercent: number;
    avgDuration?: number;
    closeRatePercent?: number;
  };
  agents: { total: number; onCall: number };
  leads: { newToday: number; wonToday?: number; closeRatePercent?: number };
  tickets: { open: number };
  debtCases: {
    active: number;
    ptpRatePercent?: number;
    recoveryRatePercent?: number;
    amountCollectedToday?: number;
    totalOutstanding?: number;
  };
  wrapUp?: { avgDurationSeconds?: number };
}

export function useDashboardOverview() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["dashboard-overview"],
    queryFn: () =>
      api
        .get<{ data: OverviewData }>("/dashboard/overview")
        .then((r) => r.data.data),
    refetchInterval: 30_000,
  });

  const totalCalls = data?.calls.totalToday;
  const answered = data?.calls.answeredToday;
  const missed =
    totalCalls !== undefined && answered !== undefined
      ? totalCalls - answered
      : undefined;
  const onCall = data?.agents.onCall;
  const avgDuration = data?.calls.avgDuration;
  const answerRate = data?.calls.answerRatePercent;

  // Sparkline buffers (last 7 refetch samples)
  const sparkTotal = useSparklineBuffer(totalCalls, 7);
  const sparkAnswered = useSparklineBuffer(answered, 7);
  const sparkMissed = useSparklineBuffer(missed, 7);
  const sparkOnCall = useSparklineBuffer(onCall, 7);
  const sparkDuration = useSparklineBuffer(avgDuration, 7);
  const sparkRate = useSparklineBuffer(answerRate, 7);

  return {
    data,
    isLoading,
    refetch,
    sparklines: {
      total: sparkTotal,
      answered: sparkAnswered,
      missed: sparkMissed,
      onCall: sparkOnCall,
      duration: sparkDuration,
      rate: sparkRate,
    },
  };
}
