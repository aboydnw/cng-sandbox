declare module "gif.js" {
  export default class GIF {
    constructor(options: Record<string, unknown>);
    addFrame(canvas: HTMLCanvasElement, options?: { delay?: number }): void;
    on(event: string, callback: (blob: Blob) => void): void;
    render(): void;
  }
}
