
'use server';
/**
 * @fileOverview Function to send product data to a webhook.
 *
 * - sendProductDataToWebhook - Function to send product data to a webhook.
 * - SendProductDataToWebhookInput - Input type for the sendProductDataToWebhook function.
 * - SendProductDataToWebhookOutput - Return type for the sendProductDataToWebhook function.
 */

import { z } from 'zod';
import { type ProductFormValues } from '@/lib/schemas/product-schema';

// The input for this function is directly the product data.
export type SendProductDataToWebhookInput = ProductFormValues;

const SendProductDataToWebhookOutputSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});
export type SendProductDataToWebhookOutput = z.infer<typeof SendProductDataToWebhookOutputSchema>;

const WEBHOOK_URL = "https://gen-ai-june6.app.n8n.cloud/webhook/b4632fe7-259f-46c2-87a3-6b9cd60d580c";

export async function sendProductDataToWebhook(input: SendProductDataToWebhookInput): Promise<SendProductDataToWebhookOutput> {
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
