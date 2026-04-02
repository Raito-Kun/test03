/** Main reports page — 3 top-level tabs: Tóm tắt, Chi tiết, Biểu đồ */
import { useState, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReportFilters, type FilterState } from './report-filters';
import { ReportSummaryTab } from './report-summary-tab';
import { ReportDetailTab } from './report-detail-tab';
import { ReportChartsTab } from './report-charts-tab';

function firstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const DEFAULT_FILTERS: FilterState = {
  dateFrom: firstOfMonth(),
  dateTo: today(),
  userId: '',
  teamId: '',
};

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('summary');
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  // committed = the filters that were active when user last clicked Tìm kiếm
  const [committed, setCommitted] = useState<FilterState | null>(null);
  const [searchVersion, setSearchVersion] = useState(0);

  const handleSearch = useCallback(() => {
    setCommitted({ ...filters });
    setSearchVersion((v) => v + 1);
  }, [filters]);

  const searched = committed !== null;
  // queryKey includes searchVersion to force re-fetch on each Tìm kiếm click
  const queryKey = ['reports', committed, searchVersion, activeTab];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Báo cáo</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="summary">Tóm tắt</TabsTrigger>
          <TabsTrigger value="detail">Chi tiết</TabsTrigger>
          <TabsTrigger value="charts">Biểu đồ</TabsTrigger>
        </TabsList>

        {/* Shared filter bar — same for all tabs */}
        <div className="mt-4 mb-4">
          <ReportFilters
            filters={filters}
            onChange={setFilters}
            onSearch={handleSearch}
          />
        </div>

        <TabsContent value="summary" className="mt-0">
          <ReportSummaryTab
            filters={committed ?? filters}
            searched={searched}
            queryKey={queryKey}
          />
        </TabsContent>

        <TabsContent value="detail" className="mt-0">
          <ReportDetailTab
            filters={committed ?? filters}
            searched={searched}
            queryKey={queryKey}
          />
        </TabsContent>

        <TabsContent value="charts" className="mt-0">
          <ReportChartsTab
            filters={committed ?? filters}
            searched={searched}
            queryKey={queryKey}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
