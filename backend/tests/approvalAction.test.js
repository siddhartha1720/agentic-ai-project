
import assert from "node:assert/strict";
import {
  validateApprovalAction,
  hashApprovalAction,
} from "../workflows/approvalAction.js";

// Test 1: Valid email
const email = {
  toolId: "send_email",
  args: {
    to: "student@example.com",
    subject: "Class Reminder",
    body: "Your class starts at 5 PM.",
  },
};

const validatedEmail = validateApprovalAction(
  email.toolId,
  email.args
);

assert.equal(validatedEmail.args.to, "student@example.com");
assert.equal(hashApprovalAction(email).length, 64);
console.log("PASS: Valid email action");

// Test 2: Same action produces same fingerprint
assert.equal(
  hashApprovalAction(email),
  hashApprovalAction(email)
);
console.log("PASS: Deterministic action hash");

// Test 3: Modified email body changes fingerprint
const modifiedEmail = {
  ...email,
  args: {
    ...email.args,
    body: "Your class starts at 6 PM.",
  },
};

assert.notEqual(
  hashApprovalAction(email),
  hashApprovalAction(modifiedEmail)
);
console.log("PASS: Modified action changes hash");

// Test 4: Unsupported action rejected
assert.throws(
  () => validateApprovalAction("publish_instagram_image", {}),
  /cannot be approved/
);
console.log("PASS: Unsupported tool rejected");

// Test 5: Invalid calendar time range
assert.throws(
  () =>
    validateApprovalAction("create_calendar_event", {
      summary: "Demo Class",
      startDateTime: "2026-12-01T18:00:00+05:30",
      endDateTime: "2026-12-01T17:00:00+05:30",
      timeZone: "Asia/Kolkata",
    }),
  /Invalid calendar event time range/
);

console.log("PASS: Invalid calendar times rejected");
assert.throws(
  () =>
    validateApprovalAction("send_email", {
      ...email.args,
      accessToken: "TEST_TOKEN",
    }),
  /Invalid approval action/
);

console.log("PASS: Extra sensitive parameters rejected");