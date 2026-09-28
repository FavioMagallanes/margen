/**
 * RF-09: the possible duplicate warning. A candidate is the small projection
 * of an expense the four entry forms can compare against what the month
 * already has on screen, whatever table each feature really writes to.
 */
export type DuplicateCandidate = {
  /** Card, loan entity, recurring group, "Otros gastos"… */
  group: string
  concept: string
  currency: string
  amount: number
  /** "3/6", or null when the expense has no installment (other, recurring). */
  installment: string | null
}

/**
 * The concept is free text, so "  Netflix " and "netflix" are the same expense
 * for this warning. Nothing fuzzier is needed: RF-09 only asks to notice an
 * obvious re-entry, never to decide anything on its own.
 */
const normalizeConcept = (concept: string): string =>
  concept.trim().toLowerCase()

const isSameExpense = (
  draft: DuplicateCandidate,
  candidate: DuplicateCandidate
): boolean =>
  draft.group === candidate.group &&
  normalizeConcept(draft.concept) === normalizeConcept(candidate.concept) &&
  draft.currency === candidate.currency &&
  draft.amount === candidate.amount &&
  draft.installment === candidate.installment

/** The first already loaded expense that looks like the draft, or null. */
export const findPossibleDuplicate = (
  draft: DuplicateCandidate,
  existingCandidates: readonly DuplicateCandidate[]
): DuplicateCandidate | null =>
  existingCandidates.find((candidate) => isSameExpense(draft, candidate)) ??
  null

/** "3/6" while both numbers are known; null is «no installment at all». */
export const formatInstallment = (
  installmentNumber: number | null,
  totalInstallments: number | null
): string | null =>
  installmentNumber === null || totalInstallments === null
    ? null
    : `${installmentNumber}/${totalInstallments}`
