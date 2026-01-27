"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// Chart configuration type
export interface ChartConfig {
  [key: string]: {
    label?: string;
    color?: string;
  };
}

// Chart context for sharing config
interface ChartContextValue {
  config: ChartConfig;
}

const ChartContext = React.createContext<ChartContextValue | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);
  if (!context) {
    throw new Error("useChart must be used within a ChartContainer");
  }
  return context;
}

// Chart Container component
interface ChartContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  config: ChartConfig;
  children: React.ReactNode;
}

const ChartContainer = React.forwardRef<HTMLDivElement, ChartContainerProps>(
  ({ className, config, children, ...props }, ref) => {
    // Generate CSS variables for chart colors
    const style = React.useMemo(() => {
      const cssVars: Record<string, string> = {};
      Object.entries(config).forEach(([key, value]) => {
        if (value.color) {
          cssVars[`--color-${key}`] = value.color;
        }
      });
      return cssVars;
    }, [config]);

    return (
      <ChartContext.Provider value={{ config }}>
        <div
          ref={ref}
          className={cn("flex aspect-video justify-center text-xs", className)}
          style={style}
          {...props}
        >
          {children}
        </div>
      </ChartContext.Provider>
    );
  },
);
ChartContainer.displayName = "ChartContainer";

// Chart Tooltip component
interface ChartTooltipContentProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload: Record<string, unknown>;
  }>;
  hideLabel?: boolean;
  labelKey?: string;
  nameKey?: string;
}

const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  ChartTooltipContentProps
>(({ active, payload, hideLabel = false, nameKey = "name" }, ref) => {
  const { config } = useChart();

  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div ref={ref} className="rounded-lg border bg-background p-2 shadow-sm">
      {payload.map((item, index) => {
        const key = (item.payload[nameKey] as string) || item.name;
        const itemConfig = config[key];

        return (
          <div key={index} className="flex items-center gap-2">
            <div
              className="h-2 w-2 rounded-full"
              style={{
                backgroundColor:
                  itemConfig?.color || (item.payload.fill as string),
              }}
            />
            {!hideLabel && (
              <span className="text-muted-foreground">
                {itemConfig?.label || key}:
              </span>
            )}
            <span className="font-bold">{item.value}</span>
          </div>
        );
      })}
    </div>
  );
});
ChartTooltipContent.displayName = "ChartTooltipContent";

export { ChartContainer, ChartTooltipContent, useChart };
