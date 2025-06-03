"use client";

import type * as React from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { productSchema, type ProductFormValues } from "@/lib/schemas/product-schema";
import { useToast } from "@/hooks/use-toast";
import {
  DollarSign,
  Fingerprint,
  Package,
  Tags,
  Target,
  Link as LinkIcon,
} from "lucide-react";

interface ProductFormProps {
  sheetUrl: string;
}

export function ProductForm({ sheetUrl }: ProductFormProps) {
  const { toast } = useToast();
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      productId: "",
      productName: "",
      category: "",
      currentPrice: undefined,
      targetPrice: undefined,
      productLink: "",
    },
  });

  async function onSubmit(values: ProductFormValues) {
    // Simulate API call to submit data to Google Sheet
    console.log("Form submitted with values:", values);
    console.log("Target Google Sheet URL:", sheetUrl);

    // Here you would typically make an API call to a backend
    // that handles writing to the Google Sheet.
    // For now, we'll just simulate success.

    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay

    toast({
      title: "Success!",
      description: "Product data submitted successfully.",
      variant: "default",
    });
    form.reset();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="productId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Product ID</FormLabel>
                <div className="relative">
                  <Fingerprint className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <FormControl>
                    <Input placeholder="e.g., SKU12345" {...field} className="pl-10" />
                  </FormControl>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="productName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Product Name</FormLabel>
                 <div className="relative">
                  <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <FormControl>
                    <Input placeholder="e.g., Wireless Headphones" {...field} className="pl-10" />
                  </FormControl>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <div className="relative">
                  <Tags className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <FormControl>
                    <Input placeholder="e.g., Electronics" {...field} className="pl-10" />
                  </FormControl>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="currentPrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Current Price (USD)</FormLabel>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <FormControl>
                    <Input type="number" placeholder="e.g., 99.99" {...field} className="pl-10" />
                  </FormControl>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="targetPrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Target Price (USD)</FormLabel>
                 <div className="relative">
                  <Target className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <FormControl>
                    <Input type="number" placeholder="e.g., 79.99" {...field} className="pl-10" />
                  </FormControl>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
           <FormField
            control={form.control}
            name="productLink"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Link to Product Page</FormLabel>
                <div className="relative">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <FormControl>
                    <Input type="url" placeholder="https://example.com/product" {...field} className="pl-10" />
                  </FormControl>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button type="submit" className="w-full md:w-auto" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Submitting..." : "Add Product to Sheet"}
        </Button>
      </form>
    </Form>
  );
}
