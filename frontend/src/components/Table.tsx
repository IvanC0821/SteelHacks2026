import type { ReactNode } from "react";
import "./Table.css";

export interface Column<T> {
  key: string;
  /** header cell text; rendered in .v-label-12 */
  header: string;
  /** cell renderer */
  cell: (row: T) => ReactNode;
  /** right-aligns numbers so tabular figures line up */
  align?: "start" | "end";
  width?: string;
}

export interface TableProps<T> {
  columns: Array<Column<T>>;
  rows: T[];
  rowKey: (row: T) => string;
  /** makes a row clickable; the whole row becomes a button target */
  onRowClick?: (row: T) => void;
  /** marks one row as the current selection */
  isSelected?: (row: T) => boolean;
  /** shown in place of the body when `rows` is empty */
  empty?: ReactNode;
  caption?: string;
  className?: string;
}

/** Borderless rows on hairline dividers. No zebra striping, no card around it. */
export function Table<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  isSelected,
  empty,
  caption,
  className,
}: TableProps<T>) {
  if (rows.length === 0 && empty) {
    return <div className="v-table-empty">{empty}</div>;
  }

  return (
    <table className={["v-table", className ?? ""].filter(Boolean).join(" ")}>
      {caption ? <caption className="v-visually-hidden">{caption}</caption> : null}
      <thead>
        <tr>
          {columns.map((column) => (
            <th
              key={column.key}
              scope="col"
              className={`v-label-12 v-table__cell--${column.align ?? "start"}`}
              style={column.width ? { width: column.width } : undefined}
            >
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={rowKey(row)}
            className={[onRowClick ? "is-clickable" : "", isSelected?.(row) ? "is-selected" : ""]
              .filter(Boolean)
              .join(" ")}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            tabIndex={onRowClick ? 0 : undefined}
            onKeyDown={
              onRowClick
                ? (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onRowClick(row);
                    }
                  }
                : undefined
            }
          >
            {columns.map((column) => (
              <td key={column.key} className={`v-table__cell--${column.align ?? "start"}`}>
                {column.cell(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
