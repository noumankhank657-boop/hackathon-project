import test from "node:test";
import assert from "node:assert/strict";
import { computeLeaveBalances, countWorkingDays } from "../src/modules/leave/leave.rules.js";

test("counts working days excluding weekends and holidays", () => {
  const weekend = new Set([0, 6]);
  const holidays = new Set(["2026-10-27"]);
  const days = countWorkingDays(new Date("2026-10-26"), new Date("2026-10-30"), weekend, holidays);
  assert.equal(days, 4);
});

test("calculates balance from quota and approved usage", () => {
  const balances = computeLeaveBalances(
    [{ id: "annual", yearlyQuota: 14 }],
    [{ leaveTypeId: "annual", days: 5 }],
  );
  assert.equal(balances[0].remaining, 9);
});
