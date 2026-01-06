import { z } from 'zod';
import 'dotenv/config'; // Ensure variables are loaded

const envSchema = z.object({
  PINECONE_API_KEY: z.string().min(1, 'Pinecone API key is required'),
  PINECONE_INDEX_NAME: z.string().min(1, 'Pinecone index name is required'),
  GOOGLE_API_KEY: z.string().min(1, 'Google API key is required'),
  PORT: z.coerce.number().default(3000), // Coerce string to number
});

// Infer the type from the schema
export type Env = z.infer<typeof envSchema>;

export const parseEnv = (): Env => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Environment validation failed:');
      error.issues.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
    } else {
      console.error('❌ An unknown error occurred during env parsing:', error);
    }
    process.exit(1); // Stop the process early
  }
};

export const env = parseEnv();
