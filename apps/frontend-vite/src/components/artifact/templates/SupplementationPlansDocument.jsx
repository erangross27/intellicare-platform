import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { PDFDownloadLink } from "@react-pdf/renderer";
import BlueDatePicker from "../components/BlueDatePicker";
import BlueSelect from "../components/BlueSelect";
import secureApiClient from "../../../services/secureApiClient";
import SupplementationPlansDocumentPDFTemplate from "../pdf-templates/SupplementationPlansDocumentPDFTemplate";
import "./SupplementationPlansDocument.css";

const DRAFT_KEY = "supplementation_plansPendingEdits";
const SECTIONS = [
  { id: "record-info", title: "Record Information", fields: ["date", "type", "provider", "facility"] },
  { id: "supplement", title: "Supplement", fields: ["supplement", "dosage", "condition"] },
  { id: "reasoning", title: "Reasoning", fields: ["reasoning"] },
  { id: "findings", title: "Findings", fields: ["findings"] },
  { id: "assessment", title: "Assessment", fields: ["assessment"] },
  { id: "plan", title: "Plan", fields: ["plan"] },
  { id: "recommendations", title: "Recommendations", fields: ["recommendations"] },
  { id: "results", title: "Results", fields: ["results"] },
  { id: "notes", title: "Notes", fields: ["notes"] },
  { id: "status", title: "Status", fields: ["status"] },
];
const LABELS = {
  date: "Date",
  type: "Plan Type",
  provider: "Provider",
  facility: "Facility",
  supplement: "Supplement",
  dosage: "Dosage",
  condition: "Condition",
  reasoning: "Reasoning",
  findings: "Findings",
  assessment: "Assessment",
  plan: "Plan",
  recommendations: "Recommendations",
  results: "Results",
  notes: "Notes",
  status: "Status",
};
const COMMA_ARRAY_FIELDS = ["reasoning", "findings", "assessment", "plan", "notes"];
const ENUM_OPTIONS = {
  status: ["active", "inactive", "completed", "pending"],
};
const MULTI_NUMBER_FIELDS = ["dosage"];
const readDrafts = () => {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}") || {};
  } catch {
    return {};
  }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length)
      localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* storage unavailable */
  }
};
const recordId = (record) =>
  typeof record?._id === "object" ? record._id.$oid : record?._id;
const humanize = (value) =>
  String(value || "")
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
const getAtPath = (source, path) =>
  String(path)
    .split(".")
    .reduce((value, key) => value?.[key], source);
const setAtPath = (source, path, value) => {
  const parts = Array.isArray(path) ? path : String(path).split(".");
  if (!parts.length) return value;
  const [head, ...tail] = parts;
  const key = /^\d+$/.test(head) ? Number(head) : head;
  const clone = Array.isArray(source)
    ? [...source]
    : { ...(source && typeof source === "object" ? source : {}) };
  clone[key] = setAtPath(clone[key], tail, value);
  return clone;
};
const empty = (value) =>
  value == null ||
  value === "" ||
  (Array.isArray(value)
    ? !value.some((item) => !empty(item))
    : typeof value === "object" && !value.$date
      ? Object.values(value).every(empty)
      : false);
const flatten = (value) =>
  value == null
    ? ""
    : typeof value === "object"
      ? Object.values(value).map(flatten).join(" ")
      : String(value);
const isDate = (value) =>
  Boolean(
    value?.$date ||
    (typeof value === "string" && /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value)),
  );
