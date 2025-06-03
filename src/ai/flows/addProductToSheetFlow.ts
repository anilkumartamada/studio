'use server';
/**
 * @fileOverview Flow to add a product to a Google Sheet.
 *
 * - addProductToSheet - Function to add product data to a sheet.
 * - AddProductToSheetInput - Input type for the addProductToSheet function.
 * - AddProductToSheetOutput - Return type for the addProductToSheet function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit/zod';
import { productSchema, type ProductFormValues } from '@/lib/schemas/product-schema';
import { google } from 'googleapis';

const AddProductToSheetInputSchema = productSchema.extend({
  sheetUrl: z.string().url().describe("The URL of the Google Sheet."),
});
export type AddProductToSheetInput = z.infer<typeof AddProductToSheetInputSchema>;

const AddProductToSheetOutputSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});
export type AddProductToSheetOutput = z.infer<typeof AddProductToSheetOutputSchema>;

export async function addProductToSheet(input: AddProductToSheetInput): Promise<AddProductToSheetOutput> {
  return addProductToSheetFlow(input);
}

const addProductToSheetFlow = ai.defineFlow(
  {
    name: 'addProductToSheetFlow',
    inputSchema: AddProductToSheetInputSchema,
    outputSchema: AddProductToSheetOutputSchema,
  },
  async (input) => {
    const { productId, productName, targetPrice, productLink, sheetUrl } = input;

    try {
      const spreadsheetIdMatch = sheetUrl.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (!spreadsheetIdMatch || !spreadsheetIdMatch[1]) {
        return { success: false, message: 'Invalid Google Sheet URL. Could not extract Spreadsheet ID.' };
      }
      const spreadsheetId = spreadsheetIdMatch[1];

      // This uses Application Default Credentials.
      // Ensure your environment is configured with appropriate credentials
      // (e.g., GOOGLE_APPLICATION_CREDENTIALS environment variable pointing to a service account key JSON file)
      // The service account needs permission to edit Google Sheets.
      const auth = new google.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      const sheets = google.sheets({ version: 'v4', auth });

      // Data will be appended in this order. Ensure it matches your sheet columns.
      const values = [[productId, productName, targetPrice, productLink]];

      // Appends data to the first sheet (default name 'Sheet1'), columns A to D.
      // Adjust 'Sheet1' if your sheet has a different name.
      const range = 'Sheet1!A:D'; 

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED', // Interprets values as if typed by a user
        requestBody: {
          values,
        },
      });

      return { success: true, message: 'Product added to sheet successfully.' };
    } catch (error: any) {
      console.error('Error adding product to sheet:', error);
      // Provide a more user-friendly error message if possible
      let errorMessage = `Failed to add product. Please ensure the Google Sheet URL is correct, the sheet 'Sheet1' exists, and the application has permission to edit it.`;
      if (error.message) {
        errorMessage += ` Details: ${error.message}`;
      }
      return { success: false, message: errorMessage };
    }
  }
);
