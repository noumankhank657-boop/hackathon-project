import type { AttendanceStatus } from "@prisma/client";

export function computeInitialStatus(checkIn: Date, officeStart: string, graceMinutes: number): AttendanceStatus {
  const [hours, minutes] = officeStart.split(":").map(Number);
  const start = new Date(checkIn);
  start.setHours(hours, minutes + graceMinutes, 0, 0);
  return checkIn.getTime() > start.getTime() ? "LATE" : "PRESENT";
}

export function computeFinalStatus(input: {
  checkIn: Date;
  checkOut: Date;
  initialStatus: AttendanceStatus;
  halfDayHours: number;
}): AttendanceStatus {
  const workedHours = (input.checkOut.getTime() - input.checkIn.getTime()) / (1000 * 60 * 60);
  if (workedHours < input.halfDayHours) return "HALF_DAY";
  if (input.initialStatus === "LATE") return "LATE";
  return "PRESENT";
}
