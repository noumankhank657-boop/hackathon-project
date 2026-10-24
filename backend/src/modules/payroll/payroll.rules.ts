export function calculateMonthlyTax(grossMonthly: number) {
  const annualGross = grossMonthly * 12;
  let annualTax = 0;
  if (annualGross <= 600000) annualTax = 0;
  else if (annualGross <= 1200000) annualTax = (annualGross - 600000) * 0.05;
  else if (annualGross <= 2400000) annualTax = 30000 + (annualGross - 1200000) * 0.15;
  else if (annualGross <= 3600000) annualTax = 210000 + (annualGross - 2400000) * 0.25;
  else annualTax = 510000 + (annualGross - 3600000) * 0.35;
  return annualTax / 12;
}

export function calculatePayrollAmounts(input: {
  basic: number;
  workingDaysInMonth: number;
  absentDays: number;
  unpaidLeaveDays: number;
  halfDays: number;
}) {
  const hra = input.basic * 0.4;
  const medical = input.basic * 0.1;
  const gross = input.basic + hra + medical;
  const perDay = input.workingDaysInMonth > 0 ? gross / input.workingDaysInMonth : 0;
  const deductionUnits = input.absentDays + input.unpaidLeaveDays + input.halfDays * 0.5;
  const attendanceDeduction = perDay * deductionUnits;
  const tax = calculateMonthlyTax(gross);
  const deductions = attendanceDeduction + tax;
  const net = Math.max(0, gross - deductions);
  return { hra, medical, gross, perDay, deductionUnits, attendanceDeduction, tax, deductions, net };
}
