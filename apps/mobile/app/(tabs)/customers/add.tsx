import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/endpoints";
import { CustomerForm } from "@/features/customers/components/CustomerForm";

export default function AddCustomerScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const handleSubmit = async (
    body: Parameters<Parameters<typeof CustomerForm>[0]["onSubmit"]>[0],
    initialNote?: string
  ) => {
    const { data } = await api.createCustomer(body);
    if (initialNote?.trim()) {
      await api.createCustomerNote(data.id, { body: initialNote.trim() });
    }
    queryClient.invalidateQueries({ queryKey: ["customers"] });
    router.replace(`/(tabs)/customers/${data.id}`);
  };

  return (
    <CustomerForm
      mode="create"
      onSubmit={handleSubmit}
      submitLabel="Create customer"
      showInitialNote
    />
  );
}
