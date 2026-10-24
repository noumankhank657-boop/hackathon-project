type LeaveTypeInfo = { id: string; yearlyQuota: number | null };
type ApprovedUsage = { leaveTypeId: string; days: number };

export function countWorkingDays(startDate: Date, endDate: Date, weekendDays: Set<number>, holidays: Set<string>) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  if (end < start) return 0;

  let days = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10);
    if (!weekendDays.has(cursor.getDay()) && !holidays.has(key)) {
      days += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export function computeLeaveBalances(leaveTypes: LeaveTypeInfo[], approvedUsage: ApprovedUsage[]) {
  const usedMap = new Map<string, number>();
  approvedUsage.forEach((item) => {
    usedMap.set(item.leaveTypeId, (usedMap.get(item.leaveTypeId) ?? 0) + item.days);
  });

  return leaveTypes.map((leaveType) => {
    const used = usedMap.get(leaveType.id) ?? 0;
    const remaining = leaveType.yearlyQuota === null ? null : Math.max(0, leaveType.yearlyQuota - used);
    return {
      leaveTypeId: leaveType.id,
      quota: leaveType.yearlyQuota,
      used,
      remaining,
    };
  });
}
