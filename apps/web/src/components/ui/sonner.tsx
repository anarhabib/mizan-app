import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      richColors
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: (
          <Spinner aria-hidden="true" className="motion-reduce:animate-none" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--success-bg": "var(--success)",
          "--success-text": "var(--success-foreground)",
          "--success-border":
            "color-mix(in srgb, var(--success-foreground) 25%, transparent)",
          "--warning-bg": "var(--warning)",
          "--warning-text": "var(--warning-foreground)",
          "--warning-border":
            "color-mix(in srgb, var(--warning-foreground) 25%, transparent)",
          "--error-bg": "var(--danger)",
          "--error-text": "var(--danger-foreground)",
          "--error-border": "var(--danger-border)",
          "--info-bg": "var(--info)",
          "--info-text": "var(--info-foreground)",
          "--info-border": "var(--info-outline)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
