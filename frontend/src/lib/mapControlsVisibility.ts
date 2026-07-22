export function shouldShowMobileMapControls(
  shared: boolean,
  isPointCloud: boolean
): boolean {
  return !shared || isPointCloud;
}
