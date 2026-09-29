import { pdf } from "@react-pdf/renderer"

import {
  type ReportDocumentData,
  reportFileName,
} from "../model/report-document"
import { ReportPdfDocument } from "./report-pdf"

/**
 * RF-11: the document is built in the browser and downloaded on the spot —
 * nothing is uploaded, and no export is kept inside the app.
 */
export const downloadReportPdf = async (
  data: ReportDocumentData
): Promise<void> => {
  const blob = await pdf(<ReportPdfDocument data={data} />).toBlob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")

  link.href = url
  link.download = reportFileName(data.scope)
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
