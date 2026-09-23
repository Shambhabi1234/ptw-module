/**
 * This file is the whole answer to "can a 5th permit type be added without
 * rewriting anything". Every permit type is one entry in PERMIT_TYPE_REGISTRY:
 * a Zod schema for its type-specific fields, a default precautions checklist,
 * and a label. Nothing else in the app (routes, state machine, permissions,
 * the detail screen) knows or cares what fields a given type has — it just
 * calls getPermitTypeDef(type) and renders/validates generically.
 *
 * To add Excavation: add one PermitTypeDef below. That's it.
 */
import { z } from "zod";
import type { PermitType } from "@prisma/client";

const gasTest = z.object({
  o2Percent: z.number().min(0).max(100).optional(),
  lelPercent: z.number().min(0).max(100).optional(),
  h2sPpm: z.number().min(0).optional(),
  coPpm: z.number().min(0).optional(),
  testedAt: z.string().datetime().optional(),
});

export const hotWorkFieldsSchema = z.object({
  hotWorkType: z.enum(["WELDING", "GRINDING", "CUTTING", "SOLDERING"]),
  fireWatchAssigned: z.string().min(1, "Fire watch name is required"),
  fireExtinguisherType: z.string().min(1),
  combustiblesClearedRadiusM: z.number().positive(),
  gasTest: gasTest,
});

export const confinedSpaceFieldsSchema = z.object({
  spaceId: z.string().min(1),
  entryPoint: z.string().min(1),
  atmosphericTest: gasTest,
  standbyAttendant: z.string().min(1, "Standby attendant is required"),
  rescuePlan: z.string().min(1),
  ventilationMethod: z.string().min(1),
  entryExitLog: z
    .array(
      z.object({
        person: z.string(),
        entryTime: z.string().datetime().optional(),
        exitTime: z.string().datetime().optional(),
      })
    )
    .default([]),
});

export const workingAtHeightFieldsSchema = z.object({
  heightMeters: z.number().positive(),
  accessMethod: z.enum(["SCAFFOLD", "LADDER", "MEWP", "ROPE"]),
  fallArrestEquipment: z.string().min(1),
  anchorPointChecked: z.boolean(),
  barricadingBelow: z.boolean(),
});

export const electricalIsolationFieldsSchema = z.object({
  equipmentTag: z.string().min(1),
  voltageLevel: z.string().min(1),
  isolationPoints: z.array(z.string()).min(1, "At least one isolation point is required"),
  lockNumbers: z.array(z.string()).min(1),
  tagNumbers: z.array(z.string()).min(1),
  earthingApplied: z.boolean(),
  testedDeadBy: z.string().min(1),
});

export type HotWorkFields = z.infer<typeof hotWorkFieldsSchema>;
export type ConfinedSpaceFields = z.infer<typeof confinedSpaceFieldsSchema>;
export type WorkingAtHeightFields = z.infer<typeof workingAtHeightFieldsSchema>;
export type ElectricalIsolationFields = z.infer<typeof electricalIsolationFieldsSchema>;

interface PermitTypeDef {
  label: string;
  schema: z.ZodTypeAny;
  defaultPrecautions: string[];
  // Field-level metadata used to auto-render the create form. Kept tiny and
  // declarative on purpose — the form is generic, not copy-pasted per type.
  fields: Array<{
    key: string;
    label: string;
    kind: "text" | "number" | "boolean" | "select" | "textarea" | "stringArray" | "gasTest";
    options?: string[];
  }>;
}

export const PERMIT_TYPE_REGISTRY: Record<PermitType, PermitTypeDef> = {
  HOT_WORK: {
    label: "Hot Work",
    schema: hotWorkFieldsSchema,
    defaultPrecautions: [
      "Isolate the line / equipment",
      "Test atmosphere before starting",
      "Fire extinguisher on site",
      "Fire watch posted for duration of work",
      "Combustible material cleared within 10 metres",
    ],
    fields: [
      { key: "hotWorkType", label: "Type of hot work", kind: "select", options: ["WELDING", "GRINDING", "CUTTING", "SOLDERING"] },
      { key: "fireWatchAssigned", label: "Fire watch assigned (name)", kind: "text" },
      { key: "fireExtinguisherType", label: "Fire extinguisher type present", kind: "text" },
      { key: "combustiblesClearedRadiusM", label: "Combustibles cleared radius (m)", kind: "number" },
      { key: "gasTest", label: "Gas test (LEL % / O2 %)", kind: "gasTest" },
    ],
  },
  CONFINED_SPACE: {
    label: "Confined Space Entry",
    schema: confinedSpaceFieldsSchema,
    defaultPrecautions: [
      "Atmospheric test before entry (O2, LEL, H2S, CO)",
      "Standby attendant present at all times",
      "Rescue plan briefed to all entrants",
      "Ventilation running for duration of entry",
      "Entry/exit log maintained",
    ],
    fields: [
      { key: "spaceId", label: "Space ID", kind: "text" },
      { key: "entryPoint", label: "Entry point", kind: "text" },
      { key: "atmosphericTest", label: "Atmospheric test", kind: "gasTest" },
      { key: "standbyAttendant", label: "Standby attendant name", kind: "text" },
      { key: "rescuePlan", label: "Rescue plan", kind: "textarea" },
      { key: "ventilationMethod", label: "Ventilation method", kind: "text" },
    ],
  },
  WORKING_AT_HEIGHT: {
    label: "Working at Height",
    schema: workingAtHeightFieldsSchema,
    defaultPrecautions: [
      "Fall arrest equipment inspected before use",
      "Anchor point checked and rated",
      "Area below barricaded",
      "Access equipment inspected",
    ],
    fields: [
      { key: "heightMeters", label: "Height (metres)", kind: "number" },
      { key: "accessMethod", label: "Access method", kind: "select", options: ["SCAFFOLD", "LADDER", "MEWP", "ROPE"] },
      { key: "fallArrestEquipment", label: "Fall arrest equipment", kind: "text" },
      { key: "anchorPointChecked", label: "Anchor point checked", kind: "boolean" },
      { key: "barricadingBelow", label: "Barricading below in place", kind: "boolean" },
    ],
  },
  ELECTRICAL_ISOLATION: {
    label: "Electrical / Isolation (LOTO)",
    schema: electricalIsolationFieldsSchema,
    defaultPrecautions: [
      "All isolation points locked out",
      "Equipment tested dead before work starts",
      "Earthing applied where required",
      "Locks and tags match the isolation register",
    ],
    fields: [
      { key: "equipmentTag", label: "Equipment tag", kind: "text" },
      { key: "voltageLevel", label: "Voltage level", kind: "text" },
      { key: "isolationPoints", label: "Isolation points", kind: "stringArray" },
      { key: "lockNumbers", label: "Lock numbers", kind: "stringArray" },
      { key: "tagNumbers", label: "Tag numbers", kind: "stringArray" },
      { key: "earthingApplied", label: "Earthing applied", kind: "boolean" },
      { key: "testedDeadBy", label: "Tested dead by (name)", kind: "text" },
    ],
  },
};

export function getPermitTypeDef(type: PermitType): PermitTypeDef {
  return PERMIT_TYPE_REGISTRY[type];
}

export function validateTypeFields(type: PermitType, fields: unknown) {
  return PERMIT_TYPE_REGISTRY[type].schema.safeParse(fields);
}
