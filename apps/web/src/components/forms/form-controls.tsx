"use client";

import { Controller, get, type Control, type FieldErrors, type FieldValues, type Path, type UseFormRegister } from "react-hook-form";
import { cn } from "@/lib/utils";

type BaseFieldProps = {
  label: string;
  required?: boolean;
  description?: string;
  className?: string;
};

type InputFieldProps<TValues extends FieldValues> = BaseFieldProps & {
  name: Path<TValues>;
  register: UseFormRegister<TValues>;
  errors: FieldErrors<TValues>;
  placeholder?: string;
  type?: React.HTMLInputTypeAttribute;
  min?: number;
  disabled?: boolean;
  autoComplete?: string;
};

type TextareaFieldProps<TValues extends FieldValues> = BaseFieldProps & {
  name: Path<TValues>;
  register: UseFormRegister<TValues>;
  errors: FieldErrors<TValues>;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
};

type SelectFieldProps<TValues extends FieldValues> = BaseFieldProps & {
  name: Path<TValues>;
  register: UseFormRegister<TValues>;
  errors: FieldErrors<TValues>;
  options: Array<{ label: string; value: string; disabled?: boolean }>;
  disabled?: boolean;
};

type CheckboxFieldProps<TValues extends FieldValues> = BaseFieldProps & {
  name: Path<TValues>;
  control: Control<TValues>;
  errors: FieldErrors<TValues>;
  disabled?: boolean;
};

function getErrorMessage<TValues extends FieldValues>(errors: FieldErrors<TValues>, name: Path<TValues>) {
  const error = get(errors, name);
  if (!error) {
    return "";
  }

  if (typeof error.message === "string") {
    return error.message;
  }

  return "Invalid value";
}

function FieldContainer({
  label,
  required,
  description,
  errorMessage,
  className,
  children,
}: React.PropsWithChildren<{
  label: string;
  required?: boolean;
  description?: string;
  errorMessage?: string;
  className?: string;
}>) {
  return (
    <label className={cn("space-y-1.5", className)}>
      <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-zinc-700">
        {label}
        {required ? <span className="pl-1 text-red-600">*</span> : null}
      </span>
      {children}
      {description ? <span className="block text-xs text-zinc-500">{description}</span> : null}
      {errorMessage ? <span className="block text-xs text-red-700">{errorMessage}</span> : null}
    </label>
  );
}

export function TextField<TValues extends FieldValues>({
  name,
  label,
  required,
  description,
  register,
  errors,
  placeholder,
  className,
  type = "text",
  min,
  disabled,
  autoComplete,
}: InputFieldProps<TValues>) {
  const errorMessage = getErrorMessage(errors, name);

  return (
    <FieldContainer
      label={label}
      required={required}
      description={description}
      errorMessage={errorMessage}
      className={className}
    >
      <input
        className={cn(
          "h-10 w-full border px-3 text-sm",
          errorMessage ? "border-red-400 bg-red-50" : "border-zinc-300",
          disabled ? "cursor-not-allowed bg-zinc-100 text-zinc-500" : "bg-white",
        )}
        placeholder={placeholder}
        type={type}
        min={min}
        autoComplete={autoComplete}
        disabled={disabled}
        {...register(name)}
      />
    </FieldContainer>
  );
}

export function TextareaField<TValues extends FieldValues>({
  name,
  label,
  required,
  description,
  register,
  errors,
  placeholder,
  className,
  disabled,
  rows = 4,
}: TextareaFieldProps<TValues>) {
  const errorMessage = getErrorMessage(errors, name);

  return (
    <FieldContainer
      label={label}
      required={required}
      description={description}
      errorMessage={errorMessage}
      className={className}
    >
      <textarea
        className={cn(
          "min-h-20 w-full border p-3 text-sm",
          errorMessage ? "border-red-400 bg-red-50" : "border-zinc-300",
          disabled ? "cursor-not-allowed bg-zinc-100 text-zinc-500" : "bg-white",
        )}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        {...register(name)}
      />
    </FieldContainer>
  );
}

export function SelectField<TValues extends FieldValues>({
  name,
  label,
  required,
  description,
  register,
  errors,
  options,
  className,
  disabled,
}: SelectFieldProps<TValues>) {
  const errorMessage = getErrorMessage(errors, name);

  return (
    <FieldContainer
      label={label}
      required={required}
      description={description}
      errorMessage={errorMessage}
      className={className}
    >
      <select
        className={cn(
          "h-10 w-full border px-3 text-sm",
          errorMessage ? "border-red-400 bg-red-50" : "border-zinc-300",
          disabled ? "cursor-not-allowed bg-zinc-100 text-zinc-500" : "bg-white",
        )}
        disabled={disabled}
        {...register(name)}
      >
        {options.map((option) => (
          <option key={`${name}-${option.value}`} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldContainer>
  );
}

export function CheckboxField<TValues extends FieldValues>({
  name,
  label,
  description,
  control,
  errors,
  className,
  disabled,
}: CheckboxFieldProps<TValues>) {
  const errorMessage = getErrorMessage(errors, name);

  return (
    <FieldContainer label={label} description={description} errorMessage={errorMessage} className={className}>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <input
            type="checkbox"
            checked={Boolean(field.value)}
            onChange={(event) => field.onChange(event.target.checked)}
            disabled={disabled}
            className="h-4 w-4 rounded border-zinc-300"
          />
        )}
      />
    </FieldContainer>
  );
}
