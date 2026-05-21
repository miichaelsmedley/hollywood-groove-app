// Per-attendee form row for ticket checkout.
//
// Each ticket has its own marketing record. Defaults to opt-out (Spam Act 2003).
// The buyer cannot opt in friends on their behalf — each holder ticks their own
// box. Visual style matches the JoinShow consent pattern.

import { Check } from "lucide-react";

export interface HolderFormState {
  holderName: string;
  holderEmail: string;
  holderPhone: string;
  holderEmailOptIn: boolean;
  holderSmsOptIn: boolean;
}

export const EMPTY_HOLDER: HolderFormState = {
  holderName: "",
  holderEmail: "",
  holderPhone: "",
  holderEmailOptIn: false,
  holderSmsOptIn: false,
};

interface HolderConsentRowProps {
  index: number;
  isBuyer: boolean;
  value: HolderFormState;
  onChange: (next: HolderFormState) => void;
  disabled?: boolean;
}

export default function HolderConsentRow({
  index,
  isBuyer,
  value,
  onChange,
  disabled = false,
}: HolderConsentRowProps) {
  const update = (patch: Partial<HolderFormState>) => onChange({ ...value, ...patch });

  return (
    <div className="card-cinema p-4 space-y-3">
      <div className="flex items-baseline justify-between">
        <h4 className="text-sm font-bold text-cinema-900">
          {isBuyer ? "Ticket 1 — Your details" : `Ticket ${index + 1} — Guest details`}
        </h4>
        {isBuyer && (
          <span className="text-[10px] uppercase tracking-wide text-primary font-semibold">
            Buyer
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs text-cinema-700 font-medium">Full name</span>
          <input
            type="text"
            value={value.holderName}
            onChange={(e) => update({ holderName: e.target.value })}
            required
            disabled={disabled}
            className="input-cinema mt-1 w-full"
            autoComplete={isBuyer ? "name" : "off"}
            placeholder="Full name"
          />
        </label>

        <label className="block">
          <span className="text-xs text-cinema-700 font-medium">Email</span>
          <input
            type="email"
            value={value.holderEmail}
            onChange={(e) => update({ holderEmail: e.target.value })}
            required
            disabled={disabled}
            className="input-cinema mt-1 w-full"
            autoComplete={isBuyer ? "email" : "off"}
            placeholder="name@example.com"
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="text-xs text-cinema-700 font-medium">
            Mobile <span className="text-cinema-500">(optional)</span>
          </span>
          <input
            type="tel"
            value={value.holderPhone}
            onChange={(e) => update({ holderPhone: e.target.value })}
            disabled={disabled}
            className="input-cinema mt-1 w-full"
            autoComplete={isBuyer ? "tel" : "off"}
            placeholder="04xx xxx xxx"
          />
        </label>
      </div>

      <div className="space-y-2 pt-1">
        <ConsentCheckbox
          label="Send me show updates and trivia between shows by email"
          checked={value.holderEmailOptIn}
          onChange={(checked) => update({ holderEmailOptIn: checked })}
          disabled={disabled || !value.holderEmail.trim()}
        />
        <ConsentCheckbox
          label="Send me reminders by SMS (mobile required)"
          checked={value.holderSmsOptIn}
          onChange={(checked) => update({ holderSmsOptIn: checked })}
          disabled={disabled || !value.holderPhone.trim()}
        />
      </div>

      {!isBuyer && (
        <p className="text-[11px] text-cinema-500 leading-snug">
          We send each ticket-holder their own ticket and consent confirmation. The buyer
          cannot tick boxes on their behalf — the guest will receive an email letting them
          confirm or change their own preferences.
        </p>
      )}
    </div>
  );
}

interface ConsentCheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

function ConsentCheckbox({ label, checked, onChange, disabled }: ConsentCheckboxProps) {
  return (
    <label
      className={`flex items-start gap-2 p-2 bg-cinema-50 border border-cinema-200 rounded-lg ${
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
      }`}
    >
      <div className="relative flex-shrink-0 mt-0.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only peer"
        />
        <div className="w-5 h-5 border-2 border-cinema-300 rounded peer-checked:border-primary peer-checked:bg-primary transition-all flex items-center justify-center">
          {checked && <Check className="w-3 h-3 text-cinema font-bold" />}
        </div>
      </div>
      <span className="text-xs text-cinema-800">{label}</span>
    </label>
  );
}
