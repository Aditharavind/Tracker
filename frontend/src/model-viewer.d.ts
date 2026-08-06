import type { DetailedHTMLProps, HTMLAttributes } from "react";

type ModelViewerAttributes = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
  src?: string;
  alt?: string;
  "animation-name"?: string;
  autoplay?: boolean;
  "camera-controls"?: boolean;
  "disable-zoom"?: boolean;
  "interaction-prompt"?: string;
  "camera-orbit"?: string;
  // React does not translate className -> class for custom elements (tag
  // names with a hyphen), so the literal `class` attribute must be used.
  class?: string;
};

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": ModelViewerAttributes;
    }
  }
}

export {};
