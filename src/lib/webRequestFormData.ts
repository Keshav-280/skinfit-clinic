/**
 * `Request#formData()` returns the Web FormData at runtime, but TypeScript can
 * resolve a Node `FormData` type that lacks `.get`, which breaks `next build`.
 */
export type WebFormData = {
  get(name: string): File | string | null;
};

export async function readWebFormData(req: Request): Promise<WebFormData> {
  return (await req.formData()) as unknown as WebFormData;
}
