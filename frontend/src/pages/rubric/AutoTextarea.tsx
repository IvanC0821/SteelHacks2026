import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";

export interface AutoTextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value"> {
  value: string;
  onValueChange: (value: string) => void;
  /** the smallest height in rows */
  minRows?: number;
}

/** A textarea that grows with its content, so a criterion is never read through a scrollbar. */
export function AutoTextarea({ value, onValueChange, minRows = 2, className, ...rest }: AutoTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${node.scrollHeight}px`;
  }, [value]);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    let previousWidth = node.getBoundingClientRect().width;
    const observer = new ResizeObserver(() => {
      const width = node.getBoundingClientRect().width;
      if (width === previousWidth) return;
      previousWidth = width;
      node.style.height = "auto";
      node.style.height = `${node.scrollHeight}px`;
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <textarea
      {...rest}
      ref={ref}
      rows={minRows}
      value={value}
      className={["v-rubric__textarea", className ?? ""].filter(Boolean).join(" ")}
      onChange={(event) => onValueChange(event.target.value)}
    />
  );
}
