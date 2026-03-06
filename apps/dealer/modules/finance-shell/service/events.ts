import { register } from "@/lib/events";
import { lockFinanceWhenDealContracted } from "./lock";

type DealStatusChangedPayload = {
  dealId: string;
  dealershipId: string;
  fromStatus: string;
  toStatus: string;
  changedBy?: string;
};

function onDealStatusChanged(payload: DealStatusChangedPayload): void {
  if (payload.toStatus === "CONTRACTED") {
    lockFinanceWhenDealContracted(payload.dealershipId, payload.dealId).catch((err) => {
      console.error("[finance-shell] lockFinanceWhenDealContracted failed:", err);
    });
  }
}

register<DealStatusChangedPayload>("deal.status_changed", onDealStatusChanged);
