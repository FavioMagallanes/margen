/**
 * RF-07: reads "dólar tarjeta" from dolarapi.com, the provider chosen for this
 * app (open, no API key, CORS enabled). The module stays UI agnostic: every
 * failure surfaces as a plain Error with an internal English message, and the
 * caller is the one that turns it into a message for the user.
 */

const TARJETA_RATE_ENDPOINT = "https://dolarapi.com/v1/dolares/tarjeta"

export type TarjetaExchangeRate = {
  /** ARS per USD, the "valor de venta" RF-01/RF-07 ask for. */
  ventaArs: number
  /** ISO 8601 instant the provider itself reports as its last update. */
  sourceUpdatedAt: string
}

const isPositiveFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0

const readTarjetaExchangeRate = (payload: unknown): TarjetaExchangeRate => {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Tarjeta exchange rate response is not an object")
  }

  const { venta, fechaActualizacion } = payload as {
    venta?: unknown
    fechaActualizacion?: unknown
  }

  if (!isPositiveFiniteNumber(venta)) {
    throw new Error("Tarjeta exchange rate response has no positive venta")
  }

  if (typeof fechaActualizacion !== "string" || fechaActualizacion === "") {
    throw new Error(
      "Tarjeta exchange rate response has no fechaActualizacion string"
    )
  }

  return { ventaArs: venta, sourceUpdatedAt: fechaActualizacion }
}

export const fetchTarjetaExchangeRate =
  async (): Promise<TarjetaExchangeRate> => {
    let payload: unknown

    try {
      const response = await fetch(TARJETA_RATE_ENDPOINT, {
        headers: { accept: "application/json" },
      })

      if (!response.ok) {
        throw new Error(
          `Tarjeta exchange rate request failed with status ${response.status}`
        )
      }

      payload = await response.json()
    } catch (cause) {
      // Network failures and unreadable bodies are the same thing here: no
      // usable rate, so the previous one has to stay untouched.
      throw new Error("Tarjeta exchange rate request failed", { cause })
    }

    return readTarjetaExchangeRate(payload)
  }
