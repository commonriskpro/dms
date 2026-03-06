export type CustomerFormValues = {
  name: string;
  phone: string;
  email: string;
  leadSource: string;
  status: string;
  initialNote: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateCustomerForm(values: CustomerFormValues): { name?: string; email?: string } {
  const err: { name?: string; email?: string } = {};
  if (!values.name.trim()) err.name = "Name is required";
  if (values.email.trim() && !EMAIL_RE.test(values.email.trim())) err.email = "Enter a valid email";
  return err;
}
