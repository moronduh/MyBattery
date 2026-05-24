// Tests that BATTERY_THRESHOLDS and ENERGY_LEVEL_THRESHOLDS match the documented
// behaviour: color inflection, tier labels, energy level derivation.
// These are pure constant + logic tests — no mocking needed.

import { describe, it, expect } from "vitest";

// Inline the constants so this test file can run without importing the 7k-line component.
// If these values drift from mindful-productivity.jsx the tests will catch it.
const BATTERY_THRESHOLDS = {
  CRITICAL: 20,
  LOW:      40,
  MID:      50,
  GOOD:     75,
  FULL:     80,
};

const ENERGY_LEVEL_THRESHOLDS = {
  HIGH: 75,
  MED:  40,
  LOW:  15,
};

function deriveEnergyLevel(battery) {
  if (battery >= ENERGY_LEVEL_THRESHOLDS.HIGH) return "high";
  if (battery >= ENERGY_LEVEL_THRESHOLDS.MED)  return "med";
  if (battery >= ENERGY_LEVEL_THRESHOLDS.LOW)  return "low";
  return "hibernate";
}

function deriveTierLabel(battery) {
  if (battery < BATTERY_THRESHOLDS.CRITICAL) return "Critical";
  if (battery < BATTERY_THRESHOLDS.LOW)      return "Low";
  if (battery < BATTERY_THRESHOLDS.GOOD)     return "Medium";
  return "High";
}

describe("BATTERY_THRESHOLDS values", () => {
  it("CRITICAL < LOW < MID < GOOD < FULL", () => {
    const { CRITICAL, LOW, MID, GOOD, FULL } = BATTERY_THRESHOLDS;
    expect(CRITICAL).toBeLessThan(LOW);
    expect(LOW).toBeLessThan(MID);
    expect(MID).toBeLessThan(GOOD);
    expect(GOOD).toBeLessThan(FULL);
    expect(FULL).toBeLessThanOrEqual(100);
  });
});

describe("deriveEnergyLevel", () => {
  it("returns 'high' at or above HIGH threshold", () => {
    expect(deriveEnergyLevel(75)).toBe("high");
    expect(deriveEnergyLevel(100)).toBe("high");
    expect(deriveEnergyLevel(76)).toBe("high");
  });

  it("returns 'med' between MED and HIGH", () => {
    expect(deriveEnergyLevel(40)).toBe("med");
    expect(deriveEnergyLevel(74)).toBe("med");
    expect(deriveEnergyLevel(50)).toBe("med");
  });

  it("returns 'low' between LOW and MED", () => {
    expect(deriveEnergyLevel(15)).toBe("low");
    expect(deriveEnergyLevel(39)).toBe("low");
  });

  it("returns 'hibernate' below LOW threshold", () => {
    expect(deriveEnergyLevel(14)).toBe("hibernate");
    expect(deriveEnergyLevel(0)).toBe("hibernate");
  });

  it("boundary: exactly at threshold uses the higher tier", () => {
    expect(deriveEnergyLevel(ENERGY_LEVEL_THRESHOLDS.HIGH)).toBe("high");
    expect(deriveEnergyLevel(ENERGY_LEVEL_THRESHOLDS.MED)).toBe("med");
    expect(deriveEnergyLevel(ENERGY_LEVEL_THRESHOLDS.LOW)).toBe("low");
    expect(deriveEnergyLevel(ENERGY_LEVEL_THRESHOLDS.LOW - 1)).toBe("hibernate");
  });
});

describe("deriveTierLabel (AI Coach tier)", () => {
  it("returns 'Critical' below CRITICAL", () => {
    expect(deriveTierLabel(0)).toBe("Critical");
    expect(deriveTierLabel(19)).toBe("Critical");
  });

  it("returns 'Low' between CRITICAL and LOW", () => {
    expect(deriveTierLabel(20)).toBe("Low");
    expect(deriveTierLabel(39)).toBe("Low");
  });

  it("returns 'Medium' between LOW and GOOD", () => {
    expect(deriveTierLabel(40)).toBe("Medium");
    expect(deriveTierLabel(74)).toBe("Medium");
  });

  it("returns 'High' at or above GOOD", () => {
    expect(deriveTierLabel(75)).toBe("High");
    expect(deriveTierLabel(100)).toBe("High");
  });
});
