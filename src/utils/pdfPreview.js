const fields = ['id', 'orderNumber', 'customerName', 'receivedByName', 'createdAt', 'deviceType', 'brand', 'model', 'pin', 'noPin', 'noContact', 'pattern', 'accessories', 'conditions', 'issue', 'fix', 'price', 'advance', 'diagnosisType', 'rejectedCharge']

export function pdfSignature(order, customer, terms) {
  return JSON.stringify([fields.map((key) => order?.[key]), customer?.fullName, customer?.dni, customer?.phone, customer?.phone2, customer?.phone3, customer?.address, terms])
}
