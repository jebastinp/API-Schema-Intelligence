import { cn } from "@/lib/utils";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "glass-panel rounded-[16px] border border-[#E2E8F0] bg-white shadow-[0_10px_24px_-18px_rgba(15,23,42,0.22)]",
        className,
      )}
      {...props}
    />
  );
}
