"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Static reference data
// ---------------------------------------------------------------------------
interface SubstanceTemplate {
  un: string;
  variation: string;
  class: string;
  subclasses?: string;
  packingGroup?: string;
  sgg?: string;
  fire: string;
  spillage: string;
  stowage?: string;
  caaRequired?: boolean;
  defaultName: string;
  defaults?: Partial<FlagState>;
}

const UN_DB: SubstanceTemplate[] = [
  {
    un: "3327",
    variation: "RADIOACTIVE MATERIAL, TYPE A PACKAGE, FISSILE",
    class: "7",
    fire: "I",
    spillage: "S",
    stowage: "A",
    caaRequired: true,
    defaultName: "RADIOACTIVE MATERIAL, TYPE A PACKAGE, FISSILE",
  },
  {
    un: "1170",
    variation: "ETHANOL (ETHYL ALCOHOL)",
    class: "3",
    packingGroup: "II",
    sgg: "—",
    fire: "F-E",
    spillage: "S-D",
    stowage: "A",
    defaultName: "ETHANOL",
  },
  {
    un: "1203",
    variation: "MOTOR SPIRIT / GASOLINE / PETROL",
    class: "3",
    packingGroup: "II",
    fire: "F-E",
    spillage: "S-E",
    stowage: "B",
    defaultName: "GASOLINE",
  },
  {
    un: "1090",
    variation: "ACETONE",
    class: "3",
    packingGroup: "II",
    fire: "F-E",
    spillage: "S-D",
    stowage: "B",
    defaultName: "ACETONE",
  },
  {
    un: "1219",
    variation: "ISOPROPANOL (ISOPROPYL ALCOHOL)",
    class: "3",
    packingGroup: "II",
    fire: "F-E",
    spillage: "S-D",
    stowage: "B",
    defaultName: "ISOPROPANOL",
  },
  {
    un: "1263",
    variation: "PAINT (flammable)",
    class: "3",
    packingGroup: "II",
    fire: "F-E",
    spillage: "S-E",
    stowage: "B",
    defaultName: "PAINT",
  },
  {
    un: "1993",
    variation: "FLAMMABLE LIQUID, N.O.S.",
    class: "3",
    packingGroup: "II",
    fire: "F-E",
    spillage: "S-E",
    stowage: "B",
    defaultName: "FLAMMABLE LIQUID, N.O.S.",
  },
  {
    un: "1789",
    variation: "HYDROCHLORIC ACID",
    class: "8",
    packingGroup: "II",
    sgg: "SGG1",
    fire: "F-A",
    spillage: "S-B",
    stowage: "B",
    defaultName: "HYDROCHLORIC ACID",
  },
  {
    un: "1830",
    variation: "SULPHURIC ACID (>51% acid)",
    class: "8",
    packingGroup: "II",
    sgg: "SGG1",
    fire: "F-A",
    spillage: "S-B",
    stowage: "C",
    defaultName: "SULPHURIC ACID",
  },
  {
    un: "1824",
    variation: "SODIUM HYDROXIDE SOLUTION",
    class: "8",
    packingGroup: "II",
    sgg: "SGG18",
    fire: "F-A",
    spillage: "S-B",
    stowage: "A",
    defaultName: "SODIUM HYDROXIDE SOLUTION",
    defaults: { solution: true },
  },
  {
    un: "1950",
    variation: "AEROSOLS, flammable",
    class: "2.1",
    fire: "F-D",
    spillage: "S-U",
    stowage: "B",
    defaultName: "AEROSOLS",
  },
  {
    un: "1075",
    variation: "PETROLEUM GASES, LIQUEFIED (LPG)",
    class: "2.1",
    fire: "F-D",
    spillage: "S-U",
    stowage: "E",
    defaultName: "PETROLEUM GASES, LIQUEFIED",
  },
  {
    un: "1978",
    variation: "PROPANE",
    class: "2.1",
    fire: "F-D",
    spillage: "S-U",
    stowage: "E",
    defaultName: "PROPANE",
  },
  {
    un: "1428",
    variation: "SODIUM (metal)",
    class: "4.3",
    packingGroup: "I",
    sgg: "SGG2",
    fire: "F-G",
    spillage: "S-N",
    stowage: "D",
    defaultName: "SODIUM",
  },
  {
    un: "2814",
    variation: "INFECTIOUS SUBSTANCE, AFFECTING HUMANS",
    class: "6.2",
    fire: "F-A",
    spillage: "S-T",
    stowage: "A",
    defaultName: "INFECTIOUS SUBSTANCE, AFFECTING HUMANS",
  },
  {
    un: "2794",
    variation: "BATTERIES, WET, FILLED WITH ACID",
    class: "8",
    sgg: "SGG1",
    fire: "F-A",
    spillage: "S-B",
    stowage: "A",
    defaultName: "BATTERIES, WET, FILLED WITH ACID",
  },
  {
    un: "3480",
    variation: "LITHIUM ION BATTERIES",
    class: "9",
    fire: "F-A",
    spillage: "S-I",
    stowage: "A",
    defaultName: "LITHIUM ION BATTERIES",
  },
  {
    un: "3481",
    variation: "LITHIUM ION BATTERIES PACKED WITH EQUIPMENT",
    class: "9",
    fire: "F-A",
    spillage: "S-I",
    stowage: "A",
    defaultName: "LITHIUM ION BATTERIES PACKED WITH EQUIPMENT",
  },
  {
    un: "3082",
    variation: "ENVIRONMENTALLY HAZARDOUS SUBSTANCE, LIQUID, N.O.S.",
    class: "9",
    packingGroup: "III",
    fire: "F-A",
    spillage: "S-F",
    stowage: "A",
    defaultName: "ENVIRONMENTALLY HAZARDOUS SUBSTANCE, LIQUID, N.O.S.",
    defaults: { marinePollutant: true },
  },
  {
    un: "0027",
    variation: "BLACK POWDER (gunpowder), granular or as a meal",
    class: "1",
    subclasses: "1.1D",
    fire: "F-B",
    spillage: "S-Y",
    stowage: "—",
    defaultName: "BLACK POWDER",
  },
];

