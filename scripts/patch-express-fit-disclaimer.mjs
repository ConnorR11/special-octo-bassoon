import fs from "node:fs"
import path from "node:path"

const filePath = path.resolve("src/pages/AppointmentDetail.jsx")
let source = fs.readFileSync(filePath, "utf8")

const disclaimer = `By signing and returning this document you are providing your agreement in writing to enable us to commence work within the cancellation period which starts when the customer signs the contract and ends 14 days after all of the goods relating to the contract are delivered to the customer's home.\n\nPlease Note: If you consent for work to begin within the cancellation period and you later exercise your right to cancel you will be liable for the cost of work performed up to the point of cancellation. You will also lose the right to cancel the contract within the cancellation period when the installation is completely finished. When this occurs the company can charge the full contract price.\n\nI/We understand that signing of this document does not affect my/our right to cancel the contract in the cancellation period which starts when I/we sign the contract and ends 14 days after all of the goods relating to the contract are delivered to my/our home.\n\nI/We hereby give express consent for Homeshield Scotland Ltd T/A Homeshield Renewables to commence work on the agreed installation date.`

const block = /(<SignaturePad\\b[\\s\\S]*?title=["'](?:Express Fit[^"']*)["'][\\s\\S]*?wording=)(["'`])(?:\\2)[\\s\\S]*?\\2/
if (!block.test(source)) {
  throw new Error("Could not locate the Express Fit SignaturePad wording")
}

source = source.replace(block, `$1{${JSON.stringify(disclaimer)}}`)
fs.writeFileSync(filePath, source)
console.log("Express Fit disclaimer updated")
