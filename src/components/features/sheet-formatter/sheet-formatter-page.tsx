
"use client";

import type * as React from 'react';
import { ProductForm } from "./product-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";


export function SheetFormatterPage() {

  return (
    <div className="container mx-auto py-8 px-4 flex flex-col items-center min-h-full">
      <header className="text-center mb-10">
        <h1 className="text-4xl font-headline font-bold text-primary-foreground bg-primary py-2 px-4 rounded-lg shadow-md inline-block">
          Product Data Entry
        </h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Submit product information to the configured webhook.
        </p>
      </header>

      <Card className="w-full max-w-3xl shadow-xl">
        <CardHeader>
          <CardTitle>Add New Product Entry</CardTitle>
          <CardDescription>
            Fill in the details below to send a new product to the webhook.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProductForm />
        </CardContent>
      </Card>
    </div>
  );
}
