import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main
      className="flex min-h-screen w-full flex-col items-center bg-background px-4 py-6 sm:px-6 lg:px-8"
      aria-busy="true"
      aria-label="Loading MeaningIt"
    >
      <div className="flex w-full max-w-7xl flex-1 flex-col items-center justify-center py-8 sm:py-12 lg:py-16">
        {/* App heading */}
        <div className="mb-8 flex w-full flex-col items-center sm:mb-10">
          <Skeleton
            className="h-12 w-48 rounded-md sm:h-14 sm:w-56 lg:h-16 lg:w-64"
            aria-hidden="true"
          />

          <Skeleton
            className="mt-3 h-5 w-[min(90%,32rem)] rounded-md sm:h-6"
            aria-hidden="true"
          />
        </div>

        {/* Main translator skeleton */}
        <section
          className="w-full max-w-7xl"
          aria-label="Loading translator"
        >
          <Skeleton
            className="h-[420px] w-full rounded-xl sm:h-[460px] lg:h-[500px]"
            aria-hidden="true"
          />
        </section>

        {/* Screen-reader loading message */}
        <p className="sr-only" role="status">
          Loading MeaningIt translator
        </p>
      </div>
    </main>
  );
}