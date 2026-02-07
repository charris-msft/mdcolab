export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <div className="text-3xl font-bold tracking-tight animate-pulse">
          <span className="text-primary">md</span>
          <span className="text-muted-foreground">colab</span>
        </div>
        <div className="h-1 w-24 rounded-full bg-muted overflow-hidden">
          <div className="h-full w-1/2 rounded-full bg-primary animate-[shimmer_1.5s_ease-in-out_infinite]" />
        </div>
      </div>
    </div>
  );
}