const SEGREGATION_GROUPS = [
  "SGG1 — Acids",
  "SGG2 — Ammonium compounds",
  "SGG3 — Bromates",
  "SGG4 — Chlorates",
  "SGG5 — Chlorites",
  "SGG6 — Cyanides",
  "SGG7 — Heavy metals and their salts",
  "SGG8 — Hypochlorites",
  "SGG9 — Lead and its compounds",
  "SGG10 — Liquid halogenated hydrocarbons",
  "SGG11 — Mercury and mercury compounds",
  "SGG12 — Nitrites and their mixtures",
  "SGG13 — Perchlorates",
  "SGG14 — Permanganates",
  "SGG15 — Powdered metals",
  "SGG16 — Peroxides",
  "SGG17 — Azides",
  "SGG18 — Alkalis",
];

const STOWAGE_CATEGORIES = ["A", "B", "C", "D", "E"];

const PACKAGING_CATEGORIES = [
  "Drums",
  "Boxes",
  "Jerricans",
  "Bags",
  "Cylinders",
  "IBC",
  "Pressure receptacles",
];

const PRIMARY_PACKAGING_BY_CATEGORY: Record<string, string[]> = {
  Drums: [
    "1A1 — Steel, non-removable head",
    "1A2 — Steel, removable head",
    "1B1 — Aluminium, non-removable head",
    "1H1 — Plastics, non-removable head",
    "1H2 — Plastics, removable head",
    "1G — Fibre",
  ],
  Boxes: [
    "4A — Steel",
    "4C1 — Natural wood, ordinary",
    "4D — Plywood",
    "4G — Fibreboard",
    "4H1 — Expanded plastics",
    "4H2 — Solid plastics",
  ],
  Jerricans: [
    "3A1 — Steel, non-removable head",
    "3A2 — Steel, removable head",
    "3H1 — Plastics, non-removable head",
    "3H2 — Plastics, removable head",
  ],
  Bags: ["5H1 — Woven plastics", "5H4 — Plastics film", "5L3 — Textile, sift-proof", "5M2 — Paper, multi-wall, water resistant"],
  Cylinders: ["UN cylinder", "Composite cylinder", "Pressure drum"],
  IBC: ["11A — Metal", "13H — Rigid plastics", "31A — Liquid metal", "31H1 — Liquid rigid plastics"],
  "Pressure receptacles": ["Tube", "Pressure drum", "Bundle"],
};

const INNER_PACKAGING = [
  "Not applicable",
  "Glass bottles",
  "Plastic bottles",
  "Metal cans",
  "Plastic bags (sift-proof)",
  "Ampoules",
];

