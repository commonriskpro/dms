import * as conversationsDb from "../db/conversations";

export async function hasCanonicalConversations(dealershipId: string) {
  return conversationsDb.hasCanonicalConversations(dealershipId);
}

export async function listCanonicalConversationsPage(
  dealershipId: string,
  limit: number,
  offset: number
) {
  return conversationsDb.listCanonicalConversationsPage(dealershipId, limit, offset);
}