const formatDate = (value) => {
  try {
    const date = new Date(value?.$date || value);
    return Number.isNaN(date.getTime())
      ? String(value || "")
      : date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
  } catch {
    return String(value || "");
  }
};
const toDateInput = (value) => {
  try {
    return new Date(value?.$date || value).toISOString().slice(0, 10);
  } catch {
    return "";
  }
};
const splitComma = (text) => {
  const rows = [];
  let current = "";
  let depth = 0;
  for (const char of String(text || "")) {
    if (char === "(") {
      depth += 1;
      current += char;
    } else if (char === ")") {
      depth = Math.max(0, depth - 1);
      current += char;
    } else if (char === "," && depth === 0) {
      if (current.trim()) rows.push(current.trim());
      current = "";
    } else current += char;
  }
  if (current.trim()) rows.push(current.trim());
  return rows.length ? rows : [String(text || "")];
};
const parseLabel = (text) => {
  const match = String(text || "").match(
    /^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/,
  );
  return match
    ? { label: match[1].trim(), value: match[2].trim() }
    : { label: "", value: String(text || "") };
};
const splitTokens = (text) => {
  const source = String(text || "");
  const regex =
    /(?:;\s+|(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)\.\s+)/g;
  const tokens = [];
  let start = 0;
  let match;
  while ((match = regex.exec(source))) {
    const value = source.slice(start, match.index).trim();
    if (value) tokens.push({ text: value, separator: match[0] });
    start = match.index + match[0].length;
  }
  let tail = source.slice(start).trim();
  let separator = "";
  const terminal = tail.match(/[.;]\s*$/);
  if (terminal) {
    separator = terminal[0];
    tail = tail.slice(0, -terminal[0].length).trim();
  }
  if (tail) tokens.push({ text: tail, separator });
  return tokens.length ? tokens : [{ text: source.trim(), separator: "" }];
};
const textRows = (path, value) =>
  splitTokens(value).flatMap((token, tokenIndex) => {
    const parsed = parseLabel(token.text);
    const parts = COMMA_ARRAY_FIELDS.includes(path)
      ? splitComma(parsed.value)
      : [parsed.value];
    return parts.map((text, partIndex) => ({
      text,
      label: partIndex === 0 ? parsed.label : "",
      tokenIndex,
      partIndex: parts.length > 1 ? partIndex : null,
    }));
  });
const numericShape = (value) => {
  if (typeof value === "number")
    return { type: "single", number: String(value), suffix: "", typed: true };
  const source = String(value ?? "").trim();
  let match = source.match(
    /^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)([\s\S]*)$/,
  );
  if (match)
    return {
      type: "ratio",
      number: match[1],
      denominator: match[2],
      suffix: match[3] || "",
    };
  match = source.match(/^(-?\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)([\s\S]*)$/);
  if (match)
    return {
      type: "range",
      number: match[1],
      second: match[2],
      suffix: match[3] || "",
    };
  match = source.match(/^(-?\d+(?:\.\d+)?)([\s\S]*)$/);
  return match
    ? { type: "single", number: match[1], suffix: match[2] || "", typed: false }
    : null;
};
const stepFor = (value) => (String(value).includes(".") ? 0.1 : 1);
const numberSegments = (value) =>
  String(value ?? "")
    .split(/(-?\d+(?:\.\d+)?)/g)
    .filter((segment) => segment !== "");
const replaceNumberSegment = (value, numberIndex, nextValue) => {
  let seen = 0;
  return numberSegments(value)
    .map((segment) => {
      if (!/^-?\d+(?:\.\d+)?$/.test(segment)) return segment;
      const replacement = seen === numberIndex ? String(nextValue) : segment;
      seen += 1;
      return replacement;
    })
    .join("");
};

