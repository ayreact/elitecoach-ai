import { Toaster as SonnerToaster } from "sonner";

export function EliteToaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        style: {
          background: "#001141",
          color: "#FFFFFF",
          borderLeft: "3px solid #FF6B35",
          borderRadius: "4px",
          padding: "16px 20px",
          width: "320px",
          fontFamily: "IBM Plex Sans, system-ui, sans-serif",
          fontSize: "14px",
        },
      }}
    />
  );
}
