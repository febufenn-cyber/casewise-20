export function matterAllowsStage(matterStatus, stage) {
  if (stage === "delete_matter") return matterStatus === "active" || matterStatus === "deletion_pending";
  return matterStatus === "active";
}
