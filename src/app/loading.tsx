import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-background">
      <div className="text-center mb-8">
        <Skeleton className="h-12 w-48 mx-auto" />
        <Skeleton className="h-7 w-80 mt-2 mx-auto" />
      </div>
      <div className="w-full max-w-4xl">
        <Skeleton className="h-[450px] w-full rounded-lg" />
      </div>
    </div>
  );
}
