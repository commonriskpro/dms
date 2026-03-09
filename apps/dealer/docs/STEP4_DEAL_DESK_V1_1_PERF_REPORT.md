# Step 4 — Deal Desk V1.1 Performance Report

## Transaction and queries

- **Single transaction:** Full-desk save runs in one `prisma.$transaction`. All reads and writes (deal, fees, trade, finance, products) occur inside that transaction; no cross-request partial state.
- **No redundant queries:** Load deal once at start; inside tx we use the same deal id and dealership id. Recompute uses in-memory fee/product lists after replace. One audit write after the transaction.
- **Desk load:** Unchanged; `getDealDeskData` still does one deal load plus parallel history and audit list. No extra round-trips added for V1.1.

## Frontend

- **Payload size:** Full-desk body includes at most 50 fees and 30 products; typical usage is much smaller. No dashboard or list endpoints touched.
- **State updates:** Single setState after save (desk + drafts + form fields); no per-field refetch.

## Summary

Desk save remains a single transactional write and one audit log. Load path unchanged. Performance is adequate for V1.1.
