function compareText(left, right) {
  return String(left || "").localeCompare(String(right || ""));
}

function compareDesc(left, right) {
  return compareText(right, left);
}

export function compareActiveSessionListItems(left, right) {
  return compareDesc(left?.createdAt, right?.createdAt)
    || compareText(left?.id, right?.id);
}

export function compareArchivedSessionListItems(left, right) {
  return compareDesc(left?.createdAt, right?.createdAt)
    || compareText(left?.id, right?.id);
}
