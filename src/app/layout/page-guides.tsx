import { cn } from "cn"

// The page is laid out on a centered column (max-w-7xl). Vertical hairlines run
// along its two edges for the full page height and horizontal rules run across
// the whole viewport, with a small square where they cross. Below the column
// width there is no free space to draw the verticals, so only the rules stay.
const COLUMN = "mx-auto w-full max-w-7xl"
const SQUARE =
  "absolute hidden size-[7px] border border-border bg-background min-[1300px]:block"

export const PageGuides = () => (
  <div
    aria-hidden="true"
    className={cn(
      COLUMN,
      "pointer-events-none absolute inset-y-0 left-1/2 z-20 hidden -translate-x-1/2 border-x border-border min-[1300px]:block"
    )}
  />
)

type GuideRuleProps = {
  className?: string
}

export const GuideRule = ({ className }: GuideRuleProps) => (
  <div
    aria-hidden="true"
    className={cn(
      "pointer-events-none relative z-20 h-px bg-border",
      className
    )}
  >
    <div className={cn(COLUMN, "relative h-px")}>
      <span className={cn(SQUARE, "-top-[3px] -left-[3px]")} />
      <span className={cn(SQUARE, "-top-[3px] -right-[3px]")} />
    </div>
  </div>
)
