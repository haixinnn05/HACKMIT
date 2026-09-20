"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check } from "@phosphor-icons/react";
import { MozaicMark, TicketRange } from "@/components/Brand";
import { Card, Pill, StickyAction } from "@/components/ui";
import { saveVisitFormAction } from "@/app/actions";
import type { ResolvedVisitField, VisitOrigin } from "@/lib/visit-forms";

const ORIGIN: Record<VisitOrigin, { label: string; tone: "mint" | "peach" | "iris" }> = {
  passport: { label: "From their passport", tone: "mint" },
  marked_unknown: { label: "They marked this unknown", tone: "peach" },
  not_in_passport: { label: "Fill at this visit", tone: "iris" },
};

type Holder = { name: string; age: string | null; sex: string | null; location: string | null };

function SignaturePad({ name, value, onChange }: { name: string; value: string; onChange: (next: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const sized = useRef(false);
  const fromPad = useRef(false);
  const onChangeRef = useRef(onChange);
  const [inking, setInking] = useState(false);
  onChangeRef.current = onChange;

  const paint = (dataUrl: string) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !dataUrl) return;
    const image = new Image();
    image.onload = () => ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    image.src = dataUrl;
  };

  const commit = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    fromPad.current = true;
    onChangeRef.current(canvas.toDataURL("image/png"));
    setInking(false);
  };

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!sized.current) {
      canvas.width = 640;
      canvas.height = 220;
      sized.current = true;
      if (value) paint(value);
      return;
    }
    if (fromPad.current) {
      fromPad.current = false;
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (value) paint(value);
  }, [value]);

  useEffect(() => {
    const finish = () => {
      if (!drawing.current) return;
      drawing.current = false;
      commit();
    };
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
    window.addEventListener("mouseup", finish);
    return () => {
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      window.removeEventListener("mouseup", finish);
    };
  }, []);

  const point = (event: { clientX: number; clientY: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const box = canvas.getBoundingClientRect();
    return { x: (event.clientX - box.left) * (canvas.width / box.width), y: (event.clientY - box.top) * (canvas.height / box.height) };
  };

  const stroke = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.lineTo(x, y);
    ctx.strokeStyle = "#0e0d63";
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  };

  const start = (event: React.PointerEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    drawing.current = true;
    setInking(true);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    const { x, y } = point(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
    if ("pointerId" in event) event.currentTarget.setPointerCapture(event.pointerId);
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    const { x, y } = point(event);
    stroke(ctx, x, y);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    fromPad.current = true;
    setInking(false);
    onChangeRef.current("");
  };

  return (
    <div>
      <input type="hidden" name={name} value={value} />
      <div className="relative mt-1">
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onMouseDown={start}
          onMouseMove={move}
          className="relative z-10 h-28 w-full touch-none rounded-[14px] border border-rule bg-sunken"
        />
        {value && !inking ? (
          <img
            src={value}
            alt=""
            className="pointer-events-none absolute inset-0 z-20 h-28 w-full rounded-[14px]"
          />
        ) : null}
      </div>
      <button type="button" onClick={clear} className="mt-1 text-[12.5px] font-bold text-iris">Clear</button>
    </div>
  );
}

/**
 * Staff visit packet. The passport sits on the form; tap it to fill what the
 * person shared, then confirm and sign.
 */
