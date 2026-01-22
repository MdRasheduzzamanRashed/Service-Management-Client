const KEY = "mock_provider_offers_v1";

// shape:
// {
//   [requestId]: { requestId, maxOffers, bestOffers: [offer,...] }
// }

function readStore() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

function writeStore(obj) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(obj));
}

export function saveMockOffer({ requestId, maxOffers, offer }) {
  const store = readStore();
  const entry = store[requestId] || { requestId, maxOffers, bestOffers: [] };

  const newOffer = {
    offerId: `${requestId}-P-${Date.now()}`,
    supplierName: offer.supplierName,
    priceTotal: offer.priceTotal,
    deliveryDays: offer.deliveryDays,
    notes: offer.notes || "",
    score: 0, // you can compute later
    submittedAt: new Date().toISOString(),
    currency: "EUR",
    status: "SUBMITTED",
  };

  entry.bestOffers = [newOffer, ...(entry.bestOffers || [])];

  // keep only last 50 (for safety)
  entry.bestOffers = entry.bestOffers.slice(0, 50);

  // update maxOffers
  entry.maxOffers = Number(maxOffers || entry.maxOffers || 3);

  store[requestId] = entry;
  writeStore(store);
}

export function getMockOffersForRequest(requestId) {
  const store = readStore();
  return store[requestId] || { requestId, maxOffers: 0, bestOffers: [] };
}

export function getAllMockOffers() {
  return readStore();
}
