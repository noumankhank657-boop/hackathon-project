import test from "node:test";
import assert from "node:assert/strict";
import { calculateMonthlyTax, calculatePayrollAmounts } from "../src/modules/payroll/payroll.rules.js";

test("applies tax slab for annual gross above 1.2m", () => {
  const monthlyTax = calculateMonthlyTax(120000);
  assert.equal(Math.round(monthlyTax), 5500);
});

test("calculates deductions from absent, unpaid and half days", () => {
  const amounts = calculatePayrollAmounts({
    basic: 100000,
    workingDaysInMonth: 20,
    absentDays: 1,
    unpaidLeaveDays: 2,
    halfDays: 2,
  });
  assert.equal(Math.round(amounts.deductionUnits * 10) / 10, 4);
  assert.ok(amounts.net < amounts.gross);
});