export function VisitForm({
  token, packId, visitName, fields, holder, saved = {},
}: { token: string; packId: string; visitName: string | null; fields: ResolvedVisitField[]; holder: Holder; saved?: Record<string, string> }) {
  const ready = fields.filter((field) => field.origin === "passport");
  const sections = [...new Set(fields.map((field) => field.section))];
  const [applied, setApplied] = useState(() => fields.some((field) => field.origin === "passport" && saved[field.id]));
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((field) => [field.id, saved[field.id] ?? (field.id === "consent_date" ? field.value : "")])));

  const usePassport = () => {
    setValues((current) => Object.fromEntries(fields.map((field) => [
      field.id,
      field.origin === "passport" || field.id === "consent_date" ? field.value : (current[field.id] ?? ""),
    ])));
    setApplied(true);
  };

  const set = (id: string, value: string) => setValues((current) => ({ ...current, [id]: value }));

  const control = (field: ResolvedVisitField) => {
    const name = `f_${field.id}`;
    const value = values[field.id] ?? "";
    const filled = applied && field.origin === "passport";
    const cls = `mt-1 w-full rounded-[14px] border bg-surface px-3.5 text-[14px] text-ink placeholder:text-ink-faint ${filled ? "border-mint" : "border-rule"}`;
    if (field.kind === "signature") return <SignaturePad name={name} value={value} onChange={(next) => set(field.id, next)} />;
    if (field.kind === "choice") {
      return (
        <select name={name} value={value} onChange={(event) => set(field.id, event.target.value)} className={`${cls} min-h-12`}>
          <option value="">Not recorded</option>
          {field.options?.map((option) => <option key={option}>{option}</option>)}
        </select>
      );
    }
    if (field.kind === "longtext") {
      return <textarea name={name} rows={2} value={value} onChange={(event) => set(field.id, event.target.value)} className={`${cls} py-2.5`} />;
    }
    return (
      <input
        name={name} type={field.kind === "number" ? "number" : "text"} value={value}
        onChange={(event) => set(field.id, event.target.value)}
        placeholder={field.origin === "marked_unknown" ? "I don't know" : ""}
        className={`${cls} min-h-12`}
      />
    );
  };

  return (
    <>
      <button type="button" onClick={usePassport} disabled={applied} aria-pressed={applied} className="ticket w-full text-left disabled:opacity-100">
        <div className="ticket-top ticket-top-fill relative overflow-hidden rounded-t-[26px] px-5 pb-6 pt-4 text-white">
          <TicketRange />
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <MozaicMark tone="white" className="h-7 w-auto" />
              <p className="text-[12.5px] font-extrabold tracking-[0.14em]">MOZAIC PASSPORT</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[10.5px] font-bold ${applied ? "bg-white text-iris-deep" : "bg-white/18 text-white"}`}>
              {applied ? "Applied" : "Ready"}
            </span>
          </div>
          <p className="relative mt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-white/70">Passport holder</p>
          <p className="relative text-[1.5rem] font-bold leading-tight tracking-[-0.02em]">{holder.name}</p>
          <dl className="relative mt-3.5 grid grid-cols-[auto_auto_1fr] gap-x-6">
            {([["Age", holder.age], ["Sex", holder.sex], ["From", holder.location]] as const).map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/75">{label}</dt>
                <dd className={`truncate text-[14px] font-bold ${value ? "" : "italic text-white/60"}`}>{value ?? "Not set"}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="ticket-stub -mt-px rounded-b-[26px] bg-surface px-5 pb-4 pt-3">
          <div aria-hidden className="mx-2 border-t-2 border-dashed border-rule-strong" />
          <span className={`mt-3 flex min-h-12 items-center justify-center gap-2 rounded-full text-[14px] font-bold ${applied ? "bg-mint text-white" : "bg-iris text-white"}`}>
            {applied ? <><Check size={16} weight="bold" /> Filled {ready.length} answers</> : `Use this passport · ${ready.length} answers`}
          </span>
        </div>
      </button>

      <p className="text-[13px] leading-relaxed text-ink-soft">
        {applied ? `${ready.length} answers filled from their passport.` : "Tap the passport to fill what they shared."}
      </p>

      <form action={saveVisitFormAction} className="space-y-4">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="pack" value={packId} />
        {visitName ? <input type="hidden" name="visitName" value={visitName} /> : null}

        {sections.map((section) => (
          <Card key={section} className="space-y-3.5 p-4">
            <h2 className="text-[14px] font-bold text-ink">{section}</h2>
            {fields.filter((field) => field.section === section).map((field) => {
              const Tag = field.kind === "signature" ? "div" : "label";
              return (
                <Tag key={field.id} className="block text-[12.5px] font-semibold text-ink">
                  <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                    {field.label}
                    {applied || !field.source ? <Pill tone={ORIGIN[field.origin].tone}>{ORIGIN[field.origin].label}</Pill> : null}
                  </span>
                  {control(field)}
                  {field.help ? <span className="mt-1 block text-[11.5px] font-normal text-ink-faint">{field.help}</span> : null}
                </Tag>
              );
            })}
          </Card>
        ))}

        <StickyAction>
          <button type="submit" className="press cta inline-flex min-h-12 w-full items-center justify-center rounded-full text-[15px] font-bold text-white">
            Save this packet
          </button>
        </StickyAction>
      </form>
    </>
  );
}
