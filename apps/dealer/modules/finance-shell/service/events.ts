import { registerListener } from "@/lib/infrastructure/events/eventBus";
import { lockFinanceWhenDealContracted } from "./lock";

registerListener("deal.status_changed", (payload) => {
  if (payload.to === "CONTRACTED") {
    lockFinanceWhenDealContracted(payload.dealershipId, payload.dealId).catch((err) => {
      console.error("[finance-shell] lockFinanceWhenDealContracted failed:", err);
    });
  }
});
