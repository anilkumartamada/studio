"use client";

import type * as React from 'react';
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ProductForm } from "./product-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const LOCAL_STORAGE_KEY = "googleSheetUrl";

export function SheetFormatterPage() {
  const [sheetUrl, setSheetUrl] = useState("");
  const [isUrlValid, setIsUrlValid] = useState(false);
  const [isUrlCommitted, setIsUrlCommitted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUrl = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (storedUrl) {
      setSheetUrl(storedUrl);
      validateUrl(storedUrl);
      setIsUrlCommitted(true); 
    }
    setIsLoading(false);
  }, []);

  const validateUrl = (url: string) => {
    try {
      const parsedUrl = new URL(url);
      const isValid = parsedUrl.protocol === "https:" && parsedUrl.hostname === "docs.google.com" && parsedUrl.pathname.startsWith("/spreadsheets/");
      setIsUrlValid(isValid);
      return isValid;
    } catch (error) {
      setIsUrlValid(false);
      return false;
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setSheetUrl(newUrl);
    if (isUrlCommitted) { // If URL was previously committed, allow live validation
        validateUrl(newUrl);
    } else { // Otherwise, only validate on commit
        setIsUrlValid(false); 
    }
  };
  
  const handleCommitUrl = () => {
    if (validateUrl(sheetUrl)) {
      localStorage.setItem(LOCAL_STORAGE_KEY, sheetUrl);
      setIsUrlCommitted(true);
    } else {
      setIsUrlCommitted(false);
      // Optionally, show a toast or message that the URL is invalid
      alert("Invalid Google Sheets URL. Please ensure it's a valid link to a Google Spreadsheet.");
    }
  };

  const handleEditUrl = () => {
    setIsUrlCommitted(false);
  };


  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="animate-pulse text-xl font-semibold text-foreground">Loading Settings...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 flex flex-col items-center min-h-full">
      <header className="text-center mb-10">
        <h1 className="text-4xl font-headline font-bold text-primary-foreground bg-primary py-2 px-4 rounded-lg shadow-md inline-block">
          Sheet Formatter
        </h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Easily add product data to your Google Sheet.
        </p>
      </header>

      <Card className="w-full max-w-3xl mb-8 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center">
            Google Sheet Configuration
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 ml-2 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Enter the URL of the Google Sheet you want to update.</p>
                  <p>Example: https://docs.google.com/spreadsheets/d/your_sheet_id/edit</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
          <CardDescription>
            Provide the URL for the 'Products to Monitor' Google Sheet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="sheetUrl" className="text-sm font-medium">Google Sheet URL</Label>
              <div className="flex items-center space-x-2 mt-1">
                <Input
                  id="sheetUrl"
                  type="url"
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={sheetUrl}
                  onChange={handleUrlChange}
                  disabled={isUrlCommitted}
                  className={cn(!isUrlValid && sheetUrl.length > 0 && !isUrlCommitted ? "border-destructive ring-destructive focus-visible:ring-destructive" : "")}
                />
                {isUrlCommitted ? (
                  <Button variant="outline" onClick={handleEditUrl}>Edit URL</Button>
                ) : (
                  <Button onClick={handleCommitUrl}>Set URL</Button>
                )}
              </div>
               {sheetUrl.length > 0 && !isUrlValid && !isUrlCommitted && (
                <p className="text-xs text-destructive mt-1">Please enter a valid Google Sheets URL.</p>
              )}
            </div>
            {isUrlCommitted && isUrlValid && (
                <a
                href={sheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline inline-flex items-center"
                >
                Open Sheet <ExternalLink className="h-3 w-3 ml-1" />
                </a>
            )}
          </div>
        </CardContent>
      </Card>

      {isUrlCommitted && isUrlValid && (
        <Card className="w-full max-w-3xl shadow-xl">
          <CardHeader>
            <CardTitle>Add New Product Entry</CardTitle>
            <CardDescription>
              Fill in the details below to add a new product to your sheet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProductForm sheetUrl={sheetUrl} />
          </CardContent>
        </Card>
      )}
       {!isUrlCommitted && !isLoading && (
         <div className="text-center text-muted-foreground p-6 bg-muted rounded-lg w-full max-w-3xl">
          <Info className="h-8 w-8 mx-auto mb-2" />
          <p>Please set a valid Google Sheets URL above to start adding products.</p>
        </div>
      )}
    </div>
  );
}
