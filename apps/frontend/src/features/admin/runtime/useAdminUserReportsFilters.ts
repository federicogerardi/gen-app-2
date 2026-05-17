import { useState } from 'react';

import type { UserReportCategory, UserReportStatus } from '../../feedback-center/contracts/feedback-center-contract';

export const useAdminUserReportsFilters = () => {
  const [statusFilter, setStatusFilter] = useState<UserReportStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<UserReportCategory | 'all'>('all');

  return {
    statusFilter,
    categoryFilter,
    setStatusFilter,
    setCategoryFilter,
  };
};