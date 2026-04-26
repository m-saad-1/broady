"use client";

import { useCallback, useState } from "react";

export type FormSubmissionTone = "success" | "error";

type ExecuteOptions<TResult> = {
  successMessage?: string;
  errorMessage?: string;
  clearFeedbackOnStart?: boolean;
  onSuccess?: (result: TResult) => void | Promise<void>;
  onError?: (error: unknown, message: string) => void | Promise<void>;
};

type ExecuteResult<TResult> =
  | { ok: true; result: TResult }
  | { ok: false; error: unknown; message: string };

function resolveErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export function useFormSubmission() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<FormSubmissionTone>("success");

  const clearFeedback = useCallback(() => {
    setFeedback(null);
  }, []);

  const setSuccessFeedback = useCallback((message: string) => {
    setFeedbackTone("success");
    setFeedback(message);
  }, []);

  const setErrorFeedback = useCallback((message: string) => {
    setFeedbackTone("error");
    setFeedback(message);
  }, []);

  const execute = useCallback(
    async <TResult>(
      action: () => Promise<TResult>,
      options: ExecuteOptions<TResult> = {},
    ): Promise<ExecuteResult<TResult>> => {
      const {
        successMessage,
        errorMessage = "Unable to complete request.",
        clearFeedbackOnStart = true,
        onSuccess,
        onError,
      } = options;

      if (clearFeedbackOnStart) {
        setFeedback(null);
      }

      setIsSubmitting(true);
      try {
        const result = await action();

        if (successMessage) {
          setFeedbackTone("success");
          setFeedback(successMessage);
        }

        if (onSuccess) {
          await onSuccess(result);
        }

        return { ok: true, result };
      } catch (error) {
        const message = resolveErrorMessage(error, errorMessage);
        setFeedbackTone("error");
        setFeedback(message);

        if (onError) {
          await onError(error, message);
        }

        return { ok: false, error, message };
      } finally {
        setIsSubmitting(false);
      }
    },
    [],
  );

  return {
    isSubmitting,
    feedback,
    feedbackTone,
    execute,
    clearFeedback,
    setSuccessFeedback,
    setErrorFeedback,
  };
}
