
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
  Package,
  Target,
  Link as LinkIcon,
  Mail,
} from "lucide-react";
import { sendProductDataToWebhook } from '@/ai/flows/sendProductDataToWebhookFlow';


export function ProductForm() {
  const { toast } = useToast();
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      productName: "",
      targetPrice: '',
      productLink: "",
      email: "",
    },
  });

  async function onSubmit(values: ProductFormValues) {
    form.clearErrors(); 
    try {
      const result = await sendProductDataToWebhook(values);

      if (result.success) {
        toast({
          title: "Success!",
          description: result.message || "Product data submitted successfully to webhook.",
          variant: "default",
        });
        form.reset();
      } else {
        toast({
          title: "Error Submitting Data",
          description: result.message || "An unknown error occurred while sending to webhook.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Error in onSubmit:", error);
      toast({
        title: "Submission Failed",
        description: error.message || "An unexpected error occurred while submitting the form.",
        variant: "destructive",
      });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
            name="targetPrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Target Price (INR)</FormLabel>
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
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email Address</FormLabel>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <FormControl>
                    <Input type="email" placeholder="e.g., user@example.com" {...field} className="pl-10" />
                  </FormControl>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button type="submit" className="w-full md:w-auto" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Submitting..." : "Send Product Data"}
        </Button>
      </form>
    </Form>
  );
}
