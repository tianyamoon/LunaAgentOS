function compareText(left, right) {
  return String(left || "").localeCompare(String(right || ""));
}

function compareDesc(left, right) {
  return compareText(right, left);
}

function compareWorkspaceFirst(left, right) {
  return Number(Boolean(right?.isInWorkspace)) - Number(Boolean(left?.isInWorkspace));
}

export function compareActiveSessionListItems(left, right) {
  return compareWorkspaceFirst(left, right)
    || compareDesc(left?.createdAt, right?.createdAt)
    || compareText(left?.id, right?.id);
}

export function compareArchivedSessionListItems(left, right) {
  return compareDesc(left?.updatedAt, right?.updatedAt)
    || compareWorkspaceFirst(left, right)
    || compareText(left?.id, right?.id);
}
