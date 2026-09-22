"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

export function Field({
  label,
  name,
  type = "text",
  errors,
  hint,
  ...rest
}: {
  label: string;
  name: string;
  type?: string;
  errors?: string[];
  hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = `field-${name}`;
  const invalid = Boolean(errors?.length);

  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-[#5E7370]">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        aria-invalid={invalid}
        aria-describedby={invalid ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={`w-full rounded-lg border px-3 py-2.5 text-[#12211F] outline-none focus-visible:ring-2 focus-visible:ring-[#FFC93D] ${
          invalid ? "border-red-500" : "border-[#D5DFD8]"
        }`}
        {...rest}
      />
      {hint && !invalid ? (
        <p id={`${id}-hint`} className="mt-1 text-sm text-[#5E7370]">
          {hint}
        </p>
      ) : null}
      {invalid ? (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-600">
          {errors![0]}
        </p>
      ) : null}
    </div>
  );
}

export function SubmitButton({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-full bg-[#0E3B36] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#082926] disabled:opacity-60"
    >
      {pending ? "Working…" : children}
    </button>
  );
}

export function Banner({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`mb-5 rounded-lg border px-4 py-3 text-sm ${
        tone === "error"
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-[#F0DFA8] bg-[#FFF7E0] text-[#54451A]"
      }`}
    >
      {children}
    </div>
  );
}

export function SelectField({
  label,
  name,
  options,
  errors,
  hint,
  ...rest
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  errors?: string[];
  hint?: string;
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const id = `field-${name}`;
  const invalid = Boolean(errors?.length);

  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-muted">
        {label}
      </label>
      <select
        id={id}
        name={name}
        aria-invalid={invalid}
        className={`w-full rounded-lg border bg-white px-3 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-amber ${
          invalid ? "border-red-500" : "border-line"
        }`}
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && !invalid ? <p className="mt-1 text-sm text-muted">{hint}</p> : null}
      {invalid ? <p className="mt-1 text-sm text-red-600">{errors![0]}</p> : null}
    </div>
  );
}
