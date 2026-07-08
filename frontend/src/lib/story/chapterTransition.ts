export function chapterTransitionDuration(
  transition: "fly-to" | "instant"
): number | undefined {
  return transition === "fly-to" ? 2500 : undefined;
}
