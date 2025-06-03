
'use server';
/**
 * @fileOverview Flow to send product data to a webhook.
 *
 * - sendProductDataToWebhook - Function to send product data to a webhook.
 * - SendProductDataToWebhookInput - Input type for the sendProductDataToWebhook function.
 * - SendProductDataToWebhookOutput - Return type for the sendProductDataToWebhook function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { productSchema, type ProductFormValues } from '@/lib/schemas/product-schema';

// The input for this flow is directly the product data.
export type SendProductDataToWebhookInput = ProductFormValues;
const SendProductDataToWebhookInputSchema = productSchema;

const SendProductDataToWebhookOutputSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});
export type SendProductDataToWebhookOutput = z.infer<typeof SendProductDataToWebhookOutputSchema>;

const WEBHOOK_URL = "https://gen-ai-june6.app.n8n.cloud/webhook-test/b4632fe7-259f-46c2-87a3-6b9cd60d580c";

export async function sendProductDataToWebhook(input: SendProductDataToWebhookInput): Promise<SendProductDataToWebhookOutput> {
  return sendProductDataToWebhookFlow(input);
}

const sendProductDataToWebhookFlow = ai.defineFlow(
  {
    name: 'sendProductDataToWebhookFlow',
    inputSchema: SendProductDataToWebhookInputSchema,
    outputSchema: SendProductDataToWebhookOutputSchema,
  },
  async (input) => {
    try {
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      if (response.ok) {
        const responseData = await response.json(); // Assuming the webhook returns JSON
        return { success: true, message: responseData.message || 'Product data sent to webhook successfully.' };
      } else {
        const errorData = await response.text();
        console.error('Webhook response error:', response.status, errorData);
        return { success: false, message: `Webhook returned an error: ${response.status}. Details: ${errorData}` };
      }
    } catch (error: any) {
      console.error('Error sending data to webhook:', error);
      let errorMessage = 'Failed to send product data to webhook.';
      if (error.message) {
        errorMessage += ` Details: ${error.message}`;
      }
      return { success: false, message: errorMessage };
    }
  }
);
