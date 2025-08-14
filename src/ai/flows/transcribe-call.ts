// This needs wav package, so run `npm i wav`.
'use server';
/**
 * @fileOverview A video call transcription AI agent.
 *
 * - transcribeCall - A function that handles the video call transcription process.
 * - TranscribeCallInput - The input type for the transcribeCall function.
 * - TranscribeCallOutput - The return type for the transcribeCall function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import wav from 'wav';

const TranscribeCallInputSchema = z.object({
  audioDataUri: z
    .string()
    .describe(
      "The audio data of the video call, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type TranscribeCallInput = z.infer<typeof TranscribeCallInputSchema>;

const TranscribeCallOutputSchema = z.object({
  transcription: z.string().describe('The transcription of the video call audio.'),
});
export type TranscribeCallOutput = z.infer<typeof TranscribeCallOutputSchema>;

export async function transcribeCall(input: TranscribeCallInput): Promise<TranscribeCallOutput> {
  return transcribeCallFlow(input);
}

async function toWav(
  pcmData: Buffer,
  channels = 1,
  rate = 24000,
  sampleWidth = 2
): Promise<string> {
  return new Promise((resolve, reject) => {
    const writer = new wav.Writer({
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8,
    });

    let bufs = [] as any[];
    writer.on('error', reject);
    writer.on('data', function (d) {
      bufs.push(d);
    });
    writer.on('end', function () {
      resolve(Buffer.concat(bufs).toString('base64'));
    });

    writer.write(pcmData);
    writer.end();
  });
}

const prompt = ai.definePrompt({
  name: 'transcribeCallPrompt',
  input: {schema: TranscribeCallInputSchema},
  output: {schema: TranscribeCallOutputSchema},
  prompt: `You are an expert transcriptionist specializing in understanding human conversation.

You will use this information to transcribe the conversation, and extract all relevant information from it.

Audio: {{media url=audioDataUri}}`,
});

const transcribeCallFlow = ai.defineFlow(
  {
    name: 'transcribeCallFlow',
    inputSchema: TranscribeCallInputSchema,
    outputSchema: TranscribeCallOutputSchema,
  },
  async input => {
    const audioBuffer = Buffer.from(
      input.audioDataUri.substring(input.audioDataUri.indexOf(',') + 1),
      'base64'
    );

    // Convert PCM to WAV format
    const wavBase64 = await toWav(audioBuffer);
    const wavDataUri = 'data:audio/wav;base64,' + wavBase64;

    const {output} = await prompt({audioDataUri: wavDataUri});
    return output!;
  }
);
