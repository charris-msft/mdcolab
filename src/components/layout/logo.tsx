import Link from "next/link";

export function Logo({ size = "default" }: { size?: "default" | "large" }) {
  const textSize = size === "large" ? "text-4xl" : "text-xl";
  return (
    <Link href="/" className={`${textSize} font-bold tracking-tight`}>
      md<span className="text-primary">colab</span>
    </Link>
  );
}
