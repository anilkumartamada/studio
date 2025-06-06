
"use client";

import type * as React from 'react';
import Image from 'next/image';
import { ProductForm } from "./product-form";
import { Card, CardContent } from "@/components/ui/card";

export function SheetFormatterPage() {
  return (
    <div className="container mx-auto py-8 px-4 min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center">
      <div className="flex flex-col md:flex-row items-center justify-center w-full max-w-6xl">
        {/* Left Column: Header and Form */}
        <div className="w-full md:w-1/2 lg:w-2/5 flex flex-col justify-center p-4 md:p-8 order-2 md:order-1">
          <header className="mb-8 text-left">
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

        {/* Right Column: Image */}
        <div className="w-full md:w-1/2 lg:w-3/5 flex items-center justify-center p-4 md:p-8 order-1 md:order-2 mb-8 md:mb-0">
          <div className="relative w-full aspect-[4/3] max-w-md lg:max-w-lg">
            <Image
              src="https://placehold.co/600x450.png"
              alt="E-commerce product concept"
              layout="fill"
              objectFit="cover"
              className="rounded-xl shadow-xl"
              data-ai-hint="amazon logo online shopping"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
