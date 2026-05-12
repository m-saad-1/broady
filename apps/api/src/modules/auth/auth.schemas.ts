import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(128),
  fullName: z.string().trim().min(2).max(120),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(128),
});

export const googleAuthSchema = z.object({
  idToken: z.string().min(20),
});

export const passwordResetRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export const passwordResetCompleteSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(8).max(128),
});

export const accountVerificationSchema = z.object({
  token: z.string().min(20),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type GoogleAuthInput = z.infer<typeof googleAuthSchema>;
export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetCompleteInput = z.infer<typeof passwordResetCompleteSchema>;
export type AccountVerificationInput = z.infer<typeof accountVerificationSchema>;
