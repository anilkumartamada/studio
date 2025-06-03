import { z } from 'zod';

export const productStatusEnum = z.enum([
  "Monitoring",
  "Paused",
  "Achieved",
  "Abandoned",
]);

export const productSchema = z.object({
  productId: z.string().min(1, "Product ID is required."),
  productName: z.string().min(1, "Product Name is required."),
  targetPrice: z.coerce.number({invalid_type_error: "Price must be a number."}).positive("Price must be positive."),
  productLink: z.string().url("Please enter a valid URL.").min(1, "Product link is required."),
});

export type ProductFormValues = z.infer<typeof productSchema>;