const SupplementationPlansDocument = ({
  document: docProp,
  data,
  templateData,
}) => {
  const records = useMemo(() => {
    const source = templateData || docProp || data;
    if (!source) return [];
    return (Array.isArray(source) ? source : [source])
      .flatMap((record) => {
        if (record?.supplementation_plans)
          return Array.isArray(record.supplementation_plans)
            ? record.supplementation_plans
            : [record.supplementation_plans];
        if (record?.documentData)
          return Array.isArray(record.documentData)
            ? record.documentData
            : record.documentData?.supplementation_plans
              ? Array.isArray(record.documentData.supplementation_plans)
                ? record.documentData.supplementation_plans
                : [record.documentData.supplementation_plans]
              : [record.documentData];
        if (record?.document)
          return Array.isArray(record.document)
            ? record.document
            : [record.document];
        return [record];
      })
      .filter((record) => record && typeof record === "object");
  }, [templateData, docProp, data]);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [localEdits, setLocalEdits] = useState({});
  const [pendingEdits, setPendingEdits] = useState({});
  const [editedRows, setEditedRows] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  const [copied, setCopied] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const containerRef = useRef(null);
  useEffect(() => {
    const store = readDrafts();
    const local = {},
      pending = {},
      rows = {};
    records.forEach((record, idx) =>
      Object.entries(store[recordId(record)] || {}).forEach(([path, value]) => {
        local[`${path}-${idx}`] = value;
        pending[`${path}-${idx}`] = true;
        rows[`${path}-${idx}-r0`] = true;
      }),
    );
    if (Object.keys(local).length) {
      setLocalEdits((previous) => ({ ...local, ...previous }));
      setPendingEdits((previous) => ({ ...pending, ...previous }));
      setEditedRows((previous) => ({ ...rows, ...previous }));
    }
  }, [records]);
  const valueAt = useCallback(
    (record, path, idx) =>
      localEdits[`${path}-${idx}`] !== undefined
        ? localEdits[`${path}-${idx}`]
        : getAtPath(record, path),
    [localEdits],
  );
  const filtered = useMemo(
    () =>
      records
        .map((record, idx) => ({ record, idx }))
        .filter(
          ({ record }) =>
            !searchTerm.trim() ||
            `substance use assessment ${flatten(SECTIONS.flatMap((section) => section.fields.map((field) => record[field])))}`
              .toLowerCase()
              .includes(searchTerm.toLowerCase().trim()),
        ),
    [records, searchTerm],
  );
  const pdfData = useMemo(
    () =>
      filtered.map(({ record, idx }) => {
        let merged = { ...record };
        Object.entries(localEdits).forEach(([key, value]) => {
          if (pendingEdits[key] || !key.endsWith(`-${idx}`)) return;
          merged = setAtPath(merged, key.slice(0, -`-${idx}`.length), value);
        });
        return merged;
      }),
    [filtered, localEdits, pendingEdits],
  );
  const highlight = useCallback(
    (value) => {
      const query = searchTerm.trim();
      if (!query || value == null) return value;
      const regex = new RegExp(
        `(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
        "gi",
      );
      return String(value)
        .split(regex)
        .map((part, index) =>
          index % 2 ? <mark key={index}>{part}</mark> : part,
        );
    },
    [searchTerm],
  );
  const copy = useCallback(async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = window.document.createElement("textarea");
      area.value = text;
      (containerRef.current || window.document.body).appendChild(area);
      area.select();
      window.document.execCommand("copy");
      area.remove();
    }
    setCopied((previous) => ({ ...previous, [key]: true }));
    setTimeout(
      () => setCopied((previous) => ({ ...previous, [key]: false })),
      1600,
    );
  }, []);
  const stage = useCallback((record, path, idx, sectionId, value, rowKey) => {
    const id = recordId(record);
    if (!id) return;
    const key = `${path}-${idx}`;
    setLocalEdits((previous) => ({ ...previous, [key]: value }));
    setPendingEdits((previous) => ({ ...previous, [key]: true }));
    setEditedRows((previous) => ({
      ...previous,
      [rowKey || `${path}-${idx}-r0`]: true,
    }));
    setApprovedSections((previous) => {
      const next = { ...previous };
      delete next[`${sectionId}-${idx}`];
      return next;
    });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][path] = value;
    writeDrafts(store);
    setEditingField(null);
    setEditValue("");
    setSaveError(null);
  }, []);
  const stageMany = useCallback(
    (record, paths, idx, sectionId, value, rowKey) => {
      paths.forEach((path) => {
        const key = `${path}-${idx}`;
        setLocalEdits((previous) => ({ ...previous, [key]: value }));
        setPendingEdits((previous) => ({ ...previous, [key]: true }));
        const store = readDrafts();
        const id = recordId(record);
        if (!store[id]) store[id] = {};
        store[id][path] = value;
        writeDrafts(store);
      });
      setEditedRows((previous) => ({ ...previous, [rowKey]: true }));
      setApprovedSections((previous) => {
        const next = { ...previous };
        delete next[`${sectionId}-${idx}`];
        return next;
      });
      setEditingField(null);
      setEditValue("");
    },
    [],
  );
  const approve = useCallback(
    async (record, idx, section) => {
      const id = recordId(record);
      const suffix = `-${idx}`;
      const keys = Object.keys(localEdits).filter(
        (key) =>
          pendingEdits[key] &&
          key.endsWith(suffix) &&
          section.fields.some((field) => {
            const path = key.slice(0, -suffix.length);
            return path === field || path.startsWith(`${field}.`);
          }),
      );
      setSaving(true);
      try {
        for (const key of keys) {
          const path = key.slice(0, -suffix.length);
          const response = await secureApiClient.put(
            `/api/edit/supplementation_plans/${id}/edit`,
            { field: path, value: localEdits[key] },
          );
          if (response?.success === false)
            throw new Error(response.error || "Save failed");
        }
        await secureApiClient.put(
          `/api/edit/supplementation_plans/${id}/approve`,
          { sectionId: section.id, approved: true },
        );
        setPendingEdits((previous) => {
          const next = { ...previous };
          keys.forEach((key) => delete next[key]);
          return next;
        });
        setEditedRows((previous) => {
          const next = { ...previous };
          Object.keys(next).forEach((key) => {
            if (
              section.fields.some(
                (field) =>
                  key.startsWith(`${field}-`) || key.startsWith(`${field}.`),
              )
            )
              delete next[key];
          });
          return next;
        });
        setApprovedSections((previous) => ({
          ...previous,
          [`${section.id}-${idx}`]: true,
        }));
        const store = readDrafts();
        if (store[id]) {
          keys.forEach((key) => delete store[id][key.slice(0, -suffix.length)]);
          if (!Object.keys(store[id]).length) delete store[id];
          writeDrafts(store);
        }
      } catch (error) {
        console.error(error);
        setSaveError("Approve failed.");
      } finally {
        setSaving(false);
      }
    },
    [localEdits, pendingEdits],
  );
  const saveTextRow = (record, path, idx, sectionId, row, rowKey) => {
    const tokens = splitTokens(String(valueAt(record, path, idx) || ""));
    const token = tokens[row.tokenIndex] || { text: "", separator: "" };
    const parsed = parseLabel(token.text);
    const parts =
      row.partIndex == null ? [parsed.value] : splitComma(parsed.value);
    parts[row.partIndex == null ? 0 : row.partIndex] = editValue
      .replace(/[.;]+$/, "")
      .trim();
    tokens[row.tokenIndex] = {
      ...token,
      text: `${parsed.label ? `${parsed.label}: ` : ""}${parts.join(", ")}`,
    };
    stage(
      record,
      path,
      idx,
      sectionId,
      tokens
        .map((item) => `${item.text}${item.separator}`)
        .join("")
        .trim(),
      rowKey,
    );
  };
  const renderLeaf = (
    record,
    path,
    idx,
    sectionId,
    raw,
    label = "",
    framed = true,
  ) => {
    const current = valueAt(record, path, idx);
    const value = current === undefined ? raw : current;
    if (empty(value)) return null;
    const bool = typeof value === "boolean";
    const date = !bool && isDate(value);
    const enumOptions = ENUM_OPTIONS[path] || null;
    const multiNumber =
      !bool && !date && !enumOptions && MULTI_NUMBER_FIELDS.includes(path)
        ? numberSegments(value)
        : null;
    const numeric =
      !bool && !date && !enumOptions && !multiNumber
        ? numericShape(value)
        : null;
    const display = date
      ? formatDate(value)
      : bool
        ? value
          ? "Yes"
          : "No"
        : String(value);
    const rows =
      bool || date || numeric || enumOptions || multiNumber
        ? [{ text: display, tokenIndex: 0, partIndex: null }]
        : textRows(path, display);
    const sectionTitle =
      SECTIONS.find((section) => section.id === sectionId)?.title || "";
    const visibleLabel =
      label && label.toLowerCase() !== sectionTitle.toLowerCase() ? label : "";
    const body = (
      <>
        {visibleLabel && (
          <div className="nested-subtitle sub-label">
            {highlight(visibleLabel)}
          </div>
        )}
        {rows.map((row, rowIndex) => {
          const rowKey = `${path}-${idx}-r${rowIndex}`;
          const editKey = `${rowKey}-edit`;
          const editing = editingField === editKey;
          const shape = editing && numeric ? numericShape(editValue) : numeric;
          const liveMultiSegments =
            editing && multiNumber ? numberSegments(editValue) : multiNumber;
          const change = (part, direction) => {
            if (!shape) return;
            const next = Number(
              (
                Number(shape[part] || 0) +
                direction * stepFor(shape[part])
              ).toFixed(10),
            );
            if (shape.type === "range")
              setEditValue(
                part === "number"
                  ? `${next}-${shape.second}${shape.suffix}`
                  : `${shape.number}-${next}${shape.suffix}`,
              );
            else if (shape.type === "ratio")
              setEditValue(`${next}/${shape.denominator}${shape.suffix || ""}`);
            else setEditValue(`${next}${shape.suffix}`);
          };
          return (
            <div key={rowKey} data-edit-field={path}>
              {row.label && (
                <div className="nested-subtitle sub-label">
                  {highlight(row.label)}
                </div>
              )}
              <div
                className={`numbered-row editable-row${editedRows[rowKey] ? " modified" : ""}`}
                onClick={() => {
                  if (!editing) {
                    setEditingField(editKey);
                    setEditValue(
                      bool
                        ? value
                          ? "Yes"
                          : "No"
                        : date
                          ? toDateInput(value)
                          : enumOptions
                            ? display
                            : numeric || multiNumber
                              ? display
                              : row.text,
                    );
                    setSaveError(null);
                  }
                }}
              >
                {editing ? (
                  <div className="edit-field-container">
                    {bool ? (
                      <BlueSelect
                        value={editValue}
                        options={["Yes", "No"]}
                        onChange={setEditValue}
                      />
                    ) : date ? (
                      <BlueDatePicker
                        value={editValue}
                        onSelect={setEditValue}
                      />
                    ) : enumOptions ? (
                      <BlueSelect
                        value={editValue}
                        options={enumOptions}
                        onChange={setEditValue}
                      />
                    ) : multiNumber ? (
                      <div className="multi-number-edit-row">
                        {liveMultiSegments.map((segment, segmentIndex) => {
                          if (!/^-?\d+(?:\.\d+)?$/.test(segment))
                            return (
                              <span
                                className="number-edit-unit fixed-number-text"
                                key={`${segmentIndex}-${segment}`}
                              >
                                {segment}
                              </span>
                            );
                          const numberIndex = liveMultiSegments
                            .slice(0, segmentIndex)
                            .filter((part) =>
                              /^-?\d+(?:\.\d+)?$/.test(part),
                            ).length;
                          const changeMulti = (direction) => {
                            const next = Number(
                              (
                                Number(segment) +
                                direction * stepFor(segment)
                              ).toFixed(10),
                            );
                            setEditValue(
                              replaceNumberSegment(
                                editValue,
                                numberIndex,
                                next,
                              ),
                            );
                          };
                          return (
                            <div className="multi-number-control" key={segmentIndex}>
                              <button
                                type="button"
                                className="num-step"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  changeMulti(-1);
                                }}
                              >
                                −
                              </button>
                              <input
                                className="edit-number"
                                inputMode="decimal"
                                value={segment}
                                onChange={(event) =>
                                  setEditValue(
                                    replaceNumberSegment(
                                      editValue,
                                      numberIndex,
                                      event.target.value,
                                    ),
                                  )
                                }
                              />
                              <button
                                type="button"
                                className="num-step"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  changeMulti(1);
                                }}
                              >
                                +
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : numeric ? (
                      <div className="number-edit-row">
                        <button
                          type="button"
                          className="num-step"
                          onClick={(event) => {
                            event.stopPropagation();
                            change("number", -1);
                          }}
                        >
                          −
                        </button>
                        <input
                          className="edit-number"
                          inputMode="decimal"
                          value={shape?.number || ""}
                          onChange={(event) => {
                            const next = event.target.value;
                            if (shape.type === "range")
                              setEditValue(
                                `${next}-${shape.second}${shape.suffix}`,
                              );
                            else if (shape.type === "ratio")
                              setEditValue(`${next}/${shape.denominator}${shape.suffix || ""}`);
                            else setEditValue(`${next}${shape.suffix}`);
                          }}
                        />
                        <button
                          type="button"
                          className="num-step"
                          onClick={(event) => {
                            event.stopPropagation();
                            change("number", 1);
                          }}
                        >
                          +
                        </button>
                        {shape?.type === "range" && (
                          <>
                            <span className="number-edit-unit">–</span>
                            <button
                              type="button"
                              className="num-step"
                              onClick={(event) => {
                                event.stopPropagation();
                                change("second", -1);
                              }}
                            >
                              −
                            </button>
                            <input
                              className="edit-number"
                              inputMode="decimal"
                              value={shape.second}
                              onChange={(event) =>
                                setEditValue(
                                  `${shape.number}-${event.target.value}${shape.suffix}`,
                                )
                              }
                            />
                            <button
                              type="button"
                              className="num-step"
                              onClick={(event) => {
                                event.stopPropagation();
                                change("second", 1);
                              }}
                            >
                              +
                            </button>
                          </>
                        )}
                        {shape?.type === "ratio" && (
                          <span className="number-edit-unit">
                            / {shape.denominator}
                          </span>
                        )}
                        {shape?.suffix && (
                          <span className="number-edit-unit">
                            {shape.suffix}
                          </span>
                        )}
                      </div>
                    ) : (
                      <textarea
                        className="edit-textarea"
                        value={editValue}
                        onChange={(event) => setEditValue(event.target.value)}
                        autoFocus
                      />
                    )}
                    <div className="edit-actions">
                      <button
                        className="save-btn"
                        disabled={saving}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (bool)
                            stage(
                              record,
                              path,
                              idx,
                              sectionId,
                              editValue === "Yes",
                              rowKey,
                            );
                          else if (date)
                            stage(
                              record,
                              path,
                              idx,
                              sectionId,
                              editValue,
                              rowKey,
                            );
                          else if (enumOptions)
                            stage(
                              record,
                              path,
                              idx,
                              sectionId,
                              editValue,
                              rowKey,
                            );
                          else if (multiNumber)
                            stage(
                              record,
                              path,
                              idx,
                              sectionId,
                              editValue,
                              rowKey,
                            );
                          else if (numeric) {
                            const parsed = numericShape(editValue);
                            if (!parsed) {
                              setSaveError("Please enter a valid number");
                              return;
                            }
                            stage(
                              record,
                              path,
                              idx,
                              sectionId,
                              numeric.typed ? Number(parsed.number) : editValue,
                              rowKey,
                            );
                          } else
                            saveTextRow(
                              record,
                              path,
                              idx,
                              sectionId,
                              row,
                              rowKey,
                            );
                        }}
                      >
                        {saving ? "Saving..." : "Save"}
                      </button>
                      <button
                        className="cancel-btn"
                        onClick={(event) => {
                          event.stopPropagation();
                          setEditingField(null);
                          setEditValue("");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content">
                      <span className="content-value">
                        {highlight(row.text)}
                      </span>
                      <span className="edit-indicator">✎</span>
                    </div>
                    <button
                      className={`copy-btn${copied[rowKey] ? " copied" : ""}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        copy(row.text, rowKey);
                      }}
                    >
                      {copied[rowKey] ? "Copied!" : "Copy"}
                    </button>
                  </>
                )}
              </div>
              {editedRows[rowKey] && (
                <span className="modified-badge">
                  edited - click Pending Approve to save
                </span>
              )}
            </div>
          );
        })}
      </>
    );
    return framed ? (
      <div key={path} className="nested-mini-card">
        {body}
      </div>
    ) : (
      <React.Fragment key={path}>{body}</React.Fragment>
    );
  };
  const renderNode = (record, path, idx, sectionId, value, label = "") => {
    if (empty(value)) return null;
    const sectionTitle =
      SECTIONS.find((section) => section.id === sectionId)?.title || "";
    const visibleLabel =
      label && label.toLowerCase() !== sectionTitle.toLowerCase() ? label : "";
    if (isDate(value) || typeof value !== "object")
      return renderLeaf(
        record,
        path,
        idx,
        sectionId,
        value,
        visibleLabel,
        true,
      );
    if (Array.isArray(value)) {
      const items = value
        .map((item, itemIndex) => ({ item, itemIndex }))
        .filter(({ item }) => !empty(item));
      if (items.every(({ item }) => typeof item !== "object" || isDate(item)))
        return (
          <React.Fragment key={path}>
            {visibleLabel && (
              <div className="nested-subtitle">{highlight(visibleLabel)}</div>
            )}
            <div className="nested-mini-card regular-row-group">
              {items.map(({ item, itemIndex }) =>
                renderLeaf(
                  record,
                  `${path}.${itemIndex}`,
                  idx,
                  sectionId,
                  item,
                  "",
                  false,
                ),
              )}
            </div>
          </React.Fragment>
        );
      return (
        <div className="nested-group" key={path}>
          {visibleLabel && (
            <div className="nested-subtitle">{highlight(visibleLabel)}</div>
          )}
          {items.map(({ item, itemIndex }) => (
            <div className="nested-mini-card object-item-card" key={itemIndex}>
              <div className="nested-subtitle sub-label">
                {item.substance || item.type || `Item ${itemIndex + 1}`}
              </div>
              {Object.entries(item)
                .filter(([, child]) => !empty(child))
                .map(([key, child]) =>
                  renderNode(
                    record,
                    `${path}.${itemIndex}.${key}`,
                    idx,
                    sectionId,
                    child,
                    humanize(key),
                  ),
                )}
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className="nested-group" key={path}>
        {visibleLabel && (
          <div className="nested-subtitle">{highlight(visibleLabel)}</div>
        )}
        {Object.entries(value)
          .filter(([, child]) => !empty(child))
          .map(([key, child]) =>
            renderNode(
              record,
              `${path}.${key}`,
              idx,
              sectionId,
              child,
              humanize(key),
            ),
          )}
      </div>
    );
  };
  const renderRecommendations = (record, idx, sectionId, value) => {
    const groups = new Map();
    value.forEach((item, itemIndex) => {
      const date = item?.date || "";
      const key = date ? toDateInput(date) : "no-date";
      if (!groups.has(key)) groups.set(key, { date, items: [] });
      groups.get(key).items.push({ item, itemIndex });
    });
    return (
      <div className="recommendation-groups">
        {[...groups.entries()].map(([key, group], groupIndex) => {
          const datePaths = group.items
            .filter(({ item }) => item?.date)
            .map(({ itemIndex }) => `recommendations.${itemIndex}.date`);
          const dateKey = `recommendations-date-${idx}-${groupIndex}`;
          return (
            <div className="nested-mini-card recommendation-group" key={key}>
              {key !== "no-date" && (
                <div
                  className="editable-date-subtitle"
                  data-edit-field={datePaths[0]}
                  data-edit-fields={datePaths.join(",")}
                >
                  <div
                    className="nested-subtitle date-subtitle editable-row"
                    onClick={() => {
                      if (editingField !== dateKey) {
                        setEditingField(dateKey);
                        setEditValue(toDateInput(group.date));
                      }
                    }}
                  >
                    {editingField === dateKey ? (
                      <div className="edit-field-container">
                        <BlueDatePicker
                          value={editValue}
                          onSelect={setEditValue}
                        />
                        <div className="edit-actions">
                          <button
                            className="save-btn"
                            onClick={(event) => {
                              event.stopPropagation();
                              stageMany(
                                record,
                                datePaths,
                                idx,
                                sectionId,
                                editValue,
                                dateKey,
                              );
                            }}
                          >
                            Save
                          </button>
                          <button
                            className="cancel-btn"
                            onClick={(event) => {
                              event.stopPropagation();
                              setEditingField(null);
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <span className="content-value">
                          {highlight(formatDate(group.date))}
                        </span>
                        <span className="edit-indicator">✎</span>
                      </>
                    )}
                  </div>
                </div>
              )}
              {group.items.map(({ item, itemIndex }) =>
                typeof item === "object"
                  ? renderLeaf(
                      record,
                      `recommendations.${itemIndex}.recommendation`,
                      idx,
                      sectionId,
                      item.recommendation,
                      "",
                      false,
                    )
                  : renderLeaf(
                      record,
                      `recommendations.${itemIndex}`,
                      idx,
                      sectionId,
                      item,
                      "",
                      false,
                    ),
              )}
            </div>
          );
        })}
      </div>
    );
  };
  const buildLines = (label, value, path, indent = 0) => {
    if (empty(value)) return [];
    const pad = "  ".repeat(indent);
    if (isDate(value) || typeof value !== "object") {
      const display = isDate(value)
        ? formatDate(value)
        : typeof value === "boolean"
          ? value
            ? "Yes"
            : "No"
          : String(value);
      const rows = numericShape(value)
        ? [display]
        : textRows(path, display).map((row) => row.text);
      return [
        label && `${pad}${label}`,
        label && `${pad}${"-".repeat(40)}`,
        ...rows.map((row, index) => `${pad}${index + 1}. ${row}`),
      ].filter(Boolean);
    }
    if (Array.isArray(value)) {
      const lines = [
        label && `${pad}${label}`,
        label && `${pad}${"-".repeat(40)}`,
      ].filter(Boolean);
      const populated = value
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => !empty(item));
      if (
        populated.every(
          ({ item }) => typeof item !== "object" || isDate(item),
        )
      ) {
        let rowNumber = 1;
        populated.forEach(({ item, index }) => {
          const display = isDate(item) ? formatDate(item) : String(item);
          const rows = numericShape(item)
            ? [display]
            : textRows(`${path}.${index}`, display).map((row) => row.text);
          rows.forEach((row) => {
            lines.push(`${pad}${rowNumber}. ${row}`);
            rowNumber += 1;
          });
        });
        return lines;
      }
      value.forEach((item, index) => {
        if (empty(item)) return;
        Object.entries(item)
          .filter(([, child]) => !empty(child))
          .forEach(([key, child]) =>
            lines.push(
              ...buildLines(
                humanize(key),
                child,
                `${path}.${index}.${key}`,
                indent + 1,
              ),
            ),
          );
      });
      return lines;
    }
    return [
      label && `${pad}${label}`,
      label && `${pad}${"-".repeat(40)}`,
      ...Object.entries(value)
        .filter(([, child]) => !empty(child))
        .flatMap(([key, child]) =>
          buildLines(humanize(key), child, `${path}.${key}`, indent + 1),
        ),
    ].filter(Boolean);
  };
  const sectionText = (record, idx, section) => {
    let text = `${section.title}\n${"=".repeat(40)}\n\n`;
    section.fields.forEach((field) => {
      const value = valueAt(record, field, idx);
      if (empty(value)) return;
      if (field === "recommendations") {
        const groups = new Map();
        value.forEach((item) => {
          const key = item?.date ? toDateInput(item.date) : "no-date";
          if (!groups.has(key))
            groups.set(key, { date: item?.date, items: [] });
          groups.get(key).items.push(item);
        });
        groups.forEach((group) => {
          if (group.date)
            text += `${formatDate(group.date)}\n${"-".repeat(40)}\n`;
          let rowNumber = 1;
          group.items.forEach((item) => {
            const path = `recommendations.${value.indexOf(item)}.recommendation`;
            const rows =
              typeof item === "object"
                ? textRows(path, item.recommendation || "")
                : textRows("recommendations", item);
            rows.forEach((row) => {
              text += `${rowNumber}. ${row.text}\n`;
              rowNumber += 1;
            });
          });
          text += "\n";
        });
      } else
        buildLines(LABELS[field] || humanize(field), value, field).forEach(
          (line) => {
            text += `${line}\n`;
          },
        );
      text += "\n";
    });
    return text;
  };
  const visibleSection = (record, idx, section) =>
    section.fields.some((field) => !empty(valueAt(record, field, idx)));
  return (
    <div className="supplementation-plans-document" ref={containerRef}>
      <div className="document-header">
        <h1 className="document-title">Supplementation Plans</h1>
        <div className="header-actions">
          <button
            className={`copy-btn${copied.all ? " copied" : ""}`}
            onClick={() =>
              copy(
                pdfData
                  .map(
                    (record, index) =>
                      `Supplementation Plans ${index + 1}\n${"=".repeat(40)}\n\n${SECTIONS.map((section) => sectionText(record, index, section)).join("")}`,
                  )
                  .join("\n"),
                "all",
              )
            }
          >
            {copied.all ? "Copied!" : "Copy All"}
          </button>
          <PDFDownloadLink
            document={
              <SupplementationPlansDocumentPDFTemplate document={pdfData} />
            }
            fileName="Supplementation_Plans.pdf"
            className="copy-btn"
          >
            {({ loading }) => (loading ? "Generating..." : "Export PDF")}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input
          className="search-input"
          placeholder="Search supplementation plans..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
      </div>
      {!records.length ? (
        <div className="empty-state">
          No substance use assessment records available
        </div>
      ) : (
        <div className="records-container">
          {filtered.map(({ record, idx }) => (
            <div className="record-card" key={idx}>
              <div className="record-header">
                <h3 className="record-name">{`Supplementation Plans ${idx + 1}`}</h3>
              </div>
              {SECTIONS.filter((section) =>
                visibleSection(record, idx, section),
              ).map((section) => {
                const sectionKey = `${section.id}-${idx}`;
                const pending = Object.keys(pendingEdits).some(
                  (key) =>
                    key.endsWith(`-${idx}`) &&
                    section.fields.some((field) => {
                      const path = key.slice(0, -`-${idx}`.length);
                      return path === field || path.startsWith(`${field}.`);
                    }),
                );
                return (
                  <div className="section" key={section.id}>
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h4 className="section-title">
                          {highlight(section.title)}
                        </h4>
                        <div className="header-right-actions">
                          <button
                            className={`copy-btn${copied[sectionKey] ? " copied" : ""}`}
                            onClick={() =>
                              copy(
                                sectionText(record, idx, section),
                                sectionKey,
                              )
                            }
                          >
                            {copied[sectionKey] ? "Copied!" : "Copy Section"}
                          </button>
                          {pending ? (
                            <button
                              className="approve-btn pending"
                              onClick={() => approve(record, idx, section)}
                            >
                              Pending Approve
                            </button>
                          ) : approvedSections[sectionKey] ? (
                            <span className="approve-btn approved">
                              Approved
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {section.fields.map((field) => {
                        const value = valueAt(record, field, idx);
                        if (empty(value)) return null;
                        if (field === "recommendations" && Array.isArray(value))
                          return (
                            <React.Fragment key={field}>
                              {renderRecommendations(
                                record,
                                idx,
                                section.id,
                                value,
                              )}
                            </React.Fragment>
                          );
                        return renderNode(
                          record,
                          field,
                          idx,
                          section.id,
                          value,
                          LABELS[field] || humanize(field),
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SupplementationPlansDocument;
