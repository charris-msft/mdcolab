import dynamic from "next/dynamic";

export const PresentationView = dynamic(
  () =>
    import("./presentation-view").then((m) => m.PresentationView),
  { ssr: false }
);
