"use client";

import { useCallback, useState } from "react";
import { GripVertical, Plus, Sunrise, Sunset, X } from "lucide-react";
import {
  doctorPatientPageFormInputClass,
  doctorRoutineAmPmColumnClass,
} from "@/components/doctor/DoctorUiPrimitives";
import { DoctorQuickSnippetPalette } from "@/components/doctor/DoctorQuickSnippetPalette";
import {
  doctorRoutineSnippetGroups,
  readDoctorSnippetFromDataTransfer,
} from "@/src/lib/doctorQuickSnippets";

export type RoutinePlanRow = {
  name: string;
  product: string;
  dosage: string;
};

type RoutineKind = "am" | "pm";

type DoctorRoutinePlanEditorProps = {
  amRows: RoutinePlanRow[];
  pmRows: RoutinePlanRow[];
  onAmRowsChange: (rows: RoutinePlanRow[]) => void;
  onPmRowsChange: (rows: RoutinePlanRow[]) => void;
  onDirty: () => void;
};

function emptyRow(): RoutinePlanRow {
  return { name: "", product: "", dosage: "" };
}

function reorderRows<T>(rows: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= rows.length || to >= rows.length) {
    return rows;
  }
  const next = [...rows];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function RoutineColumn({
  kind,
  title,
  icon: Icon,
  rows,
  onRowsChange,
  onDirty,
  columnClassName,
}: {
  kind: RoutineKind;
  title: string;
  icon: typeof Sunrise;
  rows: RoutinePlanRow[];
  onRowsChange: (rows: RoutinePlanRow[]) => void;
  onDirty: () => void;
  columnClassName: string;
}) {
  const [dragRowIndex, setDragRowIndex] = useState<number | null>(null);
  const [dropRowIndex, setDropRowIndex] = useState<number | null>(null);

  const addRow = useCallback(
    (prefill?: Partial<RoutinePlanRow>) => {
      onDirty();
      onRowsChange([...rows, { ...emptyRow(), ...prefill }]);
    },
    [onDirty, onRowsChange, rows]
  );

  const updateRow = useCallback(
    (index: number, patch: Partial<RoutinePlanRow>) => {
      onDirty();
      onRowsChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
    },
    [onDirty, onRowsChange, rows]
  );

  const removeRow = useCallback(
    (index: number) => {
      onDirty();
      onRowsChange(rows.filter((_, i) => i !== index));
    },
    [onDirty, onRowsChange, rows]
  );

  const applySnippetToColumn = useCallback(
    (snippet: string) => {
      const trimmed = snippet.trim();
      if (!trimmed) return;
      onDirty();
      const emptyIndex = rows.findIndex((r) => !r.name.trim());
      if (emptyIndex >= 0) {
        updateRow(emptyIndex, { name: trimmed });
        return;
      }
      addRow({ name: trimmed });
    },
    [addRow, onDirty, rows, updateRow]
  );

  const handleColumnDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const snippet = readDoctorSnippetFromDataTransfer(e.dataTransfer);
      if (snippet) applySnippetToColumn(snippet);
    },
    [applySnippetToColumn]
  );

  const handleFieldDrop = useCallback(
    (e: React.DragEvent, index: number, field: keyof RoutinePlanRow) => {
      e.preventDefault();
      e.stopPropagation();
      const snippet = readDoctorSnippetFromDataTransfer(e.dataTransfer);
      if (!snippet) return;
      onDirty();
      updateRow(index, { [field]: snippet });
    },
    [onDirty, updateRow]
  );

  const finishRowReorder = useCallback(
    (toIndex: number) => {
      if (dragRowIndex == null || dragRowIndex === toIndex) {
        setDragRowIndex(null);
        setDropRowIndex(null);
        return;
      }
      onDirty();
      onRowsChange(reorderRows(rows, dragRowIndex, toIndex));
      setDragRowIndex(null);
      setDropRowIndex(null);
    },
    [dragRowIndex, onDirty, onRowsChange, rows]
  );

  return (
    <div
      className={`${columnClassName} ${doctorRoutineAmPmColumnClass}`}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDrop={handleColumnDrop}
    >
      <div className="mb-2 flex items-center justify-between gap-1">
        <span className="flex items-center gap-1 text-xs font-semibold text-[#2C3E6B]">
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {title}
        </span>
        <button
          type="button"
          onClick={() => addRow()}
          className="inline-flex h-6 items-center gap-1 rounded-md border border-dashed border-[#2C3E6B]/25 px-1.5 text-[10px] font-semibold text-[#2C3E6B]/70 hover:bg-[#F6F4EB]"
        >
          <Plus className="h-3 w-3" aria-hidden />
          Add step
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="mb-2 rounded-md border border-dashed border-[#2C3E6B]/15 px-2 py-3 text-center text-[10px] text-[#2C3E6B]/50">
          Drag a quick phrase here or add a step
        </p>
      ) : null}

      {rows.map((row, i) => (
        <div
          key={`${kind}-row-${i}`}
          className={`grid grid-cols-[1rem_1rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_1.25rem] items-center gap-1 py-1 ${
            dropRowIndex === i ? "rounded-md bg-[#2C3E6B]/5 ring-1 ring-[#2C3E6B]/20" : ""
          }`}
          onDragOver={(e) => {
            if (dragRowIndex != null) {
              e.preventDefault();
              setDropRowIndex(i);
            }
          }}
          onDragLeave={() => {
            if (dropRowIndex === i) setDropRowIndex(null);
          }}
          onDrop={(e) => {
            if (dragRowIndex != null) {
              e.preventDefault();
              finishRowReorder(i);
              return;
            }
            handleColumnDrop(e);
          }}
        >
          <button
            type="button"
            draggable
            title="Drag to reorder"
            aria-label={`Reorder ${title} step ${i + 1}`}
            onDragStart={(e) => {
              setDragRowIndex(i);
              e.dataTransfer.setData("text/plain", `routine-row-${kind}-${i}`);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragEnd={() => {
              setDragRowIndex(null);
              setDropRowIndex(null);
            }}
            className="flex h-5 w-5 cursor-grab items-center justify-center rounded text-[#2C3E6B]/40 hover:bg-[#F6F4EB] active:cursor-grabbing"
          >
            <GripVertical className="h-3 w-3" aria-hidden />
          </button>
          <span className="text-center text-[10px] font-bold text-[#2C3E6B]">{i + 1}</span>
          <input
            value={row.name}
            onChange={(e) => updateRow(i, { name: e.target.value })}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => handleFieldDrop(e, i, "name")}
            className={`${doctorPatientPageFormInputClass} py-1.5 text-xs`}
            placeholder="Step"
          />
          <input
            value={row.product}
            onChange={(e) => updateRow(i, { product: e.target.value })}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => handleFieldDrop(e, i, "product")}
            className={`${doctorPatientPageFormInputClass} py-1.5 text-xs`}
            placeholder="Product"
          />
          <input
            value={row.dosage}
            onChange={(e) => updateRow(i, { dosage: e.target.value })}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => handleFieldDrop(e, i, "dosage")}
            className={`${doctorPatientPageFormInputClass} py-1.5 text-xs`}
            placeholder="Dose"
          />
          <button
            type="button"
            title="Remove step"
            aria-label={`Remove ${title} step ${i + 1}`}
            onClick={() => removeRow(i)}
            className="flex h-5 w-5 items-center justify-center rounded text-red-500 hover:bg-red-50"
          >
            <X className="h-3 w-3" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}

export function DoctorRoutinePlanEditor({
  amRows,
  pmRows,
  onAmRowsChange,
  onPmRowsChange,
  onDirty,
}: DoctorRoutinePlanEditorProps) {
  const snippetGroups = doctorRoutineSnippetGroups();

  return (
    <div className="space-y-3">
      <DoctorQuickSnippetPalette
        groups={snippetGroups}
        customPhraseScope="routine"
        hint="Drag onto AM/PM steps (or a Step/Product/Dose field). Click to add to the first empty step."
        onInsert={(text) => {
          onDirty();
          const amEmpty = amRows.findIndex((r) => !r.name.trim());
          if (amEmpty >= 0) {
            onAmRowsChange(
              amRows.map((r, i) => (i === amEmpty ? { ...r, name: text } : r))
            );
            return;
          }
          const pmEmpty = pmRows.findIndex((r) => !r.name.trim());
          if (pmEmpty >= 0) {
            onPmRowsChange(
              pmRows.map((r, i) => (i === pmEmpty ? { ...r, name: text } : r))
            );
            return;
          }
          onAmRowsChange([...amRows, { name: text, product: "", dosage: "" }]);
        }}
      />

      <div className="flex flex-col gap-3 md:grid md:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)] md:items-stretch md:gap-0">
        <RoutineColumn
          kind="am"
          title="AM"
          icon={Sunrise}
          rows={amRows}
          onRowsChange={onAmRowsChange}
          onDirty={onDirty}
          columnClassName="md:pr-4"
        />
        <div
          className="h-px w-full shrink-0 bg-[#2C3E6B]/50 md:h-auto md:w-px md:self-stretch"
          role="separator"
          aria-hidden
        />
        <RoutineColumn
          kind="pm"
          title="PM"
          icon={Sunset}
          rows={pmRows}
          onRowsChange={onPmRowsChange}
          onDirty={onDirty}
          columnClassName="md:pl-4"
        />
      </div>
    </div>
  );
}
