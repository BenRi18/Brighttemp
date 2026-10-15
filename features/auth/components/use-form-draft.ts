"use client";

import { useEffect, useRef } from "react";

/**
 * Stops a form emptying itself.
 *
 * Two different things wipe a half-filled form, and they need different fixes:
 *
 *   1. A rejected submit. React resets an uncontrolled form once the action
 *      finishes, so every box goes blank even though the server only objected
 *      to one of them. Fixed by writing the submitted values back in.
 *   2. An actual page reload — a stray F5, a phone killing the tab, following a
 *      link and coming back. Nothing server-side survives that, so a copy is
 *      kept in sessionStorage as the user types.
 *
 * Passwords are never written to storage and never echoed back by the server;
 * they are the one thing worth retyping.
 *
 * The draft lives in sessionStorage, so it is gone when the tab closes and
 * never leaves the device. Every access is wrapped: in a private window, or
 * with site data blocked, reading it throws rather than returning null, and a
 * signup form that crashes is a good deal worse than one that forgets.
 */

const NEVER_KEEP = new Set(["password", "confirmPassword"]);

type FormControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function controls(form: HTMLFormElement): FormControl[] {
  return Array.from(form.elements).filter(
    (el): el is FormControl =>
      (el instanceof HTMLInputElement ||
        el instanceof HTMLSelectElement ||
        el instanceof HTMLTextAreaElement) &&
      Boolean(el.name) &&
      !NEVER_KEEP.has(el.name),
  );
}

function write(el: FormControl, value: string) {
  if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
    el.checked = value === "on" || value === el.value;
  } else {
    el.value = value;
  }
}

export function useFormDraft(key: string, serverValues?: Record<string, string>) {
  const ref = useRef<HTMLFormElement>(null);
  const storageKey = `brighttemp:draft:${key}`;

  const save = () => {
    const form = ref.current;
    if (!form) return;
    try {
      const out: Record<string, string> = {};
      for (const el of controls(form)) {
        if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
          if (el.checked) out[el.name] = "on";
        } else if (el.value) {
          out[el.name] = el.value;
        }
      }
      sessionStorage.setItem(storageKey, JSON.stringify(out));
    } catch {
      // Storage unavailable. The form still works; it just won't survive a reload.
    }
  };

  const clear = () => {
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      /* nothing to clean up */
    }
  };

  // Restore after a reload. Only fills boxes that are empty, so anything the
  // server sent back takes precedence over an older draft.
  useEffect(() => {
    const form = ref.current;
    if (!form) return;
    let saved: Record<string, string>;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return;
      saved = JSON.parse(raw) as Record<string, string>;
    } catch {
      return;
    }
    for (const el of controls(form)) {
      const value = saved[el.name];
      if (value === undefined) continue;
      const empty =
        el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")
          ? !el.checked
          : !el.value;
      if (empty) write(el, value);
    }
  }, [storageKey]);

  // Put back what was just submitted. This runs after React has reset the form,
  // which is the part that would otherwise lose everything on a validation error.
  useEffect(() => {
    const form = ref.current;
    if (!form || !serverValues) return;
    for (const el of controls(form)) {
      const value = serverValues[el.name];
      if (value !== undefined) write(el, value);
    }
  }, [serverValues]);

  return { ref, save, clear };
}
