export function inventoryDetailPath(vehicleId: string) {
  return `/inventory/vehicle/${vehicleId}`;
}

export function inventoryEditPath(vehicleId: string) {
  return `${inventoryDetailPath(vehicleId)}/edit`;
}

export function inventoryCostsPath(vehicleId: string) {
  return `${inventoryDetailPath(vehicleId)}/costs`;
}

export function customerDetailPath(customerId: string) {
  return `/customers/profile/${customerId}`;
}

export function customerDraftPath(customerId: string) {
  return `/customers/new?draft=${customerId}`;
}
