import { getWorkingPeriod } from "@/shared/lib/period"

// Resolved per navigation so a session open across midnight still lands on
// the right month. It lands on the working month (real calendar month + 1),
// not on the real calendar month — same reasoning as the router's own
// redirect for "/".
export const buildCurrentMonthPath = () => {
  const { year, month } = getWorkingPeriod()

  return `/months/${year}/${month}`
}

type IntendedLocationState = {
  from: string
}

// The guard stores the blocked path in the navigation state, which is
// attacker-writable, so only same-origin absolute paths are accepted back.
const isIntendedLocationState = (
  state: unknown
): state is IntendedLocationState => {
  if (typeof state !== "object" || state === null || !("from" in state)) {
    return false
  }

  const { from } = state

  return (
    typeof from === "string" && from.startsWith("/") && !from.startsWith("//")
  )
}

export const resolvePathAfterLogin = (state: unknown) => {
  if (isIntendedLocationState(state) && state.from !== "/login") {
    return state.from
  }

  return buildCurrentMonthPath()
}
