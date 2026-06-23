export const RESUME_VALIDATION_PHASE = Object.freeze({
  pending: "pending",
  validating: "validating",
});

export function markResumeValidationPending(session) {
  if (!session) return null;
  session.resume_validation = {
    phase: RESUME_VALIDATION_PHASE.pending,
    turn_id: null,
  };
  return session.resume_validation;
}

export function bindResumeValidationTurn(session, turnId) {
  if (!session?.resume_validation || !turnId) return null;
  if (session.resume_validation.phase !== RESUME_VALIDATION_PHASE.pending) return null;
  session.resume_validation = {
    phase: RESUME_VALIDATION_PHASE.validating,
    turn_id: turnId,
  };
  return session.resume_validation;
}

export function isResumeValidationTurn(session, turnId) {
  return Boolean(
    session?.resume_validation
      && session.resume_validation.phase === RESUME_VALIDATION_PHASE.validating
      && session.resume_validation.turn_id === turnId,
  );
}

export function clearResumeValidation(session) {
  if (!session) return false;
  if (!session.resume_validation) return false;
  delete session.resume_validation;
  return true;
}
