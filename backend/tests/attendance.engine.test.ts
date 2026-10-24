import test from "node:test";
import assert from "node:assert/strict";
import { computeFinalStatus, computeInitialStatus } from "../src/modules/attendance/attendance.engine.js";

test("marks check-in after grace as late", () => {
  const checkIn = new Date("2026-10-25T09:20:00.000Z");
  const status = computeInitialStatus(checkIn, "09:00", 15);
  assert.equal(status, "LATE");
});

test("marks short work day as half-day", () => {
  const checkIn = new Date("2026-10-25T09:00:00.000Z");
  const checkOut = new Date("2026-10-25T12:30:00.000Z");
  const status = computeFinalStatus({ checkIn, checkOut, initialStatus: "PRESENT", halfDayHours: 5 });
  assert.equal(status, "HALF_DAY");
});
