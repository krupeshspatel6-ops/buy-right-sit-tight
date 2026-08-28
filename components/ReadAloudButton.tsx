"use client";

// Asks the buddy (Krupesh's AI assistant) to read a chapter aloud. Dispatches
// a "buddy:read" event the Buddy component listens for.
export default function ReadAloudButton({
  text,
  label = "🔊 Have the assistant read this",
}: {
  text: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() =>
        window.dispatchEvent(new CustomEvent("buddy:read", { detail: { text } }))
      }
      className="rounded-full border border-tape px-4 py-1.5 text-sm font-semibold text-tape hover:bg-tape/5"
    >
      {label}
    </button>
  );
}
