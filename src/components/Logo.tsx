import Image from "next/image";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Image src="/horospaper-crystal-ball.svg" alt="" width={36} height={36} className="h-9 w-9" />
      <span className="font-serif text-2xl font-semibold tracking-tight text-foreground">horospaper</span>
    </span>
  );
}
