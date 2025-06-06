
"use client";

import type * as React from 'react';
import { ProductForm } from "./product-form";
import { Card, CardContent } from "@/components/ui/card";

export function SheetFormatterPage() {
  return (
    <div className="container mx-auto py-8 px-4 min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center">
      <div className="flex flex-col items-center justify-center w-full max-w-md">
        {/* Header and Form Column */}
        <div className="w-full flex flex-col justify-center p-4 md:p-8">
          <header className="mb-8 text-center md:text-left">
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
              Product Data Relay
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground">
              Effortlessly send product information to your designated webhook.
            </p>
          </header>

          <Card className="w-full shadow-2xl rounded-xl">
            <CardContent className="p-6 sm:p-8">
              <ProductForm />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
