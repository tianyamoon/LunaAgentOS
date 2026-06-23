import test from "node:test";
import assert from "node:assert/strict";
import {
  RESUME_VALIDATION_PHASE,
  bindResumeValidationTurn,
  clearResumeValidation,
  isResumeValidationTurn,
  markResumeValidationPending,
} from "./resumeValidation.js";

test("resume validation starts pending and binds exactly one first turn", () => {
  const session = { id: "s1" };
  markResumeValidationPending(session);

  assert.deepEqual(session.resume_validation, {
    phase: RESUME_VALIDATION_PHASE.pending,
    turn_id: null,
  });

  bindResumeValidationTurn(session, "t1");
  assert.deepEqual(session.resume_validation, {
    phase: RESUME_VALIDATION_PHASE.validating,
    turn_id: "t1",
  });
  assert.equal(isResumeValidationTurn(session, "t1"), true);
  assert.equal(isResumeValidationTurn(session, "t2"), false);

  bindResumeValidationTurn(session, "t2");
  assert.equal(session.resume_validation.turn_id, "t1");
});

test("resume validation can be cleared after success or failed restore", () => {
  const session = { id: "s1" };
  assert.equal(clearResumeValidation(session), false);

  markResumeValidationPending(session);
  assert.equal(clearResumeValidation(session), true);
  assert.equal(session.resume_validation, undefined);
  assert.equal(isResumeValidationTurn(session, "t1"), false);
});
