/**
 * Seed script. Run with `npm run db:seed`.
 * Creates exactly what the assignment asks for: 4 users (one per role),
 * 2 plants, ~6 equipment items, and ~10 permits spread across different
 * statuses — one permit per lifecycle status, so logging in as any role
 * shows a populated, realistic system immediately.
 */
import { PrismaClient, PermitType, PermitStatus } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

const HOUR = 60 * 60 * 1000;
const now = () => new Date();

async function main() {
  console.log("Clearing existing data...");
  await prisma.auditLog.deleteMany();
  await prisma.extensionRequest.deleteMany();
  await prisma.permitApproval.deleteMany();
  await prisma.permit.deleteMany();
  await prisma.equipment.deleteMany();
  await prisma.area.deleteMany();
  await prisma.plant.deleteMany();
  await prisma.user.deleteMany();

  console.log("Creating users...");
  const password = await hashPassword("password123");

  const requester = await prisma.user.create({
    data: { name: "Priya Sharma", email: "requester@opmaint.demo", passwordHash: password, role: "REQUESTER" },
  });
  const areaOwner = await prisma.user.create({
    data: { name: "Karthik Raman", email: "areaowner@opmaint.demo", passwordHash: password, role: "AREA_OWNER" },
  });
  const safetyOfficer = await prisma.user.create({
    data: { name: "Lakshmi Iyer", email: "safety@opmaint.demo", passwordHash: password, role: "SAFETY_OFFICER" },
  });
  const admin = await prisma.user.create({
    data: { name: "Admin User", email: "admin@opmaint.demo", passwordHash: password, role: "ADMIN" },
  });

  console.log("Creating plants and areas...");
  const plant1 = await prisma.plant.create({ data: { name: "Ambattur Manufacturing Plant", location: "Chennai" } });
  const plant2 = await prisma.plant.create({ data: { name: "Sriperumbudur Assembly Plant", location: "Chennai" } });

  const areaBoiler = await prisma.area.create({
    data: { name: "Utilities & Boiler House", plantId: plant1.id, ownerId: areaOwner.id },
  });
  const areaPaint = await prisma.area.create({
    data: { name: "Paint Shop", plantId: plant1.id, ownerId: areaOwner.id },
  });
  // Deliberately unowned, to demonstrate what happens when an area has no
  // owner assigned yet (documented as a known gap in the README).
  const areaAssembly = await prisma.area.create({
    data: { name: "Assembly Line 2", plantId: plant2.id },
  });

  console.log("Creating equipment...");
  const eqBoiler = await prisma.equipment.create({ data: { tag: "BLR-01", name: "Main Steam Boiler", areaId: areaBoiler.id } });
  const eqCompressor = await prisma.equipment.create({ data: { tag: "CMP-02", name: "Air Compressor 2", areaId: areaBoiler.id } });
  const eqPaintBooth = await prisma.equipment.create({ data: { tag: "PB-01", name: "Paint Booth 1", areaId: areaPaint.id } });
  const eqSprayRobot = await prisma.equipment.create({ data: { tag: "RB-02", name: "Spray Robot 2", areaId: areaPaint.id } });
  const eqConveyor = await prisma.equipment.create({ data: { tag: "CNV-02", name: "Conveyor Line 2", areaId: areaAssembly.id } });
  const eqWeldStation = await prisma.equipment.create({ data: { tag: "WS-05", name: "Welding Station 5", areaId: areaAssembly.id } });

  let seq = 1;
  const code = (type: string) => `PTW-${type}-2026-${String(seq++).padStart(6, "0")}`;

  const defaultPrecautions = (labels: string[], allChecked = false) =>
    labels.map((label) => ({ label, checked: allChecked }));

  // ---- 1. DRAFT — a hot work permit the requester hasn't submitted yet ----
  const p1 = await prisma.permit.create({
    data: {
      code: code("HW"),
      type: PermitType.HOT_WORK,
      status: PermitStatus.DRAFT,
      requesterId: requester.id,
      contractorName: "Sundaram Fabricators",
      workDescription: "Weld a support bracket onto the boiler feedwater pipe rack.",
      plantId: plant1.id,
      areaId: areaBoiler.id,
      equipmentId: eqBoiler.id,
      plannedStart: new Date(now().getTime() + 26 * HOUR),
      plannedEnd: new Date(now().getTime() + 30 * HOUR),
      hazards: ["Open flame", "Flammable vapour nearby"],
      ppeRequired: ["Welding helmet", "Fire-resistant coveralls", "Gloves"],
      precautions: defaultPrecautions([
        "Isolate the line / equipment",
        "Test atmosphere before starting",
        "Fire extinguisher on site",
        "Fire watch posted for duration of work",
        "Combustible material cleared within 10 metres",
      ]),
      typeFields: {
        hotWorkType: "WELDING",
        fireWatchAssigned: "Ravi Kumar",
        fireExtinguisherType: "CO2, 4.5kg",
        combustiblesClearedRadiusM: 10,
        gasTest: {},
      },
    },
  });
  await prisma.auditLog.create({
    data: { permitId: p1.id, actorId: requester.id, action: "CREATED", comment: "Draft created." },
  });

  // ---- 2. PENDING_APPROVAL — confined space entry awaiting both approvals ----
  const p2 = await prisma.permit.create({
    data: {
      code: code("CS"),
      type: PermitType.CONFINED_SPACE,
      status: PermitStatus.PENDING_APPROVAL,
      requesterId: requester.id,
      contractorName: "Chennai Industrial Services",
      workDescription: "Inspect and clean the boiler's internal drum ahead of the annual shutdown.",
      plantId: plant1.id,
      areaId: areaBoiler.id,
      equipmentId: eqBoiler.id,
      plannedStart: new Date(now().getTime() + 4 * HOUR),
      plannedEnd: new Date(now().getTime() + 10 * HOUR),
      hazards: ["Confined space", "Residual steam / heat", "Low oxygen risk"],
      ppeRequired: ["Full body harness", "Gas monitor", "Coveralls"],
      precautions: defaultPrecautions([
        "Atmospheric test before entry (O2, LEL, H2S, CO)",
        "Standby attendant present at all times",
        "Rescue plan briefed to all entrants",
        "Ventilation running for duration of entry",
        "Entry/exit log maintained",
      ]),
      typeFields: {
        spaceId: "BLR-01-DRUM",
        entryPoint: "North manway",
        atmosphericTest: { o2Percent: 20.9, lelPercent: 0, h2sPpm: 0, coPpm: 0 },
        standbyAttendant: "Mohan Das",
        rescuePlan: "Retrieval line + winch at manway; plant fire team on standby call.",
        ventilationMethod: "Forced air ventilation via portable blower",
        entryExitLog: [],
      },
    },
  });
  await prisma.permitApproval.createMany({
    data: [
      { permitId: p2.id, approverRole: "AREA_OWNER", status: "PENDING" },
      { permitId: p2.id, approverRole: "SAFETY_OFFICER", status: "PENDING" },
    ],
  });
  await prisma.auditLog.createMany({
    data: [
      { permitId: p2.id, actorId: requester.id, action: "CREATED", comment: "Draft created." },
      { permitId: p2.id, actorId: requester.id, action: "STATUS_CHANGE", fromValue: "DRAFT", toValue: "PENDING_APPROVAL", comment: "Submitted for approval." },
    ],
  });

  // ---- 3. APPROVED — working at height, not yet activated (starts later today) ----
  const p3 = await prisma.permit.create({
    data: {
      code: code("WH"),
      type: PermitType.WORKING_AT_HEIGHT,
      status: PermitStatus.APPROVED,
      requesterId: requester.id,
      contractorName: "SkyLine Access Solutions",
      workDescription: "Replace damaged roof sheeting above the paint booth extraction unit.",
      plantId: plant1.id,
      areaId: areaPaint.id,
      equipmentId: eqPaintBooth.id,
      plannedStart: new Date(now().getTime() + 3 * HOUR),
      plannedEnd: new Date(now().getTime() + 7 * HOUR),
      hazards: ["Fall from height", "Fragile roof surface"],
      ppeRequired: ["Full body harness", "Hard hat", "Non-slip footwear"],
      precautions: defaultPrecautions(
        [
          "Fall arrest equipment inspected before use",
          "Anchor point checked and rated",
          "Area below barricaded",
          "Access equipment inspected",
        ],
        true
      ),
      typeFields: {
        heightMeters: 6.5,
        accessMethod: "MEWP",
        fallArrestEquipment: "Full body harness + twin-tail lanyard",
        anchorPointChecked: true,
        barricadingBelow: true,
      },
    },
  });
  await prisma.permitApproval.createMany({
    data: [
      { permitId: p3.id, approverRole: "AREA_OWNER", approverId: areaOwner.id, status: "APPROVED", decidedAt: now(), comment: "Access plan looks fine." },
      { permitId: p3.id, approverRole: "SAFETY_OFFICER", approverId: safetyOfficer.id, status: "APPROVED", decidedAt: now(), comment: "PPE confirmed on site." },
    ],
  });
  await prisma.auditLog.createMany({
    data: [
      { permitId: p3.id, actorId: requester.id, action: "CREATED", comment: "Draft created." },
      { permitId: p3.id, actorId: requester.id, action: "STATUS_CHANGE", fromValue: "DRAFT", toValue: "PENDING_APPROVAL", comment: "Submitted for approval." },
      { permitId: p3.id, actorId: areaOwner.id, action: "APPROVAL", toValue: "AREA_OWNER: APPROVED", comment: "Access plan looks fine." },
      { permitId: p3.id, actorId: safetyOfficer.id, action: "APPROVAL", toValue: "SAFETY_OFFICER: APPROVED", comment: "PPE confirmed on site." },
      { permitId: p3.id, actorId: safetyOfficer.id, action: "STATUS_CHANGE", fromValue: "PENDING_APPROVAL", toValue: "APPROVED", comment: "All required approvals received." },
    ],
  });

  // ---- 4. ACTIVE — hot work in progress, expiring soon (inside 2h window) ----
  const p4 = await prisma.permit.create({
    data: {
      code: code("HW"),
      type: PermitType.HOT_WORK,
      status: PermitStatus.ACTIVE,
      requesterId: requester.id,
      contractorName: "Sundaram Fabricators",
      workDescription: "Grind and cut a corroded bracket off the compressor skid for replacement.",
      plantId: plant1.id,
      areaId: areaBoiler.id,
      equipmentId: eqCompressor.id,
      plannedStart: new Date(now().getTime() - 2 * HOUR),
      plannedEnd: new Date(now().getTime() + 45 * 60 * 1000), // expiring in 45 minutes
      hazards: ["Sparks", "Oil residue nearby"],
      ppeRequired: ["Face shield", "Gloves", "Fire-resistant coveralls"],
      precautions: defaultPrecautions(
        [
          "Isolate the line / equipment",
          "Test atmosphere before starting",
          "Fire extinguisher on site",
          "Fire watch posted for duration of work",
          "Combustible material cleared within 10 metres",
        ],
        true
      ),
      typeFields: {
        hotWorkType: "GRINDING",
        fireWatchAssigned: "Ganesh Pillai",
        fireExtinguisherType: "DCP, 6kg",
        combustiblesClearedRadiusM: 10,
        gasTest: { lelPercent: 0, o2Percent: 20.9, testedAt: new Date(now().getTime() - 2.1 * HOUR).toISOString() },
      },
      activatedAt: new Date(now().getTime() - 2 * HOUR),
    },
  });
  await prisma.permitApproval.createMany({
    data: [
      { permitId: p4.id, approverRole: "AREA_OWNER", approverId: areaOwner.id, status: "APPROVED", decidedAt: now() },
      { permitId: p4.id, approverRole: "SAFETY_OFFICER", approverId: safetyOfficer.id, status: "APPROVED", decidedAt: now() },
    ],
  });
  await prisma.auditLog.createMany({
    data: [
      { permitId: p4.id, actorId: requester.id, action: "CREATED", comment: "Draft created." },
      { permitId: p4.id, actorId: requester.id, action: "STATUS_CHANGE", fromValue: "DRAFT", toValue: "PENDING_APPROVAL", comment: "Submitted for approval." },
      { permitId: p4.id, actorId: areaOwner.id, action: "APPROVAL", toValue: "AREA_OWNER: APPROVED" },
      { permitId: p4.id, actorId: safetyOfficer.id, action: "APPROVAL", toValue: "SAFETY_OFFICER: APPROVED" },
      { permitId: p4.id, actorId: safetyOfficer.id, action: "STATUS_CHANGE", fromValue: "PENDING_APPROVAL", toValue: "APPROVED" },
      { permitId: p4.id, actorId: requester.id, action: "STATUS_CHANGE", fromValue: "APPROVED", toValue: "ACTIVE", comment: "Work activated — inside the approved time window." },
    ],
  });

  // ---- 5. SUSPENDED — electrical isolation halted mid-job ----
  const p5 = await prisma.permit.create({
    data: {
      code: code("EL"),
      type: PermitType.ELECTRICAL_ISOLATION,
      status: PermitStatus.SUSPENDED,
      requesterId: requester.id,
      contractorName: "Voltas Electrical Contractors",
      workDescription: "Replace the main contactor on the assembly line drive panel.",
      plantId: plant2.id,
      areaId: areaAssembly.id,
      equipmentId: eqConveyor.id,
      plannedStart: new Date(now().getTime() - 3 * HOUR),
      plannedEnd: new Date(now().getTime() + 3 * HOUR),
      hazards: ["Electric shock", "Arc flash"],
      ppeRequired: ["Insulated gloves", "Arc-rated face shield", "Insulated tools"],
      precautions: defaultPrecautions(
        [
          "All isolation points locked out",
          "Equipment tested dead before work starts",
          "Earthing applied where required",
          "Locks and tags match the isolation register",
        ],
        true
      ),
      typeFields: {
        equipmentTag: "CNV-02-MCC",
        voltageLevel: "415V 3-phase",
        isolationPoints: ["MCC-04 breaker", "Local isolator at panel"],
        lockNumbers: ["LK-1187"],
        tagNumbers: ["TG-2231"],
        earthingApplied: true,
        testedDeadBy: "Voltas site electrician",
      },
      activatedAt: new Date(now().getTime() - 3 * HOUR),
      suspendedAt: new Date(now().getTime() - 30 * 60 * 1000),
    },
  });
  await prisma.permitApproval.createMany({
    data: [
      { permitId: p5.id, approverRole: "AREA_OWNER", approverId: admin.id, status: "APPROVED", decidedAt: now(), comment: "Admin approved on behalf — area has no owner assigned yet." },
      { permitId: p5.id, approverRole: "SAFETY_OFFICER", approverId: safetyOfficer.id, status: "APPROVED", decidedAt: now() },
    ],
  });
  await prisma.auditLog.createMany({
    data: [
      { permitId: p5.id, actorId: requester.id, action: "CREATED", comment: "Draft created." },
      { permitId: p5.id, actorId: requester.id, action: "STATUS_CHANGE", fromValue: "DRAFT", toValue: "PENDING_APPROVAL" },
      { permitId: p5.id, actorId: admin.id, action: "APPROVAL", toValue: "AREA_OWNER: APPROVED", comment: "Admin approved on behalf — area has no owner assigned yet." },
      { permitId: p5.id, actorId: safetyOfficer.id, action: "APPROVAL", toValue: "SAFETY_OFFICER: APPROVED" },
      { permitId: p5.id, actorId: safetyOfficer.id, action: "STATUS_CHANGE", fromValue: "PENDING_APPROVAL", toValue: "APPROVED" },
      { permitId: p5.id, actorId: requester.id, action: "STATUS_CHANGE", fromValue: "APPROVED", toValue: "ACTIVE" },
      { permitId: p5.id, actorId: safetyOfficer.id, action: "STATUS_CHANGE", fromValue: "ACTIVE", toValue: "SUSPENDED", comment: "Suspended: gas alarm triggered in adjacent bay, halting all hot/electrical work as a precaution." },
    ],
  });

  // ---- 6. EXPIRED — a hot work window that passed without activation ----
  const p6 = await prisma.permit.create({
    data: {
      code: code("HW"),
      type: PermitType.HOT_WORK,
      status: PermitStatus.EXPIRED,
      requesterId: requester.id,
      contractorName: "Sundaram Fabricators",
      workDescription: "Cut and remove an old pipe support bracket, night shift.",
      plantId: plant1.id,
      areaId: areaBoiler.id,
      equipmentId: eqBoiler.id,
      plannedStart: new Date(now().getTime() - 30 * HOUR),
      plannedEnd: new Date(now().getTime() - 24 * HOUR),
      hazards: ["Open flame"],
      ppeRequired: ["Welding helmet", "Gloves"],
      precautions: defaultPrecautions(
        [
          "Isolate the line / equipment",
          "Test atmosphere before starting",
          "Fire extinguisher on site",
          "Fire watch posted for duration of work",
          "Combustible material cleared within 10 metres",
        ],
        true
      ),
      typeFields: {
        hotWorkType: "CUTTING",
        fireWatchAssigned: "Ravi Kumar",
        fireExtinguisherType: "CO2, 4.5kg",
        combustiblesClearedRadiusM: 10,
        gasTest: {},
      },
    },
  });
  await prisma.permitApproval.createMany({
    data: [
      { permitId: p6.id, approverRole: "AREA_OWNER", approverId: areaOwner.id, status: "APPROVED", decidedAt: now() },
      { permitId: p6.id, approverRole: "SAFETY_OFFICER", approverId: safetyOfficer.id, status: "APPROVED", decidedAt: now() },
    ],
  });
  await prisma.auditLog.createMany({
    data: [
      { permitId: p6.id, actorId: requester.id, action: "CREATED", comment: "Draft created." },
      { permitId: p6.id, actorId: requester.id, action: "STATUS_CHANGE", fromValue: "DRAFT", toValue: "PENDING_APPROVAL" },
      { permitId: p6.id, actorId: areaOwner.id, action: "APPROVAL", toValue: "AREA_OWNER: APPROVED" },
      { permitId: p6.id, actorId: safetyOfficer.id, action: "APPROVAL", toValue: "SAFETY_OFFICER: APPROVED" },
      { permitId: p6.id, actorId: safetyOfficer.id, action: "STATUS_CHANGE", fromValue: "PENDING_APPROVAL", toValue: "APPROVED" },
      { permitId: p6.id, actorId: null, action: "STATUS_CHANGE", fromValue: "APPROVED", toValue: "EXPIRED", comment: "Auto-expired: planned end time passed without closure." },
    ],
  });

  // ---- 7. REJECTED — confined space entry the safety officer rejected ----
  const p7 = await prisma.permit.create({
    data: {
      code: code("CS"),
      type: PermitType.CONFINED_SPACE,
      status: PermitStatus.REJECTED,
      requesterId: requester.id,
      contractorName: "Chennai Industrial Services",
      workDescription: "Enter the compressor pit to inspect the sump pump.",
      plantId: plant1.id,
      areaId: areaBoiler.id,
      equipmentId: eqCompressor.id,
      plannedStart: new Date(now().getTime() + 20 * HOUR),
      plannedEnd: new Date(now().getTime() + 24 * HOUR),
      hazards: ["Confined space", "Standing water"],
      ppeRequired: ["Harness", "Gas monitor"],
      precautions: defaultPrecautions([
        "Atmospheric test before entry (O2, LEL, H2S, CO)",
        "Standby attendant present at all times",
        "Rescue plan briefed to all entrants",
        "Ventilation running for duration of entry",
        "Entry/exit log maintained",
      ]),
      typeFields: {
        spaceId: "CMP-02-PIT",
        entryPoint: "Access hatch, east side",
        atmosphericTest: {},
        standbyAttendant: "Mohan Das",
        rescuePlan: "Retrieval line at hatch.",
        ventilationMethod: "Natural ventilation only",
        entryExitLog: [],
      },
    },
  });
  await prisma.permitApproval.createMany({
    data: [
      { permitId: p7.id, approverRole: "AREA_OWNER", status: "PENDING" },
      {
        permitId: p7.id,
        approverRole: "SAFETY_OFFICER",
        approverId: safetyOfficer.id,
        status: "REJECTED",
        decidedAt: now(),
        comment: "Rescue plan is not adequate for a wet pit entry, and no forced ventilation is proposed. Resubmit with a powered ventilation plan and a dedicated retrieval winch.",
      },
    ],
  });
  await prisma.auditLog.createMany({
    data: [
      { permitId: p7.id, actorId: requester.id, action: "CREATED", comment: "Draft created." },
      { permitId: p7.id, actorId: requester.id, action: "STATUS_CHANGE", fromValue: "DRAFT", toValue: "PENDING_APPROVAL" },
      {
        permitId: p7.id,
        actorId: safetyOfficer.id,
        action: "REJECTION",
        fromValue: "PENDING_APPROVAL",
        toValue: "REJECTED",
        comment: "Rescue plan is not adequate for a wet pit entry, and no forced ventilation is proposed. Resubmit with a powered ventilation plan and a dedicated retrieval winch.",
      },
    ],
  });

  // ---- 8. CLOSED — working at height, work done, awaiting safety verification ----
  const p8 = await prisma.permit.create({
    data: {
      code: code("WH"),
      type: PermitType.WORKING_AT_HEIGHT,
      status: PermitStatus.CLOSED,
      requesterId: requester.id,
      contractorName: "SkyLine Access Solutions",
      workDescription: "Clean and inspect the spray robot's overhead cable tray.",
      plantId: plant1.id,
      areaId: areaPaint.id,
      equipmentId: eqSprayRobot.id,
      plannedStart: new Date(now().getTime() - 8 * HOUR),
      plannedEnd: new Date(now().getTime() - 4 * HOUR),
      hazards: ["Fall from height"],
      ppeRequired: ["Harness", "Hard hat"],
      precautions: defaultPrecautions(
        [
          "Fall arrest equipment inspected before use",
          "Anchor point checked and rated",
          "Area below barricaded",
          "Access equipment inspected",
        ],
        true
      ),
      typeFields: {
        heightMeters: 4.2,
        accessMethod: "SCAFFOLD",
        fallArrestEquipment: "Harness + lanyard",
        anchorPointChecked: true,
        barricadingBelow: true,
      },
      activatedAt: new Date(now().getTime() - 8 * HOUR),
      closedAt: new Date(now().getTime() - 3.5 * HOUR),
      closeNotes: "Cable tray cleaned and re-inspected. No damage found. Area left clean.",
    },
  });
  await prisma.permitApproval.createMany({
    data: [
      { permitId: p8.id, approverRole: "AREA_OWNER", approverId: areaOwner.id, status: "APPROVED", decidedAt: now() },
      { permitId: p8.id, approverRole: "SAFETY_OFFICER", approverId: safetyOfficer.id, status: "APPROVED", decidedAt: now() },
    ],
  });
  await prisma.auditLog.createMany({
    data: [
      { permitId: p8.id, actorId: requester.id, action: "CREATED", comment: "Draft created." },
      { permitId: p8.id, actorId: requester.id, action: "STATUS_CHANGE", fromValue: "DRAFT", toValue: "PENDING_APPROVAL" },
      { permitId: p8.id, actorId: areaOwner.id, action: "APPROVAL", toValue: "AREA_OWNER: APPROVED" },
      { permitId: p8.id, actorId: safetyOfficer.id, action: "APPROVAL", toValue: "SAFETY_OFFICER: APPROVED" },
      { permitId: p8.id, actorId: safetyOfficer.id, action: "STATUS_CHANGE", fromValue: "PENDING_APPROVAL", toValue: "APPROVED" },
      { permitId: p8.id, actorId: requester.id, action: "STATUS_CHANGE", fromValue: "APPROVED", toValue: "ACTIVE" },
      { permitId: p8.id, actorId: requester.id, action: "STATUS_CHANGE", fromValue: "ACTIVE", toValue: "CLOSED", comment: "Marked complete: Cable tray cleaned and re-inspected. No damage found. Area left clean." },
    ],
  });

  // ---- 9. CLOSED_VERIFIED — full lifecycle including an approved extension ----
  const p9 = await prisma.permit.create({
    data: {
      code: code("EL"),
      type: PermitType.ELECTRICAL_ISOLATION,
      status: PermitStatus.CLOSED_VERIFIED,
      requesterId: requester.id,
      contractorName: "Voltas Electrical Contractors",
      workDescription: "Rewire the welding station's control panel after a fault trip.",
      plantId: plant2.id,
      areaId: areaAssembly.id,
      equipmentId: eqWeldStation.id,
      plannedStart: new Date(now().getTime() - 48 * HOUR),
      plannedEnd: new Date(now().getTime() - 44 * HOUR),
      hazards: ["Electric shock"],
      ppeRequired: ["Insulated gloves", "Insulated tools"],
      precautions: defaultPrecautions(
        [
          "All isolation points locked out",
          "Equipment tested dead before work starts",
          "Earthing applied where required",
          "Locks and tags match the isolation register",
        ],
        true
      ),
      typeFields: {
        equipmentTag: "WS-05-PANEL",
        voltageLevel: "415V 3-phase",
        isolationPoints: ["Panel main breaker"],
        lockNumbers: ["LK-1190"],
        tagNumbers: ["TG-2240"],
        earthingApplied: true,
        testedDeadBy: "Voltas site electrician",
      },
      activatedAt: new Date(now().getTime() - 48 * HOUR),
      closedAt: new Date(now().getTime() - 43 * HOUR),
      closeNotes: "Panel rewired, tested and re-energised successfully.",
      verifiedAt: new Date(now().getTime() - 42 * HOUR),
    },
  });
  await prisma.permitApproval.createMany({
    data: [
      { permitId: p9.id, approverRole: "AREA_OWNER", approverId: admin.id, status: "APPROVED", decidedAt: now() },
      { permitId: p9.id, approverRole: "SAFETY_OFFICER", approverId: safetyOfficer.id, status: "APPROVED", decidedAt: now() },
    ],
  });
  await prisma.extensionRequest.create({
    data: {
      permitId: p9.id,
      hours: 2,
      reason: "Additional cabling fault found once panel was opened; needs more time to trace.",
      status: "APPROVED",
      reviewerId: safetyOfficer.id,
      reviewComment: "Approved — isolation still intact, no new hazard introduced.",
      decidedAt: new Date(now().getTime() - 45 * HOUR),
    },
  });
  await prisma.auditLog.createMany({
    data: [
      { permitId: p9.id, actorId: requester.id, action: "CREATED", comment: "Draft created." },
      { permitId: p9.id, actorId: requester.id, action: "STATUS_CHANGE", fromValue: "DRAFT", toValue: "PENDING_APPROVAL" },
      { permitId: p9.id, actorId: admin.id, action: "APPROVAL", toValue: "AREA_OWNER: APPROVED", comment: "Admin approved on behalf — area has no owner assigned yet." },
      { permitId: p9.id, actorId: safetyOfficer.id, action: "APPROVAL", toValue: "SAFETY_OFFICER: APPROVED" },
      { permitId: p9.id, actorId: safetyOfficer.id, action: "STATUS_CHANGE", fromValue: "PENDING_APPROVAL", toValue: "APPROVED" },
      { permitId: p9.id, actorId: requester.id, action: "STATUS_CHANGE", fromValue: "APPROVED", toValue: "ACTIVE" },
      { permitId: p9.id, actorId: requester.id, action: "EXTENSION_REQUESTED", comment: "Requested +2h: Additional cabling fault found once panel was opened; needs more time to trace." },
      { permitId: p9.id, actorId: safetyOfficer.id, action: "EXTENSION_APPROVED", toValue: "+2h", comment: "Approved — isolation still intact, no new hazard introduced." },
      { permitId: p9.id, actorId: requester.id, action: "STATUS_CHANGE", fromValue: "ACTIVE", toValue: "CLOSED", comment: "Marked complete: Panel rewired, tested and re-energised successfully." },
      { permitId: p9.id, actorId: safetyOfficer.id, action: "STATUS_CHANGE", fromValue: "CLOSED", toValue: "CLOSED_VERIFIED", comment: "Closure verified — area confirmed clean." },
    ],
  });

  // ---- 10. CANCELLED — hot work called off before it started ----
  const p10 = await prisma.permit.create({
    data: {
      code: code("HW"),
      type: PermitType.HOT_WORK,
      status: PermitStatus.CANCELLED,
      requesterId: requester.id,
      contractorName: "Sundaram Fabricators",
      workDescription: "Weld a temporary support for scaffolding near the paint booth.",
      plantId: plant1.id,
      areaId: areaPaint.id,
      equipmentId: eqPaintBooth.id,
      plannedStart: new Date(now().getTime() + 10 * HOUR),
      plannedEnd: new Date(now().getTime() + 12 * HOUR),
      hazards: ["Open flame", "Paint solvent vapour nearby"],
      ppeRequired: ["Welding helmet", "Gloves"],
      precautions: defaultPrecautions([
        "Isolate the line / equipment",
        "Test atmosphere before starting",
        "Fire extinguisher on site",
        "Fire watch posted for duration of work",
        "Combustible material cleared within 10 metres",
      ]),
      typeFields: {
        hotWorkType: "WELDING",
        fireWatchAssigned: "Ravi Kumar",
        fireExtinguisherType: "CO2, 4.5kg",
        combustiblesClearedRadiusM: 10,
        gasTest: {},
      },
      cancelledAt: now(),
      cancelReason: "Scaffolding plan changed — bolted support will be used instead of welding, near active solvent spraying.",
    },
  });
  await prisma.auditLog.createMany({
    data: [
      { permitId: p10.id, actorId: requester.id, action: "CREATED", comment: "Draft created." },
      { permitId: p10.id, actorId: requester.id, action: "STATUS_CHANGE", fromValue: "DRAFT", toValue: "PENDING_APPROVAL" },
      {
        permitId: p10.id,
        actorId: requester.id,
        action: "STATUS_CHANGE",
        fromValue: "PENDING_APPROVAL",
        toValue: "CANCELLED",
        comment: "Cancelled: Scaffolding plan changed — bolted support will be used instead of welding, near active solvent spraying.",
      },
    ],
  });

  console.log("Seed complete.");
  console.log("");
  console.log("Demo logins (all use password: password123):");
  console.log(`  Requester       ${requester.email}`);
  console.log(`  Area Owner      ${areaOwner.email}`);
  console.log(`  Safety Officer  ${safetyOfficer.email}`);
  console.log(`  Admin           ${admin.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
