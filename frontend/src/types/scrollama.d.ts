declare module "scrollama" {
  interface ScrollamaInstance {
    setup(options: {
      step: string | HTMLElement[];
      offset?: number;
      progress?: boolean;
      debug?: boolean;
    }): ScrollamaInstance;
    onStepEnter(callback: (response: { element: HTMLElement; index: number; direction: string }) => void): ScrollamaInstance;
    onStepExit(callback: (response: { element: HTMLElement; index: number; direction: string }) => void): ScrollamaInstance;
    resize(): void;
    destroy(): void;
  }
  export default function scrollama(): ScrollamaInstance;
}