// ---------------------------------------------------------------------------
// Flag definitions (the toggle row from the screenshot)
// ---------------------------------------------------------------------------
type FlagKey =
  | "marinePollutant"
  | "emptyUncleaned"
  | "waste"
  | "mixture"
  | "solution"
  | "sample"
  | "hot"
  | "molten"
  | "stabilized"
  | "coolant"
  | "conditioner"
  | "limitedQuantity"
  | "exceptedQuantity";

type FlagState = Record<FlagKey, boolean>;

const FLAG_COLUMNS: { id: FlagKey; label: string }[][] = [
  [
    { id: "marinePollutant", label: "Marine Pollutant" },
    { id: "sample", label: "Sample" },
    { id: "conditioner", label: "Conditioner" },
  ],
  [
    { id: "emptyUncleaned", label: "Empty uncleaned" },
    { id: "hot", label: "Hot" },
    { id: "limitedQuantity", label: "Limited quantity" },
  ],
  [
    { id: "waste", label: "Waste" },
    { id: "molten", label: "Molten" },
    { id: "exceptedQuantity", label: "Excepted quantity" },
  ],
  [
    { id: "mixture", label: "Mixture" },
    { id: "stabilized", label: "Stabilized" },
  ],
  [
    { id: "solution", label: "Solution" },
    { id: "coolant", label: "Coolant" },
  ],
];

const emptyFlags = (): FlagState => ({
  marinePollutant: false,
  emptyUncleaned: false,
  waste: false,
  mixture: false,
  solution: false,
  sample: false,
  hot: false,
  molten: false,
  stabilized: false,
  coolant: false,
  conditioner: false,
  limitedQuantity: false,
  exceptedQuantity: false,
});

// ---------------------------------------------------------------------------
// Added-substance instance
// ---------------------------------------------------------------------------
interface PackagingItem {
  id: string;
  category: string;
  primary: string;
  quantity: string;
  inner: string;
  innerQuantity: string;
}

interface AddedSubstance {
  id: string;
  tpl: SubstanceTemplate;
  properShippingName: string;
  technicalName: string;
  segregationGroups: string[];
  stowageCategory: string;
  flags: FlagState;
  caa: boolean;
  packaging: PackagingItem[];
}

const newAdded = (tpl: SubstanceTemplate): AddedSubstance => ({
  id: crypto.randomUUID(),
  tpl,
  properShippingName: tpl.defaultName,
  technicalName: "",
  segregationGroups: tpl.sgg && tpl.sgg !== "—" ? [tpl.sgg] : [],
  stowageCategory: tpl.stowage ?? "",
  flags: { ...emptyFlags(), ...(tpl.defaults ?? {}) },
  caa: !!tpl.caaRequired,
  packaging: [
    {
      id: crypto.randomUUID(),
      category: "",
      primary: "",
      quantity: "",
      inner: "Not applicable",
      innerQuantity: "",
    },
  ],
});

// ---------------------------------------------------------------------------
// Class color → DG label-ish palette for the badges
// ---------------------------------------------------------------------------
function classBadgeClasses(cls: string): string {
  const base = "inline-flex h-6 min-w-[2.25rem] items-center justify-center rounded px-1.5 text-xs font-bold ring-1 ring-inset";
  const major = cls.split(".")[0];
  switch (major) {
    case "1":
      return `${base} bg-orange-500 text-white ring-orange-600/30`;
    case "2":
      return `${base} bg-emerald-500 text-white ring-emerald-600/30`;
    case "3":
      return `${base} bg-red-600 text-white ring-red-700/30`;
    case "4":
      return `${base} bg-amber-600 text-white ring-amber-700/30`;
    case "5":
      return `${base} bg-yellow-400 text-stone-900 ring-yellow-500/40`;
    case "6":
      return `${base} bg-white text-stone-900 ring-stone-400`;
    case "7":
      return `${base} bg-yellow-300 text-stone-900 ring-yellow-500/40`;
    case "8":
      return `${base} bg-stone-800 text-white ring-stone-900/40`;
    case "9":
      return `${base} bg-zinc-700 text-white ring-zinc-800/40`;
    default:
      return `${base} bg-slate-200 text-slate-800 ring-slate-300`;
  }
}

