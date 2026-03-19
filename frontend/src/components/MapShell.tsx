import { NativeSelect } from "@chakra-ui/react";
import "maplibre-gl/dist/maplibre-gl.css";

export const BASEMAPS: Record<string, string> = {
  streets: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  satellite: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
};

export const BRAND_COLOR = "#CF3F02";
export const BRAND_COLOR_RGBA = [207, 63, 2] as const;

interface BasemapPickerProps {
  value: string;
  onChange: (value: string) => void;
}

export function BasemapPicker({ value, onChange }: BasemapPickerProps) {
  return (
    <NativeSelect.Root size="xs">
      <NativeSelect.Field
        value={value}
        onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
          onChange(e.target.value)
        }
      >
        <option value="streets">Streets</option>
        <option value="satellite">Satellite</option>
        <option value="dark">Dark</option>
      </NativeSelect.Field>
      <NativeSelect.Indicator />
    </NativeSelect.Root>
  );
}
