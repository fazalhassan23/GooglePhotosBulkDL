import { z } from "zod";
export const optionsSchema = z
  .object({
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    timezone: z.string().max(100),
    videos: z.boolean(),
  })
  .strict();
export type Options = z.infer<typeof optionsSchema>;
export type Media = {
  id: string;
  filename: string;
  capture?: string;
  type: "PHOTO" | "VIDEO";
  url?: string;
  local?: string;
};
export type Progress = {
  phase: string;
  total: number;
  downloaded: number;
  skipped: number;
  failed: number;
  errors: string[];
};
export type Summary = {
  account: string;
  source: string;
  destination: string;
  matched: number;
  missingDates: number;
  options: Options;
};
export interface Bridge {
  chooseDestination(): Promise<string>;
  chooseTakeout(): Promise<string>;
  signIn(): Promise<string>;
  signOut(): Promise<void>;
  pick(): Promise<number>;
  prepare(options: Options): Promise<Summary>;
  start(): Promise<void>;
  cancel(): Promise<void>;
  onProgress(fn: (p: Progress) => void): () => void;
}