// ===========================================================================
export default function DangerousGoodsPage() {
  const [added, setAdded] = useState<AddedSubstance[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = added.find((s) => s.id === selectedId) ?? null;

  const updateSelected = (patch: Partial<AddedSubstance>) => {
    if (!selectedId) return;
    setAdded((list) =>
      list.map((s) => (s.id === selectedId ? { ...s, ...patch } : s)),
    );
  };

  const addSubstance = (tpl: SubstanceTemplate) => {
    const inst = newAdded(tpl);
    setAdded((list) => [...list, inst]);
    setSelectedId(inst.id);
  };

  const removeSubstance = (id: string) => {
    setAdded((list) => list.filter((s) => s.id !== id));
    if (selectedId === id) {
      const remaining = added.filter((s) => s.id !== id);
      setSelectedId(remaining.length ? remaining[remaining.length - 1].id : null);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <Sidebar
        added={added}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onAdd={addSubstance}
        onRemove={removeSubstance}
      />

      <main className="flex-1 min-w-0">
        {selected ? (
          <DetailForm key={selected.id} item={selected} onChange={updateSelected} />
        ) : (
          <EmptyState hasAny={added.length > 0} />
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------
function Sidebar({
  added,
  selectedId,
  onSelect,
  onAdd,
  onRemove,
}: {
  added: AddedSubstance[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: (tpl: SubstanceTemplate) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <aside className="sticky top-0 flex h-screen w-[340px] shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <h1 className="text-base font-semibold tracking-tight">
          Dangerous Goods
        </h1>
        <p className="text-xs text-slate-500">
          Add UN substances and complete the details for each.
        </p>
      </div>

      <div className="border-b border-slate-200 p-4">
        <SubstanceSearch
          onPick={onAdd}
          alreadyAddedUns={added.map((s) => s.tpl.un)}
        />
      </div>

      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Added ({added.length})
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {added.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-slate-400">
            No substances yet. Search above to add your first one.
          </div>
        ) : (
          <ul className="space-y-1">
            {added.map((s, idx) => (
              <li key={s.id}>
                <SidebarItem
                  index={idx + 1}
                  substance={s}
                  selected={s.id === selectedId}
                  onClick={() => onSelect(s.id)}
                  onRemove={() => onRemove(s.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

function SidebarItem({
  index,
  substance,
  selected,
  onClick,
  onRemove,
}: {
  index: number;
  substance: AddedSubstance;
  selected: boolean;
  onClick: () => void;
  onRemove: () => void;
}) {
  const filledPackaging = substance.packaging.filter(
    (p) => p.category && p.primary,
  ).length;
  const totalPackaging = substance.packaging.length;
  const incomplete =
    !substance.properShippingName || filledPackaging < totalPackaging;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={[
        "group relative cursor-pointer rounded-lg border px-3 py-2.5 transition",
        selected
          ? "border-teal-500 bg-teal-50/70 shadow-sm"
          : "border-transparent hover:border-slate-200 hover:bg-slate-50",
      ].join(" ")}
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 text-[10px] font-medium text-slate-400 tabular-nums">
          {String(index).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={classBadgeClasses(substance.tpl.class)}>
              {substance.tpl.class}
            </span>
            <span className="text-sm font-semibold tabular-nums">
              UN {substance.tpl.un}
            </span>
            {incomplete && (
              <span
                className="ml-auto h-1.5 w-1.5 rounded-full bg-amber-400"
                title="Incomplete"
              />
            )}
          </div>
          <p
            className="mt-1 truncate text-xs text-slate-600"
            title={substance.properShippingName}
          >
            {substance.properShippingName || substance.tpl.variation}
          </p>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
            <span>{filledPackaging}/{totalPackaging} pkg</span>
            {substance.flags.marinePollutant && (
              <span className="rounded bg-emerald-100 px-1 text-emerald-700">
                MP
              </span>
            )}
            {substance.flags.waste && (
              <span className="rounded bg-slate-200 px-1 text-slate-700">
                Waste
              </span>
            )}
            {substance.flags.limitedQuantity && (
              <span className="rounded bg-blue-100 px-1 text-blue-700">
                LQ
              </span>
            )}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute right-2 top-2 hidden h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-700 group-hover:flex"
        aria-label="Remove substance"
        title="Remove"
      >
        <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5">
          <path
            d="M5 5l10 10M15 5L5 15"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Search with autocomplete
// ---------------------------------------------------------------------------
function SubstanceSearch({
  onPick,
  alreadyAddedUns,
}: {
  onPick: (tpl: SubstanceTemplate) => void;
  alreadyAddedUns: string[];
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return UN_DB.slice(0, 8);
    return UN_DB.filter(
      (t) =>
        t.un.includes(needle) ||
        t.variation.toLowerCase().includes(needle) ||
        t.defaultName.toLowerCase().includes(needle),
    ).slice(0, 12);
  }, [q]);

  const safeHighlight = Math.min(highlight, Math.max(0, matches.length - 1));

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const pick = (tpl: SubstanceTemplate) => {
    onPick(tpl);
    setQ("");
    setOpen(false);
    setHighlight(0);
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <svg
          viewBox="0 0 20 20"
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          fill="none"
        >
          <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
          <path d="M14 14l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setHighlight((h) => Math.min(matches.length - 1, h + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(0, h - 1));
            } else if (e.key === "Enter" && matches[safeHighlight]) {
              e.preventDefault();
              pick(matches[safeHighlight]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder="Search UN number or name…"
          className="block w-full rounded-md border border-slate-300 bg-white py-2 pl-8 pr-3 text-sm placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
        />
      </div>

      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1 max-h-80 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {matches.length === 0 ? (
            <div className="px-3 py-3 text-xs text-slate-500">
              No matches for &ldquo;{q}&rdquo;
            </div>
          ) : (
            matches.map((t, i) => {
              const isAdded = alreadyAddedUns.includes(t.un);
              return (
                <button
                  type="button"
                  key={t.un + i}
                  onMouseEnter={() => setHighlight(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(t)}
                  className={[
                    "flex w-full items-center gap-2.5 border-b border-slate-100 px-3 py-2 text-left text-xs last:border-b-0",
                    safeHighlight === i ? "bg-teal-50" : "hover:bg-slate-50",
                  ].join(" ")}
                >
                  <span className={classBadgeClasses(t.class)}>{t.class}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold tabular-nums">
                        UN {t.un}
                      </span>
                      {isAdded && (
                        <span className="text-[10px] uppercase tracking-wider text-teal-600">
                          • added
                        </span>
                      )}
                    </div>
                    <p className="truncate text-slate-600">{t.variation}</p>
                  </div>
                  <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-slate-400" fill="none">
                    <path
                      d="M10 4v12M4 10h12"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
function EmptyState({ hasAny }: { hasAny: boolean }) {
  return (
    <div className="flex h-screen items-center justify-center p-10">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-teal-50 text-teal-600">
          <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
            <path
              d="M12 3l9 16H3L12 3z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path d="M12 10v4M12 17h0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </div>
        <h2 className="text-base font-semibold text-slate-800">
          {hasAny ? "Pick a substance to edit" : "Add your first substance"}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {hasAny
            ? "Choose any of the added substances from the sidebar to view and edit its details."
            : "Use the search to add a UN substance. You'll then be able to fill in shipping name, packaging and segregation details."}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail form
// ---------------------------------------------------------------------------
function DetailForm({
  item,
  onChange,
}: {
  item: AddedSubstance;
  onChange: (patch: Partial<AddedSubstance>) => void;
}) {
  const t = item.tpl;

  const setFlag = (k: FlagKey, v: boolean) =>
    onChange({ flags: { ...item.flags, [k]: v } });

  const updatePackaging = (id: string, patch: Partial<PackagingItem>) =>
    onChange({
      packaging: item.packaging.map((p) =>
        p.id === id ? { ...p, ...patch } : p,
      ),
    });

  const addPackagingRow = () =>
    onChange({
      packaging: [
        ...item.packaging,
        {
          id: crypto.randomUUID(),
          category: "",
          primary: "",
          quantity: "",
          inner: "Not applicable",
          innerQuantity: "",
        },
      ],
    });

  const removePackagingRow = (id: string) =>
    onChange({
      packaging: item.packaging.filter((p) => p.id !== id),
    });

  return (
    <div className="mx-auto max-w-[1400px] px-8 py-6">
      {/* Header */}
      <header className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className={classBadgeClasses(t.class)}>{t.class}</span>
          <h2 className="text-sm font-semibold tracking-tight text-slate-800">
            UN {t.un} — {t.variation}
          </h2>
        </div>
      </header>

      {/* Reference info grid */}
      <Section>
        <div className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm md:grid-cols-2 lg:grid-cols-3">
          <ReadOnlyRow label="UN Number" value={t.un} />
          <ReadOnlyRow label="Variation" value={t.variation} />
          <ReadOnlyRow label="Class" value={t.class} />
          <ReadOnlyRow label="Subclass(es)" value={t.subclasses ?? "—"} />
          <ReadOnlyRow label="Packing Group" value={t.packingGroup ?? "—"} />
          <ReadOnlyRow
            label="Segregation Group Codes (SGG)"
            value={t.sgg ?? "—"}
          />
          <div className="col-span-full grid grid-cols-1 gap-x-8 md:grid-cols-2">
            <ReadOnlyRow
              label="Emergency Schedules"
              value={
                <span className="flex flex-wrap gap-2">
                  <span className="rounded bg-red-50 px-1.5 py-0.5 font-mono text-xs text-red-700">
                    Fire: {t.fire}
                  </span>
                  <span className="rounded bg-blue-50 px-1.5 py-0.5 font-mono text-xs text-blue-700">
                    Spillage: {t.spillage}
                  </span>
                </span>
              }
            />
            <div className="flex items-center gap-3 py-1.5">
              <span className="w-44 shrink-0 text-xs text-slate-500">
                Competent authority approval (CAA)
              </span>
              <CheckBox
                checked={item.caa}
                onChange={(v) => onChange({ caa: v })}
              />
            </div>
          </div>
        </div>
      </Section>

      {/* Editable identification */}
      <Section>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Proper shipping name" required>
            <input
              value={item.properShippingName}
              onChange={(e) => onChange({ properShippingName: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="Technical name">
            <input
              value={item.technicalName}
              onChange={(e) => onChange({ technicalName: e.target.value })}
              className={inputCls}
              placeholder="e.g. the chemical or biological name"
            />
          </Field>
          <Field label="Segregation Groups">
            <ChipMultiSelect
              options={SEGREGATION_GROUPS}
              value={item.segregationGroups}
              onChange={(v) => onChange({ segregationGroups: v })}
              placeholder="Select a segregation group"
            />
          </Field>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Stowage Category">
            <select
              value={item.stowageCategory}
              onChange={(e) => onChange({ stowageCategory: e.target.value })}
              className={selectCls}
            >
              <option value="">—</option>
              {STOWAGE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Section>

      {/* Substance contents toggles */}
      <Section title="Substance contents">
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-3 lg:grid-cols-5">
          {FLAG_COLUMNS.map((col, ci) => (
            <div key={ci} className="space-y-2.5">
              {col.map((f) => (
                <Toggle
                  key={f.id}
                  label={f.label}
                  checked={item.flags[f.id]}
                  onChange={(v) => setFlag(f.id, v)}
                />
              ))}
            </div>
          ))}
        </div>
      </Section>

      {/* Packaging */}
      <Section
        title="Packaging configuration"
        subtitle="Start by selecting the Packaging Category. This will then enable you to choose the Packaging Type, and finally the Inner Packaging (if applicable)."
      >
        <div className="space-y-3">
          {item.packaging.map((p, i) => (
            <PackagingRow
              key={p.id}
              index={i + 1}
              item={p}
              canRemove={item.packaging.length > 1}
              onChange={(patch) => updatePackaging(p.id, patch)}
              onRemove={() => removePackagingRow(p.id)}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={addPackagingRow}
          className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-dashed border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:border-teal-500 hover:bg-teal-50 hover:text-teal-700"
        >
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none">
            <path
              d="M10 4v12M4 10h12"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
          Add packaging item
        </button>
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reusable bits
// ---------------------------------------------------------------------------
const inputCls =
  "block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20";
const selectCls = inputCls + " pr-8";

function Section({
  title,
  subtitle,
  children,
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      {title && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold tracking-tight text-slate-800">
            {title}
          </h3>
          {subtitle && (
            <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

function ReadOnlyRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <span className="w-44 shrink-0 text-xs text-slate-500">{label}</span>
      <span className="flex-1 text-sm font-medium text-slate-800">
        {value}
      </span>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-2 text-left"
      role="switch"
      aria-checked={checked}
    >
      <span
        className={[
          "relative inline-block h-5 w-9 shrink-0 rounded-full transition",
          checked ? "bg-teal-600" : "bg-slate-300",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition",
            checked ? "left-[18px]" : "left-0.5",
          ].join(" ")}
        />
      </span>
      <span
        className={[
          "text-sm",
          checked ? "font-medium text-slate-900" : "text-slate-500",
        ].join(" ")}
      >
        {label}
      </span>
    </button>
  );
}

function CheckBox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      role="checkbox"
      aria-checked={checked}
      className={[
        "flex h-5 w-5 items-center justify-center rounded border transition",
        checked
          ? "border-teal-600 bg-teal-600 text-white"
          : "border-slate-300 bg-white hover:border-slate-400",
      ].join(" ")}
    >
      {checked && (
        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none">
          <path
            d="M3 8l3 3 7-7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}

function ChipMultiSelect({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const toggle = (opt: string) => {
    const matched = options.find((o) => o.startsWith(opt.split(" — ")[0])) ?? opt;
    const code = matched.split(" — ")[0];
    if (value.includes(code)) {
      onChange(value.filter((v) => v !== code));
    } else {
      onChange([...value, code]);
    }
  };

  return (
    <div ref={ref} className="relative">
      <div
        onClick={() => setOpen((o) => !o)}
        className={inputCls + " flex min-h-[2.5rem] cursor-pointer flex-wrap items-center gap-1.5"}
      >
        {value.length === 0 ? (
          <span className="text-slate-400">{placeholder}</span>
        ) : (
          value.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 rounded bg-teal-100 px-1.5 py-0.5 text-xs text-teal-800"
            >
              {v}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(value.filter((x) => x !== v));
                }}
                className="text-teal-600 hover:text-teal-900"
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>
      {open && (
        <div className="absolute left-0 right-0 z-20 mt-1 max-h-72 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {options.map((opt) => {
            const code = opt.split(" — ")[0];
            const isOn = value.includes(code);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => toggle(opt)}
                className={[
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs",
                  isOn ? "bg-teal-50 text-teal-900" : "hover:bg-slate-50",
                ].join(" ")}
              >
                <CheckBox checked={isOn} onChange={() => toggle(opt)} />
                <span>{opt}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PackagingRow({
  index,
  item,
  canRemove,
  onChange,
  onRemove,
}: {
  index: number;
  item: PackagingItem;
  canRemove: boolean;
  onChange: (p: Partial<PackagingItem>) => void;
  onRemove: () => void;
}) {
  const primaryOptions =
    PRIMARY_PACKAGING_BY_CATEGORY[item.category] ?? [];

  return (
    <div className="relative rounded-md border border-slate-200 bg-slate-50/60 p-3">
      <div className="flex items-start gap-3">
        <span className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
          {index}
        </span>

        <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-[1fr_1.4fr_140px] lg:grid-cols-[1fr_1.4fr_140px]">
          <Field label="Packaging category" required>
            <select
              value={item.category}
              onChange={(e) =>
                onChange({ category: e.target.value, primary: "" })
              }
              className={selectCls}
            >
              <option value="">Select category…</option>
              {PACKAGING_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Primary packaging" required>
            <select
              disabled={!item.category}
              value={item.primary}
              onChange={(e) => onChange({ primary: e.target.value })}
              className={
                selectCls +
                (!item.category ? " cursor-not-allowed bg-slate-100" : "")
              }
            >
              <option value="">
                {item.category ? "Select packaging…" : "Pick a category first"}
              </option>
              {primaryOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Quantity">
            <input
              type="number"
              min={0}
              value={item.quantity}
              onChange={(e) => onChange({ quantity: e.target.value })}
              placeholder="0"
              className={inputCls}
            />
          </Field>

          <Field label="Inner packaging">
            <select
              value={item.inner}
              onChange={(e) => onChange({ inner: e.target.value })}
              className={selectCls}
            >
              {INNER_PACKAGING.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Inner quantity">
            <input
              type="number"
              min={0}
              disabled={item.inner === "Not applicable"}
              value={item.innerQuantity}
              onChange={(e) => onChange({ innerQuantity: e.target.value })}
              placeholder={item.inner === "Not applicable" ? "—" : "0"}
              className={
                inputCls +
                (item.inner === "Not applicable"
                  ? " cursor-not-allowed bg-slate-100"
                  : "")
              }
            />
          </Field>

          <div className="hidden md:block" />
        </div>
      </div>

      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-700"
          aria-label="Remove packaging item"
          title="Remove"
        >
          <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
            <path
              d="M5 5l10 10M15 5L5 15"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
