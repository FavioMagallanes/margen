import { afterEach, describe, expect, it, vi } from "vitest"

import { fetchTarjetaExchangeRate } from "@/shared/lib/exchange-rate-api"

type FetchResponse = {
  ok: boolean
  status: number
  json: () => Promise<unknown>
}

const stubFetch = (response: FetchResponse | Error) => {
  const fetchMock = vi.fn(() =>
    response instanceof Error
      ? Promise.reject(response)
      : Promise.resolve(response)
  )

  vi.stubGlobal("fetch", fetchMock)

  return fetchMock
}

const okResponse = (body: unknown): FetchResponse => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve(body),
})

describe("fetchTarjetaExchangeRate", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it("devuelve el valor de venta y la fecha que informa la fuente", async () => {
    const fetchMock = stubFetch(
      okResponse({
        moneda: "USD",
        casa: "tarjeta",
        nombre: "Tarjeta",
        compra: 1943.5,
        venta: 2008.5,
        fechaActualizacion: "2026-09-25T18:55:00.000Z",
      })
    )

    await expect(fetchTarjetaExchangeRate()).resolves.toEqual({
      ventaArs: 2008.5,
      sourceUpdatedAt: "2026-09-25T18:55:00.000Z",
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("falla cuando la red no responde", async () => {
    stubFetch(new Error("network down"))

    await expect(fetchTarjetaExchangeRate()).rejects.toBeInstanceOf(Error)
  })

  it("falla cuando el servicio responde con un status de error", async () => {
    stubFetch({
      ok: false,
      status: 503,
      json: () => Promise.resolve({ venta: 2008.5 }),
    })

    await expect(fetchTarjetaExchangeRate()).rejects.toBeInstanceOf(Error)
  })

  it("falla cuando el cuerpo no tiene una venta numérica", async () => {
    stubFetch(
      okResponse({
        venta: "2008,5",
        fechaActualizacion: "2026-09-25T18:55:00.000Z",
      })
    )

    await expect(fetchTarjetaExchangeRate()).rejects.toBeInstanceOf(Error)
  })

  it("falla cuando falta la fecha de actualización de la fuente", async () => {
    stubFetch(okResponse({ venta: 2008.5 }))

    await expect(fetchTarjetaExchangeRate()).rejects.toBeInstanceOf(Error)
  })

  it("falla cuando la venta no es positiva", async () => {
    stubFetch(
      okResponse({ venta: 0, fechaActualizacion: "2026-09-25T18:55:00.000Z" })
    )

    await expect(fetchTarjetaExchangeRate()).rejects.toBeInstanceOf(Error)
  })
})
