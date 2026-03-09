import { useRouter } from "expo-router";
import { useCreateDeal } from "@/features/deals/hooks";
import { DealForm } from "@/features/deals/components/DealForm";
import type { CreateDealBody } from "@/features/deals/types";
import { DealerApiError } from "@/api/errors";

export default function AddDealScreen() {
  const router = useRouter();
  const create = useCreateDeal();

  const handleSubmit = (payload: CreateDealBody) => {
    create.mutate(payload, {
      onSuccess: (res) => {
        router.replace(`/(tabs)/deals/${res.data.id}`);
      },
    });
  };

  const apiError =
    create.isError && create.error instanceof DealerApiError
      ? create.error.message
      : create.isError
        ? "Failed to create deal"
        : null;

  return (
    <DealForm
      mode="create"
      deal={null}
      onSubmit={handleSubmit}
      isSubmitting={create.isPending}
      apiError={apiError}
    />
  );
}
